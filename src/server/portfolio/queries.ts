import "server-only";
import type { database } from "../db/database";
import { PORTFOLIO_PAGE_SIZE } from "../../domain/pagination";

type Sql = ReturnType<typeof database>;

type Sort = "date" | "value";

// Callers must supply the authenticated subject; every query scopes its rows to it.
export function listLedgerTransactions(sql: Sql, ownerId: string) {
  return sql`SELECT t.id, t.instrument_id, t.type, t.transaction_date::text AS transaction_date, t.sequence, t.quantity::text AS quantity, t.unit_price::text AS unit_price, t.fees::text AS fees, t.taxes::text AS taxes, (t.notes = 'Imported purchase; fees and taxes were not supplied.') AS charges_missing,
      COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS sold,
      COALESCE((SELECT SUM(a.allocated_cost) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS allocated_cost,
      CASE WHEN t.type='SELL' THEN (SELECT CASE WHEN COALESCE(SUM(a.quantity),0)=t.quantity THEN SUM(a.allocated_cost)::text ELSE NULL END FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.sell_transaction_id=t.id) ELSE NULL END AS sale_cost
      FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id
      WHERE o.kinde_subject=${ownerId} AND t.voided_at IS NULL AND t.type IN ('BUY','SELL') ORDER BY t.transaction_date DESC,t.sequence DESC,t.id DESC`;
}

export function listInstruments(sql: Sql, user: string) {
  return sql`SELECT i.id, i.name, i.trading_symbol, i.fyers_symbol, i.unit, p.price::text AS price, p.market_date::text AS market_date, to_char(p.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS retrieved_at
      FROM instruments i JOIN portfolios o ON o.id=i.portfolio_id
      LEFT JOIN price_observations p ON p.instrument_id=i.id AND p.portfolio_id=i.portfolio_id AND p.source='FYERS' AND p.interval_type='QUOTE'
      WHERE o.kinde_subject=${user} AND i.asset_type='STOCK' AND i.is_active ORDER BY i.trading_symbol`;
}

export function listBaselines(sql: Sql, user: string, instrumentId: string) {
  return sql`SELECT b.instrument_id,b.period,b.as_of_date::text AS as_of_date,b.target_date::text AS target_date,b.market_date::text AS market_date,b.price::text AS price,b.status
      FROM ticker_period_baselines b JOIN portfolios o ON o.id=b.portfolio_id WHERE o.kinde_subject=${user} AND b.instrument_id=${instrumentId}::uuid`;
}

export function findMissingCharges(sql: Sql, user: string) {
  return sql`SELECT EXISTS(SELECT 1 FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.notes='Imported purchase; fees and taxes were not supplied.') AS missing`;
}

export function listDailyPrices(sql: Sql, user: string) {
  return sql`SELECT d.instrument_id,d.market_date::text AS market_date,d.price::text AS price,d.provider_symbol FROM daily_closing_prices d JOIN portfolios p ON p.id=d.portfolio_id WHERE p.kinde_subject=${user} ORDER BY d.market_date`;
}

export function listTransactionPage(
  sql: Sql,
  user: string,
  sort: Sort,
  offset: number,
) {
  return sql.transaction([
    sql`SELECT COUNT(*)::int AS total FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.type IN ('BUY','SELL')`,
    sql`SELECT t.id,t.instrument_id,t.type,t.transaction_date::text AS transaction_date,t.quantity::text AS quantity,t.unit_price::text AS unit_price,t.fees::text AS fees,t.taxes::text AS taxes,0::text AS sold,0::text AS allocated_cost,NULL::text AS sale_cost,(t.notes='Imported purchase; fees and taxes were not supplied.') AS charges_missing
      FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id
      LEFT JOIN price_observations p ON p.portfolio_id=t.portfolio_id AND p.instrument_id=t.instrument_id AND p.source='FYERS' AND p.interval_type='QUOTE'
      WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.type IN ('BUY','SELL')
      ORDER BY CASE WHEN ${sort}='value' THEN t.quantity*p.price END DESC NULLS LAST, t.transaction_date DESC,t.sequence DESC,t.id DESC LIMIT ${PORTFOLIO_PAGE_SIZE} OFFSET ${offset}`,
  ]);
}

export function listHoldingIds(
  sql: Sql,
  user: string,
  sort: Sort,
  liveMarket: boolean | undefined,
  offset: number,
) {
  return sql`WITH allocations AS (
        SELECT a.buy_transaction_id, SUM(a.quantity) AS sold, SUM(a.allocated_cost) AS allocated_cost
        FROM sale_allocations a JOIN portfolios o ON o.id=a.portfolio_id WHERE o.kinde_subject=${user} GROUP BY a.buy_transaction_id
      ), positions AS (
        SELECT t.instrument_id,SUM(t.quantity-COALESCE(a.sold,0)) AS quantity,MAX(t.transaction_date) AS latest
        FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id
        LEFT JOIN allocations a ON a.buy_transaction_id=t.id
        JOIN instruments i ON i.id=t.instrument_id AND i.portfolio_id=t.portfolio_id AND i.is_active AND i.asset_type='STOCK'
        WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.type='BUY' AND t.quantity>COALESCE(a.sold,0) GROUP BY t.instrument_id
      ), ordered AS (
        SELECT x.instrument_id FROM positions x JOIN instruments i ON i.id=x.instrument_id
        LEFT JOIN price_observations p ON p.portfolio_id=i.portfolio_id AND p.instrument_id=i.id AND p.source='FYERS' AND p.interval_type='QUOTE'
        ORDER BY CASE WHEN ${sort}='value' THEN x.quantity*p.price END DESC NULLS LAST, CASE WHEN ${sort}='date' THEN x.latest END DESC, i.trading_symbol ASC
        LIMIT ${liveMarket ? null : PORTFOLIO_PAGE_SIZE} OFFSET ${liveMarket ? 0 : offset}
      ) SELECT (SELECT COUNT(*)::int FROM positions) AS total, COALESCE(json_agg(ordered.instrument_id) FILTER (WHERE ordered.instrument_id IS NOT NULL),'[]'::json) AS ids FROM ordered`;
}

export function listInstrumentTransactions(
  sql: Sql,
  user: string,
  ids: string[],
) {
  return sql`SELECT t.id,t.instrument_id,t.type,t.transaction_date::text AS transaction_date,t.sequence,t.quantity::text AS quantity,t.unit_price::text AS unit_price,t.fees::text AS fees,t.taxes::text AS taxes,(t.notes='Imported purchase; fees and taxes were not supplied.') AS charges_missing,
      COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS sold,
      COALESCE((SELECT SUM(a.allocated_cost) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS allocated_cost,NULL::text AS sale_cost
      FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id
      WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.instrument_id = ANY(${ids}::uuid[]) AND t.type IN ('BUY','SELL')
      ORDER BY t.transaction_date DESC,t.sequence DESC,t.id DESC`;
}
