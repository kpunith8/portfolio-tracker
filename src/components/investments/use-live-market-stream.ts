"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { mergeMarketTick, type MarketTick } from "../../domain/live-market";
import { streamEventStatus, streamRetryDelay } from "../../domain/stream-retry";

/** Owns the market stream lifecycle; the view owns how ticks are displayed. */
export function useLiveMarketStream(
  holdingCount: number,
  setTicks: Dispatch<SetStateAction<Record<string, MarketTick>>>,
  retryOnFailure: boolean,
) {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "live" | "reconnecting" | "unavailable"
  >("connecting");

  useEffect(() => {
    if (!holdingCount) return;

    let stream: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let attempts = 0;

    function disconnect() {
      stream?.close();
      stream = null;
      if (retry) clearTimeout(retry);
      retry = null;
    }

    function connect() {
      if (disposed || document.hidden) return;
      attempts += 1;
      setStatus(attempts === 1 ? "connecting" : "reconnecting");
      stream = new EventSource("/api/fyers/stream");

      const source = stream;

      const failed = (rotate = false) => {
        if (source !== stream) return;
        source.close();
        stream = null;
        if (disposed || document.hidden) return;
        setTicks({});
        if (rotate) attempts = 0;
        if (retryOnFailure && attempts < 5) {
          setStatus("reconnecting");
          retry = setTimeout(connect, streamRetryDelay(attempts));
        } else setStatus("unavailable");
      };

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            status?: string;
            tick?: MarketTick;
          };
          const eventStatus = streamEventStatus(data);

          if (data.tick) {
            setStatus("live");
            attempts = 0;

            const tick = data.tick;

            setTicks((old) => ({
              ...old,
              [tick.symbol]: mergeMarketTick(old[tick.symbol], tick),
            }));
          } else if (eventStatus === "rotate") failed(true);
          else if (eventStatus === "error") failed();
          else if (eventStatus === "connected") setStatus("connected");
        } catch {
          failed();
        }
      };

      source.onerror = () => failed();
    }

    function visibilityChanged() {
      if (document.hidden) {
        disconnect();
        setTicks({});
        setStatus("connecting");
      } else {
        attempts = 0;
        connect();
      }
    }

    document.addEventListener("visibilitychange", visibilityChanged);
    connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visibilityChanged);
      disconnect();
    };
  }, [holdingCount, setTicks, retryOnFailure]);

  return status;
}
