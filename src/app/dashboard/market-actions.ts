"use server";
import { refreshBaseline } from "../../server/market-data/history";
import { database, subject } from "../../server/portfolio/ledger";
import { refreshQuotes } from "../../server/market-data/fyers";
import { periods, type Period } from "../../domain/market-data";
import { syncDailyHistory } from "../../server/market-data/daily-history";
export async function refreshDailyHistory() {
  return syncDailyHistory();
}
export async function refreshHistoricalPrice(id: string, period: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !periods.includes(period as Period)
  )
    return "unavailable" as const;
  return refreshBaseline(id, period as Period);
}

export async function refreshPortfolioQuotes() {
  try {
    const user = await subject();
    const sql = database();
    const rows =
      await sql`SELECT i.id, i.fyers_symbol, to_char(p.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS retrieved_at
      FROM instruments i JOIN portfolios o ON o.id=i.portfolio_id
      LEFT JOIN price_observations p ON p.instrument_id=i.id AND p.portfolio_id=i.portfolio_id AND p.source='FYERS' AND p.interval_type='QUOTE'
      WHERE o.kinde_subject=${user} AND i.is_active AND i.asset_type='STOCK'
        AND EXISTS (SELECT 1 FROM investment_transactions t WHERE t.portfolio_id=i.portfolio_id AND t.instrument_id=i.id AND t.type='BUY' AND t.voided_at IS NULL AND t.quantity > COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0))`;
    return await refreshQuotes(
      rows as unknown as Parameters<typeof refreshQuotes>[0],
    );
  } catch {
    return "unavailable" as const;
  }
}
