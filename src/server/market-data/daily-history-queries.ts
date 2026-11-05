import "server-only";
import type { database } from "../db/database";

type Sql = ReturnType<typeof database>;

export function claimHistoryLease(sql: Sql, lease: string, user: string) {
  return sql`INSERT INTO daily_history_sync_leases(portfolio_id,lease_id,expires_at)
      SELECT id,${lease}::uuid,now()+interval '45 seconds' FROM portfolios WHERE kinde_subject=${user}
      ON CONFLICT (portfolio_id) DO UPDATE SET lease_id=EXCLUDED.lease_id,expires_at=EXCLUDED.expires_at
      WHERE daily_history_sync_leases.expires_at < now() RETURNING portfolio_id`;
}

export function listHistoryCandidates(sql: Sql, user: string) {
  return sql`SELECT i.id,i.fyers_symbol AS symbol,i.isin,(MIN(t.transaction_date) FILTER (WHERE t.type='BUY'))::text AS first,
      CASE WHEN SUM(CASE WHEN t.type='BUY' THEN t.quantity ELSE -t.quantity END)=0 THEN MAX(t.transaction_date)::text ELSE NULL END AS last,
      COALESCE((SELECT json_agg(json_build_object('start',c.start_date::text,'end',c.end_date::text)) FROM daily_history_coverage c WHERE c.portfolio_id=i.portfolio_id AND c.instrument_id=i.id AND (c.status='COMPLETE' OR c.checked_at>now()-interval '1 day' OR EXISTS (SELECT 1 FROM daily_history_alternate_coverage a WHERE a.portfolio_id=c.portfolio_id AND a.instrument_id=c.instrument_id AND a.status='COMPLETE' AND a.start_date<=c.start_date AND a.end_date>=c.end_date))),'[]'::json) AS coverage,
      (SELECT MIN(d.market_date)::text FROM daily_closing_prices d WHERE d.portfolio_id=i.portfolio_id AND d.instrument_id=i.id AND (d.provider_symbol IS NULL OR d.provider_symbol NOT LIKE 'BSE:%')) AS first_primary_saved
      ,COALESCE((SELECT json_agg(json_build_object('start',a.start_date::text,'end',a.end_date::text,'symbol',a.provider_symbol)) FROM daily_history_alternate_coverage a WHERE a.portfolio_id=i.portfolio_id AND a.instrument_id=i.id AND (a.status='COMPLETE' OR a.checked_at>now()-interval '1 day')),'[]'::json) AS alternate_coverage
      FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id JOIN investment_transactions t ON t.portfolio_id=i.portfolio_id AND t.instrument_id=i.id
      WHERE p.kinde_subject=${user} AND i.asset_type='STOCK' AND i.fyers_symbol IS NOT NULL AND t.type IN ('BUY','SELL') AND t.voided_at IS NULL
      GROUP BY i.id HAVING MIN(t.transaction_date) FILTER (WHERE t.type='BUY') IS NOT NULL ORDER BY i.id`;
}

export function listSavedHistoryDates(
  sql: Sql,
  user: string,
  instrumentId: string,
  startDate: string,
  endDate: string,
) {
  return sql`SELECT market_date::text AS date FROM daily_closing_prices WHERE portfolio_id=(SELECT id FROM portfolios WHERE kinde_subject=${user}) AND instrument_id=${instrumentId}::uuid AND market_date BETWEEN ${startDate}::date AND ${endDate}::date`;
}

export function findHistoryGaps(sql: Sql, user: string) {
  return sql`SELECT EXISTS(SELECT 1 FROM daily_history_coverage c JOIN portfolios p ON p.id=c.portfolio_id WHERE p.kinde_subject=${user} AND c.status='UNAVAILABLE' AND NOT EXISTS (SELECT 1 FROM daily_history_alternate_coverage a WHERE a.portfolio_id=c.portfolio_id AND a.instrument_id=c.instrument_id AND a.status='COMPLETE' AND a.start_date<=c.start_date AND a.end_date>=c.end_date)) OR EXISTS(SELECT 1 FROM daily_history_alternate_coverage a JOIN portfolios p ON p.id=a.portfolio_id WHERE p.kinde_subject=${user} AND a.status='UNAVAILABLE') AS missing`;
}

export function saveUnavailableAlternateCoverage(
  sql: Sql,
  symbol: string,
  startDate: string,
  endDate: string,
  lease: string,
  user: string,
  instrumentId: string,
) {
  return sql`INSERT INTO daily_history_alternate_coverage(portfolio_id,instrument_id,provider_symbol,start_date,end_date,status)
          SELECT i.portfolio_id,i.id,${symbol},${startDate}::date,${endDate}::date,'UNAVAILABLE' FROM instruments i
          JOIN portfolios p ON p.id=i.portfolio_id JOIN daily_history_sync_leases l ON l.portfolio_id=p.id AND l.lease_id=${lease}::uuid AND l.expires_at>now()
          WHERE p.kinde_subject=${user} AND i.id=${instrumentId}::uuid
          ON CONFLICT(portfolio_id,instrument_id,provider_symbol,start_date,end_date) DO UPDATE SET status='UNAVAILABLE',checked_at=now() WHERE daily_history_alternate_coverage.status='UNAVAILABLE' RETURNING 1`;
}

export function saveUnavailableCoverage(
  sql: Sql,
  startDate: string,
  endDate: string,
  lease: string,
  user: string,
  instrumentId: string,
) {
  return sql`INSERT INTO daily_history_coverage(portfolio_id,instrument_id,start_date,end_date,status)
        SELECT i.portfolio_id,i.id,${startDate}::date,${endDate}::date,'UNAVAILABLE' FROM instruments i
        JOIN portfolios p ON p.id=i.portfolio_id JOIN daily_history_sync_leases l ON l.portfolio_id=p.id AND l.lease_id=${lease}::uuid AND l.expires_at>now()
        WHERE p.kinde_subject=${user} AND i.id=${instrumentId}::uuid
        ON CONFLICT (portfolio_id,instrument_id,start_date,end_date) DO UPDATE SET status='UNAVAILABLE',checked_at=now()
        WHERE daily_history_coverage.status='UNAVAILABLE' RETURNING 1`;
}

export function saveDailyHistory(
  sql: Sql,
  lease: string,
  user: string,
  instrumentId: string,
  symbol: string,
  candlesJson: string,
  coverageJson: string,
  alternate: boolean,
) {
  return sql`WITH valid AS (
      SELECT i.portfolio_id,i.id FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id
      JOIN daily_history_sync_leases l ON l.portfolio_id=p.id AND l.lease_id=${lease}::uuid AND l.expires_at>now()
      WHERE p.kinde_subject=${user} AND i.id=${instrumentId}::uuid
    ), prices AS (
      INSERT INTO daily_closing_prices(portfolio_id,instrument_id,market_date,price,adjustment_basis,provider_symbol)
      SELECT valid.portfolio_id,valid.id,c.date::date,c.price::numeric,'UNKNOWN',${symbol} FROM valid CROSS JOIN jsonb_to_recordset(${candlesJson}::jsonb) AS c(date text,price text)
      ON CONFLICT DO NOTHING RETURNING 1
    ), covered AS (
      INSERT INTO daily_history_coverage(portfolio_id,instrument_id,start_date,end_date,status)
      SELECT valid.portfolio_id,valid.id,c.start::date,c."end"::date,c.status FROM valid CROSS JOIN jsonb_to_recordset(${coverageJson}::jsonb) AS c(start text,"end" text,status text) WHERE NOT ${alternate}
      ON CONFLICT (portfolio_id,instrument_id,start_date,end_date) DO UPDATE SET status=excluded.status,checked_at=now() RETURNING 1
    ), alternate AS (
      INSERT INTO daily_history_alternate_coverage(portfolio_id,instrument_id,provider_symbol,start_date,end_date,status)
      SELECT valid.portfolio_id,valid.id,${symbol},c.start::date,c."end"::date,c.status FROM valid CROSS JOIN jsonb_to_recordset(${coverageJson}::jsonb) AS c(start text,"end" text,status text) WHERE ${alternate}
      ON CONFLICT (portfolio_id,instrument_id,provider_symbol,start_date,end_date) DO UPDATE SET status=excluded.status,checked_at=now() RETURNING 1
    ) SELECT EXISTS(SELECT 1 FROM covered) OR EXISTS(SELECT 1 FROM alternate) AS ok`;
}

export function releaseHistoryLease(sql: Sql, lease: string) {
  return sql`DELETE FROM daily_history_sync_leases WHERE lease_id=${lease}::uuid`;
}
