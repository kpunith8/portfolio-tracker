import "server-only";
import type { database } from "../db/database";
import type { DividendRow } from "../../domain/dividends";

type Sql = ReturnType<typeof database>;

export function listOwnerDividends(sql: Sql, user: string) {
  return sql`SELECT d.company_name AS company,d.isin,d.symbol,d.ex_date::text AS "exDate",d.shares::text AS shares,d.per_share::text AS "perShare",d.net_amount::text AS "netAmount" FROM portfolio_dividends d JOIN portfolios p ON p.id=d.portfolio_id WHERE p.kinde_subject=${user} ORDER BY d.ex_date,d.id`;
}

export function findDividendMatches(
  sql: Sql,
  user: string,
  rows: DividendRow[],
) {
  const keys = rows.map(({ isin, exDate }) => ({ isin, exDate }));

  return sql`SELECT d.company_name AS company,d.isin,d.symbol,d.ex_date::text AS "exDate",d.shares::text AS shares,d.per_share::text AS "perShare",d.net_amount::text AS "netAmount" FROM portfolio_dividends d JOIN portfolios p ON p.id=d.portfolio_id WHERE p.kinde_subject=${user} AND EXISTS (SELECT 1 FROM jsonb_to_recordset(${JSON.stringify(keys)}::jsonb) AS x(isin text, "exDate" text) WHERE x.isin=d.isin AND x."exDate"=d.ex_date::text)`;
}
