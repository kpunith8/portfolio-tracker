import { saveQuotes } from "./quote-queries";
import "server-only";
import {
  fyersRateKey,
  reserveSlot,
  applyFyersCooldown,
} from "../fyers/rate-limit";
import { fetchFyersData } from "../fyers/request";
import { parse } from "lossless-json";
import {
  fyersErrorStatus,
  validQuotes,
  quoteBatchStatus,
} from "../../domain/market-data";
import { database } from "../db/database";
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
  const key = fyersRateKey(appId);
  try {
    if (!(await reserveSlot(key))) return "throttled";
    const batch = stale.slice(0, 50);
    const query = new URLSearchParams({
      symbols: batch.map((i) => i.fyers_symbol!).join(","),
    });
    const requestedAt = new Date().toISOString();
    const response = await fetchFyersData("quotes", query, appId, token);
    if (response.status === 429) {
      await applyFyersCooldown(key);
      return "throttled";
    }
    if (response.status === 401 || response.status === 403) return "reconnect";
    if (!response.ok) return "unavailable";
    const result = parse(await response.text()) as QuoteResponse;
    if (result.s !== "ok") return fyersErrorStatus(result.code);
    if (!Array.isArray(result.d)) return "unavailable";
    const bySymbol = new Map(batch.map((i) => [i.fyers_symbol!, i.id]));
    const rows = validQuotes(result.d, bySymbol, Math.floor(Date.now() / 1000));
    if (!rows.length) return "unavailable";
    await saveQuotes(sql, requestedAt, JSON.stringify(rows), user);
    return quoteBatchStatus(rows.length, batch.length, stale.length);
  } catch {
    return "unavailable";
  }
}
