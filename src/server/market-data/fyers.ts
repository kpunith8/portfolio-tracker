import "server-only";
import { createHash } from "node:crypto";
import { parse } from "lossless-json";
import {
  numberText,
  validQuotes,
  quoteBatchStatus,
} from "../../domain/market-data";
import { database } from "../portfolio/ledger";
import { owner, getToken } from "../fyers/session";

type QuoteInput = {
  id: string;
  fyers_symbol: string | null;
  retrieved_at: string | null;
};
type QuoteResponse = {
  s?: string;
  code?: unknown;
  d?: Array<{ n?: string; s?: string; v?: { lp?: unknown; tt?: unknown } }>;
};
export type MarketStatus =
  "current" | "more" | "cached" | "reconnect" | "unavailable" | "throttled";
export async function refreshQuotes(
  instruments: QuoteInput[],
): Promise<MarketStatus> {
  if (!instruments.length) return "cached";
  const eligible = instruments.filter((i) => i.fyers_symbol);
  if (!eligible.length) return "unavailable";
  const now = Date.now();
  const stale = eligible.filter((i) => {
    const retrievedAt = i.retrieved_at ? Date.parse(i.retrieved_at) : NaN;
    return !Number.isFinite(retrievedAt) || now - retrievedAt >= 5 * 60 * 1000;
  });
  if (!stale.length) return "cached";
  const user = await owner();
  const token = user ? await getToken(user) : null;
  const appId = process.env.FYERS_APP_ID;
  if (!user || !token || !appId) return "reconnect";
  const sql = database();
  const key = createHash("sha256").update(appId).digest("hex");
  try {
    if (!(await reserveSlot(key))) return "throttled";
    const batch = stale.slice(0, 50);
    const query = new URLSearchParams({
      symbols: batch.map((i) => i.fyers_symbol!).join(","),
    });
    const requestedAt = new Date().toISOString();
    const response = await fetch(
      `https://api-t1.fyers.in/data/quotes?${query}`,
      {
        headers: { Authorization: `${appId}:${token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.status === 429) {
      await sql`UPDATE fyers_rate_limits SET next_allowed_at=GREATEST(next_allowed_at,now()+interval '60 seconds') WHERE app_key=${key}`;
      return "throttled";
    }
    if (response.status === 401 || response.status === 403) return "reconnect";
    if (!response.ok) return "unavailable";
    const result = parse(await response.text()) as QuoteResponse;
    if (result.s !== "ok")
      return ["-8", "-15", "-16", "-17"].includes(numberText(result.code) || "")
        ? "reconnect"
        : "unavailable";
    if (!Array.isArray(result.d)) return "unavailable";
    const bySymbol = new Map(batch.map((i) => [i.fyers_symbol!, i.id]));
    const rows = validQuotes(result.d, bySymbol, Math.floor(Date.now() / 1000));
    if (!rows.length) return "unavailable";
    await sql`INSERT INTO price_observations(portfolio_id,instrument_id,source,interval_type,market_date,observed_at,price,retrieved_at)
      SELECT i.portfolio_id,i.id,'FYERS','QUOTE',x.market_date::date,x.observed_at::timestamptz,x.price::numeric,${requestedAt}::timestamptz
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(id uuid,price text,market_date text,observed_at text)
      JOIN instruments i ON i.id=x.id JOIN portfolios p ON p.id=i.portfolio_id WHERE p.kinde_subject=${user}
      ON CONFLICT (portfolio_id,instrument_id) WHERE source='FYERS' AND interval_type='QUOTE'
      DO UPDATE SET price=EXCLUDED.price,market_date=EXCLUDED.market_date,observed_at=EXCLUDED.observed_at,retrieved_at=EXCLUDED.retrieved_at
      WHERE price_observations.market_date < EXCLUDED.market_date OR
        (price_observations.market_date = EXCLUDED.market_date AND price_observations.retrieved_at <= EXCLUDED.retrieved_at)`;
    return quoteBatchStatus(rows.length, batch.length, stale.length);
  } catch {
    return "unavailable";
  }
}

export async function reserveSlot(key: string) {
  const sql = database();
  const result =
    await sql`INSERT INTO fyers_rate_limits(app_key,next_allowed_at,market_day,requests)
    VALUES (${key},now()+interval '2 seconds',(now() AT TIME ZONE 'Asia/Kolkata')::date,1)
    ON CONFLICT(app_key) DO UPDATE SET next_allowed_at=now()+interval '2 seconds',
      requests=CASE WHEN fyers_rate_limits.market_day=(now() AT TIME ZONE 'Asia/Kolkata')::date THEN fyers_rate_limits.requests+1 ELSE 1 END,
      market_day=(now() AT TIME ZONE 'Asia/Kolkata')::date
    WHERE fyers_rate_limits.next_allowed_at<=now() AND (fyers_rate_limits.market_day<>(now() AT TIME ZONE 'Asia/Kolkata')::date OR fyers_rate_limits.requests<4000)
    RETURNING app_key`;
  return result.length > 0;
}
