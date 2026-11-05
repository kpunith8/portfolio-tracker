import "server-only";
import type { database } from "../db/database";

type Sql = ReturnType<typeof database>;

export function saveQuotes(
  sql: Sql,
  requestedAt: string,
  rowsJson: string,
  user: string,
) {
  return sql`INSERT INTO price_observations(portfolio_id,instrument_id,source,interval_type,market_date,observed_at,price,retrieved_at)
      SELECT i.portfolio_id,i.id,'FYERS','QUOTE',x.market_date::date,x.observed_at::timestamptz,x.price::numeric,${requestedAt}::timestamptz
      FROM jsonb_to_recordset(${rowsJson}::jsonb) AS x(id uuid,price text,market_date text,observed_at text)
      JOIN instruments i ON i.id=x.id JOIN portfolios p ON p.id=i.portfolio_id WHERE p.kinde_subject=${user}
      ON CONFLICT (portfolio_id,instrument_id) WHERE source='FYERS' AND interval_type='QUOTE'
      DO UPDATE SET price=EXCLUDED.price,market_date=EXCLUDED.market_date,observed_at=EXCLUDED.observed_at,retrieved_at=EXCLUDED.retrieved_at
      WHERE price_observations.market_date < EXCLUDED.market_date OR
        (price_observations.market_date = EXCLUDED.market_date AND price_observations.retrieved_at <= EXCLUDED.retrieved_at)`;
}
