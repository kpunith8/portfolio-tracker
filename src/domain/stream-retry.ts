/** Delay reconnection briefly, then back off after consecutive failures. */
export function streamRetryDelay(attempts: number) {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempts - 1));
}

/** Classify control events separately from FYERS data and keep heartbeats silent. */
export function streamEventStatus(event: { status?: string; tick?: unknown }) {
  if (event.tick) return "live" as const;
  if (event.status === "connected") return "connected" as const;
  if (event.status === "rotate") return "rotate" as const;
  if (event.status === "error" || event.status === "closed")
    return "error" as const;
  return null;
}

/** Reserve 30 seconds of a 300-second invocation for cleanup. */
export function streamRotationDelay(startedAt: number, now: number) {
  return Math.max(0, 270000 - (now - startedAt));
}

/** Enable Vercel-specific stream lifecycle only for the production deployment. */
export function isProductionStream(vercelEnvironment: string | undefined) {
  return vercelEnvironment === "production";
}
