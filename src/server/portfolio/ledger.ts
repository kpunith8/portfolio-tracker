import {
  listLedgerTransactions,
  listInstruments,
  listBaselines,
  findMissingCharges,
  listDailyPrices,
  listTransactionPage,
  listHoldingIds,
  listInstrumentTransactions,
} from "./queries";
import { portfolioPage, portfolioPageCount } from "../../domain/pagination";
import { isUuid } from "../../domain/identifier-utils";
import "server-only";
import { database } from "../db/database";
import { subject } from "../auth/subject";
import Decimal from "decimal.js";
import { remainingLot } from "../../domain/holdings";
import { dailyPortfolioHistory } from "../../domain/daily-portfolio-history";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { marketDate } from "../../domain/market-data";

export function currentMarketDay() {
  return marketDate(Math.floor(Date.now() / 1000));
}

export function ledgerCacheTag(user: string) {
  return `portfolio-ledger-${createHash("sha256").update(user).digest("hex")}`;
}

async function readTransactions(user: string) {
  const tag = ledgerCacheTag(user);

  return unstable_cache(
    async (ownerId: string) => {
      const sql = database();

      return listLedgerTransactions(sql, ownerId);
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
  liveMarket?: boolean;
  asOf: string;
};

export async function readPortfolio(options: PortfolioReadOptions) {
  const user = await subject();
  const sql = database();
  const { page, offset } = portfolioPage(options.page);
  const details = options.view === "portfolio" && !!options.detailId;
  const validDetail = details && isUuid(options.detailId!);
  const pricesPromise = listInstruments(sql, user);
  const baselinesPromise = validDetail
    ? listBaselines(sql, user, options.detailId!)
    : Promise.resolve([]);
  const chargesPromise = findMissingCharges(sql, user);
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
      ? listDailyPrices(sql, user)
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
    const [counts, rows] = await listTransactionPage(
      sql,
      user,
      options.sort,
      offset,
    );

    total = Number(counts[0]?.total ?? 0);
    transactions = rows;
  } else if (!details || validDetail) {
    let ids: string[] = validDetail ? [options.detailId!] : [];

    if (!details) {
      const rows = await listHoldingIds(
        sql,
        user,
        options.sort,
        options.liveMarket,
        offset,
      );

      total = Number(rows[0]?.total ?? 0);
      ids = rows[0]?.ids ?? [];
    }

    if (ids.length)
      transactions = await listInstrumentTransactions(sql, user, ids);
  }

  if (
    options.view !== "dashboard" &&
    !details &&
    !options.liveMarket &&
    page > portfolioPageCount(total)
  ) {
    return readPortfolio({
      ...options,
      page: portfolioPageCount(total),
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
