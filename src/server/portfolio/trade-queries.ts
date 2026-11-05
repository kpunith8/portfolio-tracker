import "server-only";
import type { database } from "../db/database";

type Sql = ReturnType<typeof database>;

export function deletePurchaseRecord(sql: Sql, user: string, id: string) {
  return sql`SELECT delete_portfolio_purchase(${user}, ${id}::uuid)`;
}

export function recordTradeEntry(
  sql: Sql,
  user: string,
  type: string,
  instrument: string | null,
  symbol: string | null,
  quantity: string,
  price: string,
  date: string,
  lot: string | null,
) {
  return sql`SELECT record_portfolio_trade(${user},${type},${instrument}::uuid,${symbol},${quantity}::numeric,${price}::numeric,${date}::date,${lot}::uuid)`;
}
