"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { mergeMarketTick, type MarketTick } from "../../domain/live-market";
import { streamRetryDelay } from "../../domain/stream-retry";

/** Owns the market stream lifecycle; the view owns how ticks are displayed. */
export function useLiveMarketStream(
  holdingCount: number,
  setTicks: Dispatch<SetStateAction<Record<string, MarketTick>>>,
) {
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
      stream = new EventSource("/api/fyers/stream");
      const source = stream;
      const failed = () => {
        if (source !== stream) return;
        source.close();
        stream = null;
        if (!disposed && !document.hidden && attempts < 5)
          retry = setTimeout(connect, streamRetryDelay(attempts));
      };
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            status?: string;
            tick?: MarketTick;
          };
          if (data.tick) {
            const tick = data.tick;
            setTicks((old) => ({
              ...old,
              [tick.symbol]: mergeMarketTick(old[tick.symbol], tick),
            }));
          } else if (data.status === "error" || data.status === "closed")
            failed();
          else if (data.status === "connected") {
            attempts = 0;
          }
        } catch {
          failed();
        }
      };
      source.onerror = failed;
    }
    function visibilityChanged() {
      if (document.hidden) {
        disconnect();
      } else connect();
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    connect();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visibilityChanged);
      disconnect();
    };
  }, [holdingCount, setTicks]);
}
