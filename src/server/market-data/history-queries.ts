import "server-only";
import type { database } from "../db/database";

type Sql = ReturnType<typeof database>;

export function findBaseline(
  sql: Sql,
  period: string,
  user: string,
  instrumentId: string,
) {
  return sql`SELECT i.fyers_symbol,b.as_of_date::text AS as_of_date,b.status FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id
      LEFT JOIN ticker_period_baselines b ON b.portfolio_id=i.portfolio_id AND b.instrument_id=i.id AND b.period=${period}
      WHERE p.kinde_subject=${user} AND i.id=${instrumentId}::uuid AND i.is_active AND i.asset_type='STOCK'`;
}

export function findCoveredClose(
  sql: Sql,
  user: string,
  instrumentId: string,
  target: string,
) {
  return sql`SELECT d.market_date::text AS day,d.price::text AS price
      FROM daily_closing_prices d JOIN portfolios p ON p.id=d.portfolio_id
      WHERE p.kinde_subject=${user} AND d.instrument_id=${instrumentId}::uuid AND d.market_date<=${target}::date
      AND (EXISTS (SELECT 1 FROM daily_history_coverage c WHERE c.portfolio_id=d.portfolio_id AND c.instrument_id=d.instrument_id AND c.status='COMPLETE' AND c.start_date<=d.market_date AND c.end_date>=${target}::date)
        OR EXISTS (SELECT 1 FROM daily_history_alternate_coverage a WHERE a.portfolio_id=d.portfolio_id AND a.instrument_id=d.instrument_id AND a.status='COMPLETE' AND a.start_date<=d.market_date AND a.end_date>=${target}::date))
      ORDER BY d.market_date DESC LIMIT 1`;
}

export function saveCoveredBaseline(
  sql: Sql,
  period: string,
  asOf: string,
  target: string,
  closeDate: string,
  price: string,
  instrumentId: string,
  user: string,
) {
  return sql`INSERT INTO ticker_period_baselines(portfolio_id,instrument_id,period,as_of_date,target_date,market_date,price,status,adjustment_basis,checked_at)
        SELECT i.portfolio_id,i.id,${period},${asOf}::date,${target}::date,${closeDate}::date,${price}::numeric,'AVAILABLE','UNKNOWN',now()
        FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id WHERE i.id=${instrumentId}::uuid AND p.kinde_subject=${user}
        ON CONFLICT(portfolio_id,instrument_id,period) DO UPDATE SET as_of_date=excluded.as_of_date,target_date=excluded.target_date,market_date=excluded.market_date,price=excluded.price,status=excluded.status,adjustment_basis=excluded.adjustment_basis,checked_at=excluded.checked_at
        WHERE ticker_period_baselines.as_of_date<=excluded.as_of_date`;
}

export function saveFetchedBaseline(
  sql: Sql,
  period: string,
  asOf: string,
  target: string,
  closeDate: string,
  price: string,
  requestedAt: string,
  instrumentId: string,
  user: string,
) {
  return sql`INSERT INTO ticker_period_baselines(portfolio_id,instrument_id,period,as_of_date,target_date,market_date,price,status,adjustment_basis,checked_at)
      SELECT i.portfolio_id,i.id,${period},${asOf}::date,${target}::date,${closeDate}::date,${price}::numeric,'AVAILABLE','UNKNOWN',${requestedAt}::timestamptz
      FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id WHERE i.id=${instrumentId}::uuid AND p.kinde_subject=${user}
      ON CONFLICT(portfolio_id,instrument_id,period) DO UPDATE SET as_of_date=excluded.as_of_date,target_date=excluded.target_date,market_date=excluded.market_date,price=excluded.price,status=excluded.status,adjustment_basis=excluded.adjustment_basis,checked_at=excluded.checked_at
      WHERE ticker_period_baselines.as_of_date < excluded.as_of_date OR
        (ticker_period_baselines.as_of_date = excluded.as_of_date AND ticker_period_baselines.checked_at <= excluded.checked_at)`;
}
