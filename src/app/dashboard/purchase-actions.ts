"use server";

import { revalidatePath, updateTag } from "next/cache";
import { subject } from "../../server/auth/subject";
import { database } from "../../server/db/database";
import { ledgerCacheTag } from "../../server/portfolio/ledger";
import { isUuid } from "../../domain/identifier-utils";
import { marketDate } from "../../domain/market-date-utils";
import type { PurchaseCsvRow } from "../../domain/purchase-csv";

export type SymbolOption = {
  fyersSymbol: string;
  symbol: string;
  exchange: string;
  name: string;
  series: string | null;
};

export type PurchaseRow = PurchaseCsvRow & { fyersSymbol: string };

export async function searchSymbols(query: string): Promise<SymbolOption[]> {
  await subject();

  const term = query.trim().toUpperCase().slice(0, 80);

  if (term.length < 2) return [];

  const safe = term.replace(/[\\%_]/g, "\\$&");
  const sql = database();
  const rows =
    await sql`SELECT fyers_symbol, trading_symbol, exchange, name, series FROM fyers_symbol_catalog
    WHERE upper(trading_symbol) LIKE ${safe + "%"} OR upper(name) LIKE ${"%" + safe + "%"} OR upper(fyers_symbol) = ${term}
    ORDER BY CASE WHEN upper(trading_symbol)=${term} THEN 0 WHEN upper(trading_symbol) LIKE ${safe + "%"} THEN 1 ELSE 2 END, trading_symbol, exchange, fyers_symbol LIMIT 20`;

  return rows.map((r) => ({
    fyersSymbol: r.fyers_symbol,
    symbol: r.trading_symbol,
    exchange: r.exchange,
    name: r.name,
    series: r.series,
  }));
}

export async function resolvePurchaseSymbols(
  rows: PurchaseCsvRow[],
): Promise<(SymbolOption | null)[]> {
  await subject();
  if (!Array.isArray(rows) || rows.length > 1000)
    throw new Error("Too many rows.");

  const keys = rows.map((r) => ({
    symbol: String(r.symbol || "")
      .trim()
      .toUpperCase(),
    exchange: String(r.exchange || "")
      .trim()
      .toUpperCase(),
  }));
  const sql = database();
  const found =
    await sql`SELECT fyers_symbol, trading_symbol, exchange, name, series FROM fyers_symbol_catalog WHERE (exchange, upper(trading_symbol)) IN (SELECT exchange, symbol FROM jsonb_to_recordset(${JSON.stringify(keys)}::jsonb) AS x(exchange text, symbol text))`;
  const grouped = new Map<string, SymbolOption[]>();

  for (const r of found) {
    const key = `${r.exchange}:${r.trading_symbol.toUpperCase()}`;
    const item = {
      fyersSymbol: r.fyers_symbol,
      symbol: r.trading_symbol,
      exchange: r.exchange,
      name: r.name,
      series: r.series,
    };

    grouped.set(key, [...(grouped.get(key) || []), item]);
  }

  return keys.map((r) => {
    const matches = grouped.get(`${r.exchange}:${r.symbol}`) || [];

    return matches.length === 1 ? matches[0] : null;
  });
}

export async function savePurchases(
  rows: PurchaseRow[],
  requestId: string,
  source: "CSV" | "MANUAL",
): Promise<{ success?: boolean; error?: string }> {
  if (
    !isUuid(requestId) ||
    !Array.isArray(rows) ||
    rows.length < 1 ||
    rows.length > 1000 ||
    !["CSV", "MANUAL"].includes(source)
  )
    return { error: "Check the import and try again." };

  const today = marketDate(Date.now() / 1000);

  for (const row of rows) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.symbol !== "string" ||
      typeof row.quantity !== "string" ||
      typeof row.price !== "string" ||
      typeof row.date !== "string" ||
      typeof row.fyersSymbol !== "string" ||
      !/^(NSE|BSE):[A-Z0-9&.:-]{1,80}$/.test(row.fyersSymbol) ||
      !/^\d{1,18}$/.test(row.quantity) ||
      /^0+$/.test(row.quantity) ||
      !/^\d{1,16}(\.\d{1,8})?$/.test(row.price) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      row.date > today ||
      !Number.isFinite(Date.parse(`${row.date}T00:00:00Z`)) ||
      new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date
    )
      return {
        error: `Check the ticker, date, quantity and price for ${row?.symbol || "a row"}.`,
      };
  }

  try {
    const user = await subject();
    const sql = database();

    const catalog =
      await sql`SELECT fyers_symbol FROM fyers_symbol_catalog WHERE fyers_symbol = ANY(${rows.map((row) => row.fyersSymbol)}::text[])`;
    const known = new Set(catalog.map((item) => item.fyers_symbol));
    const missing = rows
      .filter((row) => !known.has(row.fyersSymbol))
      .map((row) => row.symbol);

    if (missing.length)
      return {
        error: `Symbols no longer in the catalog: ${[...new Set(missing)].join(", ")}. Correct or remove those rows.`,
      };
    await sql`SELECT import_portfolio_purchases(${user}, ${requestId}::uuid, ${JSON.stringify(rows)}::jsonb, ${source})`;
    updateTag(ledgerCacheTag(user));
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("BACKDATED_REPLAY_REQUIRED"))
      return {
        error:
          "A purchase date precedes a recorded sale. Remove that row and enter it manually after resolving the sale.",
      };
    if (message.includes("SYMBOL_SERIES_CONFLICT"))
      return {
        error: `Ticker ${message.split("SYMBOL_SERIES_CONFLICT:")[1]?.trim().split(/\s/)[0] || "unknown"} conflicts with an existing investment's trading series. Remove that row and check your existing holdings.`,
      };
    if (message.includes("INVALID_SYMBOL"))
      return {
        error:
          "A ticker is no longer in the symbol catalog. Check the affected rows and try again.",
      };

    return {
      error:
        "Could not confirm the save. Retry without changing the rows to check safely.",
    };
  }
}
