import "server-only";
import { neon } from "@neondatabase/serverless";
import Decimal from "decimal.js";
import { remainingLot } from "../../domain/holdings";
import { dailyPortfolioHistory } from "../../domain/daily-portfolio-history";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { marketDate } from "../../domain/market-data";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export function currentMarketDay() {
  return marketDate(Math.floor(Date.now() / 1000));
}
export async function subject() {
  const session = getKindeServerSession();
  if (!(await session.isAuthenticated()))
    throw new Error("Authentication required");
  const user = await session.getUser();
  if (!user?.id) throw new Error("Authentication required");
  return user.id;
}
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
  return neon(process.env.DATABASE_URL);
}
export function ledgerCacheTag(user: string) {
  return `portfolio-ledger-${createHash("sha256").update(user).digest("hex")}`;
}
async function readTransactions(user: string) {
  const tag = ledgerCacheTag(user);
  return unstable_cache(
    async (ownerId: string) => {
      const sql = database();
      return sql`SELECT t.id, t.instrument_id, t.type, t.transaction_date::text AS transaction_date, t.sequence, t.quantity::text AS quantity, t.unit_price::text AS unit_price, t.fees::text AS fees, t.taxes::text AS taxes, (t.notes = 'Imported purchase; fees and taxes were not supplied.') AS charges_missing,
      COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS sold,
      COALESCE((SELECT SUM(a.allocated_cost) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS allocated_cost,
      CASE WHEN t.type='SELL' THEN (SELECT CASE WHEN COALESCE(SUM(a.quantity),0)=t.quantity THEN SUM(a.allocated_cost)::text ELSE NULL END FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.sell_transaction_id=t.id) ELSE NULL END AS sale_cost
      FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id
      WHERE o.kinde_subject=${ownerId} AND t.voided_at IS NULL AND t.type IN ('BUY','SELL') ORDER BY t.transaction_date DESC,t.sequence DESC,t.id DESC`;
    },
    ["portfolio-transactions-v1", tag],
    { tags: [tag], revalidate: 60 },
  )(user);
}
export type PortfolioReadOptions = {
  view: "dashboard" | "portfolio" | "transactions";
  page: number;
  sort: "date" | "value";
  detailId?: string;
  asOf: string;
};
const PAGE_SIZE = 20;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readPortfolio(options: PortfolioReadOptions) {
  const user = await subject();
  const sql = database();
  const page = Math.max(1, Math.min(options.page, 100000));
  const offset = (page - 1) * PAGE_SIZE;
  const details = options.view === "portfolio" && !!options.detailId;
  const validDetail = details && uuid.test(options.detailId!);
  const pricesPromise = sql`SELECT i.id, i.name, i.trading_symbol, i.fyers_symbol, i.unit, p.price::text AS price, p.market_date::text AS market_date, to_char(p.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS retrieved_at
      FROM instruments i JOIN portfolios o ON o.id=i.portfolio_id
      LEFT JOIN price_observations p ON p.instrument_id=i.id AND p.portfolio_id=i.portfolio_id AND p.source='FYERS' AND p.interval_type='QUOTE'
      WHERE o.kinde_subject=${user} AND i.asset_type='STOCK' AND i.is_active ORDER BY i.trading_symbol`;
  const baselinesPromise = validDetail
    ? sql`SELECT b.instrument_id,b.period,b.as_of_date::text AS as_of_date,b.target_date::text AS target_date,b.market_date::text AS market_date,b.price::text AS price,b.status
      FROM ticker_period_baselines b JOIN portfolios o ON o.id=b.portfolio_id WHERE o.kinde_subject=${user} AND b.instrument_id=${options.detailId}::uuid`
    : Promise.resolve([]);
  const chargesPromise = sql`SELECT EXISTS(SELECT 1 FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.notes='Imported purchase; fees and taxes were not supplied.') AS missing`;
  const [
    instruments,
    baselines,
    chargeRows,
    dashboardTransactions,
    dailyPrices,
  ] = await Promise.all([
    pricesPromise,
    baselinesPromise,
    chargesPromise,
    options.view === "dashboard"
      ? readTransactions(user)
      : Promise.resolve(null),
    options.view === "dashboard"
      ? sql`SELECT d.instrument_id,d.market_date::text AS market_date,d.price::text AS price,d.provider_symbol FROM daily_closing_prices d JOIN portfolios p ON p.id=d.portfolio_id WHERE p.kinde_subject=${user} ORDER BY d.market_date`
      : Promise.resolve([]),
  ]);
  const chargesMissing = Boolean(chargeRows[0]?.missing);
  let transactions: Awaited<ReturnType<typeof readTransactions>> = [];
  let total = 0;
  let summaries: {
    id: string;
    quantity: string;
    cost: string;
    latest: string;
  }[] = [];
  let history: Array<
    ReturnType<typeof dailyPortfolioHistory>[number] & { alternate: boolean }
  > = [];
  if (options.view === "dashboard") {
    const all = dashboardTransactions ?? [];
    const positions = new Map<
      string,
      { quantity: Decimal; cost: Decimal; latest: string }
    >();
    const latestTrades = new Map<string, string>();
    for (const t of all) {
      if (!latestTrades.has(t.instrument_id))
        latestTrades.set(t.instrument_id, t.transaction_date);
      if (t.type !== "BUY") continue;
      const lot = remainingLot(
        t as unknown as Parameters<typeof remainingLot>[0],
      );
      if (lot.remaining.lte(0)) continue;
      const current = positions.get(t.instrument_id) ?? {
        quantity: new Decimal(0),
        cost: new Decimal(0),
        latest: "",
      };
      current.quantity = current.quantity.plus(lot.remaining);
      current.cost = current.cost.plus(lot.cost);
      if (t.transaction_date > current.latest)
        current.latest = t.transaction_date;
      positions.set(t.instrument_id, current);
    }
    summaries = [...positions].map(([id, p]) => ({
      id,
      quantity: p.quantity.toString(),
      cost: p.cost.toString(),
      latest: latestTrades.get(id) ?? p.latest,
    }));
    const liveQuotes = instruments.flatMap((instrument) =>
      instrument.price && instrument.market_date === options.asOf
        ? [
            {
              instrument_id: instrument.id,
              market_date: options.asOf,
              price: instrument.price,
            },
          ]
        : [],
    );
    const alternateDates = new Set(
      dailyPrices
        .filter(
          (price) =>
            typeof price.provider_symbol === "string" &&
            price.provider_symbol.startsWith("BSE:"),
        )
        .map((price) => price.market_date as string),
    );
    history = dailyPortfolioHistory(
      all as unknown as Parameters<typeof dailyPortfolioHistory>[0],
      [...dailyPrices, ...liveQuotes] as unknown as Parameters<
        typeof dailyPortfolioHistory
      >[1],
    ).map((point) => ({ ...point, alternate: alternateDates.has(point.date) }));
    transactions = all.slice(0, 5);
  } else if (options.view === "transactions") {
    const [counts, rows] = await sql.transaction([
      sql`SELECT COUNT(*)::int AS total FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.type IN ('BUY','SELL')`,
      sql`SELECT t.id,t.instrument_id,t.type,t.transaction_date::text AS transaction_date,t.quantity::text AS quantity,t.unit_price::text AS unit_price,t.fees::text AS fees,t.taxes::text AS taxes,0::text AS sold,0::text AS allocated_cost,NULL::text AS sale_cost,(t.notes='Imported purchase; fees and taxes were not supplied.') AS charges_missing
      FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id
      LEFT JOIN price_observations p ON p.portfolio_id=t.portfolio_id AND p.instrument_id=t.instrument_id AND p.source='FYERS' AND p.interval_type='QUOTE'
      WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.type IN ('BUY','SELL')
      ORDER BY CASE WHEN ${options.sort}='value' THEN t.quantity*p.price END DESC NULLS LAST, t.transaction_date DESC,t.sequence DESC,t.id DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    ]);
    total = Number(counts[0]?.total ?? 0);
    transactions = rows;
  } else if (!details || validDetail) {
    let ids: string[] = validDetail ? [options.detailId!] : [];
    if (!details) {
      const rows = await sql`WITH allocations AS (
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
        ORDER BY CASE WHEN ${options.sort}='value' THEN x.quantity*p.price END DESC NULLS LAST, CASE WHEN ${options.sort}='date' THEN x.latest END DESC, i.trading_symbol ASC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      ) SELECT (SELECT COUNT(*)::int FROM positions) AS total, COALESCE(json_agg(ordered.instrument_id) FILTER (WHERE ordered.instrument_id IS NOT NULL),'[]'::json) AS ids FROM ordered`;
      total = Number(rows[0]?.total ?? 0);
      ids = rows[0]?.ids ?? [];
    }
    if (ids.length)
      transactions =
        await sql`SELECT t.id,t.instrument_id,t.type,t.transaction_date::text AS transaction_date,t.sequence,t.quantity::text AS quantity,t.unit_price::text AS unit_price,t.fees::text AS fees,t.taxes::text AS taxes,(t.notes='Imported purchase; fees and taxes were not supplied.') AS charges_missing,
      COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS sold,
      COALESCE((SELECT SUM(a.allocated_cost) FROM sale_allocations a WHERE a.portfolio_id=t.portfolio_id AND a.buy_transaction_id=t.id),0)::text AS allocated_cost,NULL::text AS sale_cost
      FROM investment_transactions t JOIN portfolios o ON o.id=t.portfolio_id
      WHERE o.kinde_subject=${user} AND t.voided_at IS NULL AND t.instrument_id = ANY(${ids}::uuid[]) AND t.type IN ('BUY','SELL')
      ORDER BY t.transaction_date DESC,t.sequence DESC,t.id DESC`;
  }
  if (
    options.view !== "dashboard" &&
    !details &&
    page > Math.max(1, Math.ceil(total / PAGE_SIZE))
  ) {
    return readPortfolio({
      ...options,
      page: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  }
  return {
    instruments,
    transactions,
    baselines,
    summaries,
    history,
    chargesMissing,
    total,
    page,
  };
}
