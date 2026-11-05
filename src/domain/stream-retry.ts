/** Delay reconnection briefly, then back off after consecutive failures. */
export function streamRetryDelay(attempts: number) {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempts - 1));
}
