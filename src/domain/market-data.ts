import Decimal from "decimal.js";
import { isLosslessNumber } from "lossless-json";

export const periods = [
  "7D",
  "15D",
  "30D",
  "60D",
  "90D",
  "6M",
  "365D",
] as const;
export type Period = (typeof periods)[number];
export function numberText(value: unknown) {
  if (isLosslessNumber(value)) return value.toString();
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value))
    return value;
  return null;
}
export function marketDate(epoch: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epoch * 1000));
}
export function targetDate(asOf: string, period: Period) {
  const [year, month, day] = asOf.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (period === "6M") {
    const first = new Date(Date.UTC(year, month - 7, 1));
    const last = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    first.setUTCDate(Math.min(day, last));
    return first.toISOString().slice(0, 10);
  }
  date.setUTCDate(date.getUTCDate() - Number(period.slice(0, -1)));
  return date.toISOString().slice(0, 10);
}
export function priorClose(
  candles: unknown[][],
  target: string,
  nowSeconds: number,
) {
  const candidates = candles
    .flatMap((c) => {
      if (!Array.isArray(c) || c.length < 5) return [];
      const time = numberText(c[0]);
      const price = numberText(c[4]);
      if (!time || !/^\d{1,10}$/.test(time) || !price) return [];
      const epoch = Number(time);
      if (epoch < 946684800 || epoch > nowSeconds + 86400) return [];
      const day = marketDate(epoch);
      if (day > target) return [];
      const value = new Decimal(price);
      if (
        !value.isFinite() ||
        value.lte(0) ||
        value.gte("10000000000000000") ||
        value.decimalPlaces() > 8
      )
        return [];
      return [{ day, price: value.toFixed() }];
    })
    .sort((a, b) => b.day.localeCompare(a.day));
  return candidates[0] ?? null;
}

export type ProviderQuote = {
  n?: string;
  s?: string;
  v?: { lp?: unknown; tt?: unknown };
};
export function validQuotes(
  quotes: ProviderQuote[],
  symbols: Map<string, string>,
  nowSeconds: number,
) {
  const results = new Map<
    string,
    { id: string; price: string; market_date: string; observed_at: string }
  >();
  for (const quote of quotes) {
    const id = symbols.get(quote.n || "");
    const price = numberText(quote.v?.lp);
    const timestamp = numberText(quote.v?.tt);
    if (
      !id ||
      quote.s !== "ok" ||
      !price ||
      !timestamp ||
      !/^\d{1,10}$/.test(timestamp)
    )
      continue;
    const epoch = Number(timestamp);
    if (epoch < 946684800 || epoch > nowSeconds + 86400) continue;
    const value = new Decimal(price);
    if (
      !value.isFinite() ||
      value.lte(0) ||
      value.gte("10000000000000000") ||
      value.decimalPlaces() > 8
    )
      continue;
    results.set(id, {
      id,
      price: value.toFixed(),
      market_date: marketDate(epoch),
      observed_at: new Date(epoch * 1000).toISOString(),
    });
  }
  return [...results.values()];
}

export function quoteBatchStatus(
  received: number,
  batch: number,
  stale: number,
) {
  if (received !== batch) return "unavailable" as const;
  return batch < stale ? ("more" as const) : ("current" as const);
}
