"use server";
import { listRefreshableQuotes } from "../../server/market-data/eligible-instruments";
import { isUuid } from "../../domain/identifier-utils";
import { refreshBaseline } from "../../server/market-data/history";
import { database } from "../../server/db/database";
import { subject } from "../../server/auth/subject";
import { refreshQuotes } from "../../server/market-data/fyers";
import { periods, type Period } from "../../domain/market-data";
import { syncDailyHistory } from "../../server/market-data/daily-history";
export async function refreshDailyHistory() {
  return syncDailyHistory();
}
export async function refreshHistoricalPrice(id: string, period: string) {
  if (!isUuid(id) || !periods.includes(period as Period))
    return "unavailable" as const;
  return refreshBaseline(id, period as Period);
}

export async function refreshPortfolioQuotes() {
  try {
    const user = await subject();
    const sql = database();
    const rows = await listRefreshableQuotes(sql, user);
    return await refreshQuotes(
      rows as unknown as Parameters<typeof refreshQuotes>[0],
    );
  } catch {
    return "unavailable" as const;
  }
}
