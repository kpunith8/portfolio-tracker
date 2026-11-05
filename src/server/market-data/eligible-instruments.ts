import "server-only";
import type { database } from "../db/database";

type Sql = ReturnType<typeof database>;

export function listRefreshableQuotes(sql: Sql, user: string) {
  return sql`SELECT i.id, i.fyers_symbol, to_char(p.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS retrieved_at
      FROM instruments i JOIN portfolios o ON o.id=i.portfolio_id
      LEFT JOIN price_observations p ON p.instrument_id=i.id AND p.portfolio_id=i.portfolio_id AND p.source='FYERS' AND p.interval_type='QUOTE'
      WHERE o.kinde_subject=${user} AND i.is_active AND i.asset_type='STOCK'
        AND EXISTS (SELECT 1 FROM investment_transactions t WHERE t.portfolio_id=i.portfolio_id AND t.instrument_id=i.id AND t.type='BUY' AND t.voided_at IS NULL AND t.quantity > COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0))`;
}
