import Decimal from "decimal.js";
import { marketDate } from "./market-date-utils.ts";
import { validMarketPrice } from "./price-utils.ts";

export function marketTotals(
  holdings: { cost: string; value: string | null }[],
) {
  const invested = holdings.reduce(
    (sum, h) => sum.plus(h.cost),
    new Decimal(0),
  );
  const current =
    holdings.length && holdings.every((h) => h.value !== null)
      ? holdings.reduce((sum, h) => sum.plus(h.value!), new Decimal(0))
      : null;

  return { invested, current, profit: current?.minus(invested) ?? null };
}

export function parseMarketTick(input: unknown, symbols: Set<string>) {
  if (!input || typeof input !== "object") return null;

  const tick = input as Record<string, unknown>;

  if (
    tick.type !== "sf" ||
    typeof tick.symbol !== "string" ||
    !symbols.has(tick.symbol)
  )
    return null;

  const decimal = (value: unknown) => {
    if (
      (typeof value !== "number" && typeof value !== "string") ||
      !/^\d+(?:\.\d+)?$/.test(String(value))
    )
      return null;

    return validMarketPrice(String(value))?.toFixed() ?? null;
  };

  const price = decimal(tick.ltp);

  if (!price) return null;

  const timestamp = Number(tick.last_traded_time);

  if (
    !Number.isInteger(timestamp) ||
    timestamp < 946684800 ||
    timestamp > Math.floor(Date.now() / 1000) + 60
  )
    return null;

  return {
    symbol: tick.symbol,
    price,
    previousClose: decimal(tick.prev_close_price),
    marketDate: marketDate(timestamp),
    tradedAt: timestamp,
  };
}

export function dailyMovement(
  quantity: string,
  price: string,
  previousClose: string | null,
) {
  if (!previousClose || new Decimal(previousClose).lte(0)) return null;

  const change = new Decimal(price).minus(previousClose);

  return {
    change,
    amount: change.mul(quantity),
    percent: change.div(previousClose).mul(100),
  };
}

export type MarketTick = {
  symbol: string;
  price: string;
  previousClose: string | null;
  marketDate: string;
  tradedAt: number;
};

export function mergeMarketTick(
  previous: MarketTick | undefined,
  incoming: MarketTick,
): MarketTick {
  if (previous && incoming.tradedAt < previous.tradedAt) return previous;

  return {
    ...incoming,
    previousClose:
      incoming.previousClose ??
      (previous?.marketDate === incoming.marketDate
        ? previous.previousClose
        : null),
  };
}

export function compareNullableDecimal(
  left: Decimal | null,
  right: Decimal | null,
  ascending: boolean,
) {
  if (left === null || right === null)
    return left === right ? 0 : left === null ? 1 : -1;

  return (ascending ? 1 : -1) * left.cmp(right);
}

// Preserve the existing market comparison API for current consumers.
export const compareMarketPercent = compareNullableDecimal;

export function returnPercent(
  profit: Decimal.Value | null,
  cost: Decimal.Value,
) {
  const invested = new Decimal(cost);

  return profit === null || invested.isZero()
    ? null
    : new Decimal(profit).div(invested).mul(100);
}
