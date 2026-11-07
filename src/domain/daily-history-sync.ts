type Coverage = { start: string; end: string };

export function historyResponseStatus(response: {
  s?: string;
  candles?: unknown;
}): "available" | "unavailable" | "error" {
  if (
    response.s === "no_data" &&
    (response.candles === undefined ||
      (Array.isArray(response.candles) && response.candles.length === 0))
  )
    return "unavailable";
  if (response.s !== "ok" || !Array.isArray(response.candles)) return "error";

  return response.candles.length ? "available" : "unavailable";
}

const DAY = 86400000;

const epoch = (date: string) => Date.parse(`${date}T00:00:00Z`);

const day = (date: number) => new Date(date).toISOString().slice(0, 10);

export function splitReturnedCoverage(
  first: string,
  last: string,
  saved: readonly string[],
) {
  const seen = new Set(saved);
  const result: Array<Coverage & { status: "COMPLETE" | "UNAVAILABLE" }> = [];

  for (let current = epoch(first); current <= epoch(last); current += DAY) {
    const date = day(current),
      weekday = new Date(current).getUTCDay();
    const status =
      seen.has(date) || weekday === 0 || weekday === 6
        ? "COMPLETE"
        : "UNAVAILABLE";
    const previous = result[result.length - 1];

    if (previous && previous.status === status) previous.end = date;
    else result.push({ start: date, end: date, status });
  }

  return result;
}

export function fallbackHistoryRange(
  first: string,
  last: string,
  firstSaved: string | null,
  coverage: readonly Coverage[],
  saved: readonly string[],
) {
  let upper = last;

  if (firstSaved) {
    if (epoch(firstSaved) - epoch(first) <= 7 * DAY) return null;
    upper = day(Math.min(epoch(last), epoch(firstSaved) - DAY));
  }

  return missingHistoryRange(first, upper, coverage, saved);
}

/** Choose a contiguous missing range without requesting already saved days. */
export function missingHistoryRange(
  first: string,
  last: string,
  coverage: readonly Coverage[],
  saved: readonly string[],
): Coverage | null {
  const seen = new Set(saved);

  const covered = (date: string) =>
    seen.has(date) || coverage.some((r) => r.start <= date && date <= r.end);

  let cursor = epoch(last);
  const minimum = epoch(first);

  while (cursor >= minimum && covered(day(cursor))) cursor -= DAY;
  if (cursor < minimum) return null;

  const end = cursor;

  while (
    cursor - DAY >= minimum &&
    (end - cursor) / DAY < 365 &&
    !covered(day(cursor - DAY))
  )
    cursor -= DAY;

  return { start: day(cursor), end: day(end) };
}
