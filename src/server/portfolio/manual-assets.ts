import "server-only";
import { database } from "../db/database";

export async function readManualAssets(user: string) {
  const sql = database();
  const [assets, entries, navs] = await Promise.all([
    sql`SELECT i.id,i.asset_type,i.name,i.expense_ratio::text AS expense_ratio FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id WHERE p.kinde_subject=${user} AND i.is_active AND i.asset_type IN ('MUTUAL_FUND','DEBT_OTHER') ORDER BY i.name`,
    sql`SELECT e.id,e.instrument_id,e.entry_type,e.entry_date::text AS date,e.quantity::text AS quantity,e.amount::text AS amount,e.source,e.purchase_id::text AS purchase_id FROM manual_asset_entries e JOIN portfolios p ON p.id=e.portfolio_id WHERE p.kinde_subject=${user} AND e.voided_at IS NULL ORDER BY e.entry_date DESC,e.created_at DESC,e.id`,
    sql`SELECT o.instrument_id,o.market_date::text AS date,o.price::text AS price FROM price_observations o JOIN portfolios p ON p.id=o.portfolio_id JOIN instruments i ON i.id=o.instrument_id AND i.portfolio_id=o.portfolio_id WHERE p.kinde_subject=${user} AND i.asset_type='MUTUAL_FUND' AND o.source='MANUAL' AND o.interval_type='MANUAL' ORDER BY o.market_date DESC`,
  ]);

  return { assets, entries, navs };
}
