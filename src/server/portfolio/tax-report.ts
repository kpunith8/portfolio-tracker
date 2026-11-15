import "server-only";
import { database } from "../db/database";
import { subject } from "../auth/subject";
import { findMutualFundPurchases } from "./tax-queries";
import type { SaleLot } from "../../domain/tax-report";

export async function readTaxReport() {
  const user = await subject();
  const sql = database();
  const [lots, incomplete, mutualFunds] = await sql.transaction([
    sql`SELECT s.id::text AS "sellId", i.trading_symbol AS symbol, s.transaction_date::text AS "sellDate", b.transaction_date::text AS "buyDate", a.quantity::text AS quantity, b.unit_price::text AS "buyPrice", s.unit_price::text AS "sellPrice"
      FROM investment_transactions s JOIN portfolios p ON p.id=s.portfolio_id
      JOIN instruments i ON i.portfolio_id=s.portfolio_id AND i.id=s.instrument_id
      JOIN sale_allocations a ON a.portfolio_id=s.portfolio_id AND a.sell_transaction_id=s.id
      JOIN investment_transactions b ON b.portfolio_id=a.portfolio_id AND b.id=a.buy_transaction_id
      WHERE p.kinde_subject=${user} AND s.type='SELL' AND s.voided_at IS NULL AND i.asset_type='STOCK'
      ORDER BY s.transaction_date DESC,s.sequence DESC,s.id,b.transaction_date,b.sequence,b.id`,
    sql`SELECT EXISTS(SELECT 1 FROM investment_transactions s JOIN portfolios p ON p.id=s.portfolio_id JOIN instruments i ON i.portfolio_id=s.portfolio_id AND i.id=s.instrument_id WHERE p.kinde_subject=${user} AND s.type='SELL' AND s.voided_at IS NULL AND i.asset_type='STOCK' AND s.quantity <> COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=s.portfolio_id AND a.sell_transaction_id=s.id),0)) AS incomplete`,
    findMutualFundPurchases(sql, user),
  ]);

  return {
    lots: lots as SaleLot[],
    hasMutualFundPurchases: Boolean(mutualFunds[0]?.has_purchases),
    incomplete: Boolean(incomplete[0]?.incomplete),
  };
}
