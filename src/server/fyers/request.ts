import "server-only";

/** The rate slot must be reserved before calling this provider request. */
export function fetchFyersData(
  endpoint: "quotes" | "history",
  query: URLSearchParams,
  appId: string,
  token: string,
) {
  return fetch(`https://api-t1.fyers.in/data/${endpoint}?${query}`, {
    headers: { Authorization: `${appId}:${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
}
