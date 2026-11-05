import "server-only";
import type { database } from "../db/database";

type Sql = ReturnType<typeof database>;

export function listStreamingSymbols(sql: Sql, user: string) {
  return sql`SELECT DISTINCT i.fyers_symbol FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id WHERE p.kinde_subject=${user} AND i.is_active AND i.asset_type='STOCK' AND i.fyers_symbol IS NOT NULL AND EXISTS (SELECT 1 FROM investment_transactions t WHERE t.portfolio_id=i.portfolio_id AND t.instrument_id=i.id AND t.type='BUY' AND t.voided_at IS NULL AND t.quantity > COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)) ORDER BY i.fyers_symbol`;
}
