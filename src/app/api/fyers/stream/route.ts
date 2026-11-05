import { listStreamingSymbols } from "../../../../server/market-data/stream-queries";
import "fyers-api-v3"; // Include the SDK and its transitive dependencies in server deployments.
import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { join } from "node:path";
import { owner, getToken } from "../../../../server/fyers/session";
import { database } from "../../../../server/db/database";
import {
  isProductionStream,
  streamRotationDelay,
} from "../../../../domain/stream-retry";
import { parseMarketTick } from "../../../../domain/live-market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Each worker has its own SDK module instance, so a renewed FYERS session can
// start cleanly even though the SDK's data socket is a process singleton.
const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
try {
 const Socket = require(workerData.sdk).fyersDataSocket;
 const socket = Socket.getInstance(workerData.token, '', false);
 socket.on('connect', () => { parentPort.postMessage({status:'connected'}); socket.subscribe(workerData.symbols); });
 socket.on('message', message => parentPort.postMessage(message && message.s === 'error' ? {status:'error'} : {message}));
 socket.on('error', () => parentPort.postMessage({status:'error', stage:'socket_error'}));
 socket.on('close', () => parentPort.postMessage({status:'closed'}));
 parentPort.on('message', () => { try { socket.close(); } finally { process.exit(0); } });
 socket.connect();
} catch { parentPort.postMessage({status:'error', stage:'worker_initialization'}); }
`;

type Subscriber = (event: object) => void;
type Stream = {
  worker: Worker;
  key: string;
  listeners: Set<Subscriber>;
};
const globalStreams = globalThis as typeof globalThis & {
  fyersLiveStream?: Stream;
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  const user = await owner();
  const token = user ? await getToken(user) : null;
  const app = process.env.FYERS_APP_ID;
  if (!user || !token || !app) {
    console.info("[fyers-stream] authorization_unavailable");
    return new Response("FYERS reconnect required", { status: 401 });
  }
  const sql = database();
  const rows = await listStreamingSymbols(sql, user);
  const symbols = rows.map((row) => String(row.fyers_symbol));
  if (!symbols.length || symbols.length > 100) {
    console.info("[fyers-stream] symbols_unavailable_or_limit");
    return new Response(
      "No eligible symbols or Standard subscription limit exceeded",
      { status: 409 },
    );
  }
  const symbolSet = new Set(symbols);
  const { createHash } = await import("node:crypto");
  const key = createHash("sha256")
    .update(user)
    .update(token)
    .update(JSON.stringify(symbols))
    .digest("hex");
  let shared = globalStreams.fyersLiveStream;
  if (shared && shared.key !== key) {
    console.info("[fyers-stream] another_stream_active");
    return new Response("Another market stream is active", { status: 409 });
  }
  if (!shared) {
    console.info("[fyers-stream] worker_starting");
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: {
        sdk: createRequire(join(process.cwd(), "package.json")).resolve(
          "fyers-api-v3",
        ),
        token: `${app}:${token}`,
        symbols,
      },
    });
    const listeners = new Set<Subscriber>();
    shared = { worker, key, listeners };
    globalStreams.fyersLiveStream = shared;
    let loggedTick = false;
    let loggedMessage = false;
    worker.on(
      "message",
      (event: { status?: string; stage?: string; message?: unknown }) => {
        if (event.status === "connected")
          console.info("[fyers-stream] socket_connected");
        if (event.status === "error")
          console.warn(
            event.stage === "worker_initialization"
              ? "[fyers-stream] worker_initialization_failed"
              : "[fyers-stream] socket_error",
          );
        if (event.message && !loggedMessage) {
          loggedMessage = true;
          console.info("[fyers-stream] first_provider_message");
        }
        const tick = parseMarketTick(event.message, symbolSet);
        if (tick && !loggedTick) {
          loggedTick = true;
          console.info("[fyers-stream] first_valid_tick");
        }
        const value = tick
          ? { tick }
          : event.status
            ? { status: event.status }
            : null;
        if (value) for (const listener of listeners) listener(value);
      },
    );
    worker.on("error", () => {
      console.warn("[fyers-stream] worker_error");
      for (const listener of listeners) listener({ status: "error" });
    });
    worker.on("exit", () => {
      console.info("[fyers-stream] worker_exited");
      for (const listener of listeners) listener({ status: "closed" });
      if (globalStreams.fyersLiveStream?.worker === worker)
        delete globalStreams.fyersLiveStream;
    });
  }
  const current = shared;
  const encoder = new TextEncoder();
  let listener: Subscriber;
  let heartbeat: ReturnType<typeof setInterval>;
  let rotation: ReturnType<typeof setTimeout> | undefined;
  const body = new ReadableStream({
    start(controller) {
      let closed = false;
      const stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(rotation);
        current.listeners.delete(listener);
        if (!current.listeners.size) {
          void current.worker.terminate();
          if (globalStreams.fyersLiveStream === current)
            delete globalStreams.fyersLiveStream;
        }
        try {
          controller.close();
        } catch {}
      };
      listener = (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          stop();
        }
      };
      current.listeners.add(listener);
      listener({ status: "connecting" });
      heartbeat = setInterval(() => listener({ status: "heartbeat" }), 15000);
      // Leave time for cleanup before Vercel Hobby's 300-second deadline.
      if (isProductionStream(process.env.VERCEL_ENV)) {
        rotation = setTimeout(
          () => {
            console.info("[fyers-stream] rotating_connection");
            listener({ status: "rotate" });
            stop();
          },
          streamRotationDelay(startedAt, Date.now()),
        );
      }
      request.signal.addEventListener("abort", stop, { once: true });
    },
    cancel() {
      clearInterval(heartbeat);
      clearTimeout(rotation);
      current.listeners.delete(listener);
      if (!current.listeners.size) {
        void current.worker.terminate();
        if (globalStreams.fyersLiveStream === current)
          delete globalStreams.fyersLiveStream;
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
