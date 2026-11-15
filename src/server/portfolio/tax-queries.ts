import "server-only";
import type { database } from "../db/database";

type Sql = ReturnType<typeof database>;

export function findMutualFundPurchases(sql: Sql, user: string) {
  return sql`SELECT EXISTS(SELECT 1 FROM manual_asset_entries e JOIN portfolios p ON p.id=e.portfolio_id JOIN instruments i ON i.portfolio_id=e.portfolio_id AND i.id=e.instrument_id WHERE p.kinde_subject=${user} AND i.asset_type='MUTUAL_FUND' AND e.entry_type='PURCHASE' AND e.voided_at IS NULL) AS has_purchases`;
}
