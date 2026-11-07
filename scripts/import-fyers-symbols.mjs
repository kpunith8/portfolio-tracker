import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");

const rows = [];

for (const exchange of ["NSE", "BSE"]) {
  const path = new URL(
    `../data/fyers/${exchange}_CM_sym_master.json`,
    import.meta.url,
  );
  const data = JSON.parse(await readFile(path, "utf8"));
  const entries = Object.entries(data);

  if (entries.length < 1000)
    throw new Error(`${exchange} symbol master is incomplete.`);
  for (const [key, value] of entries) {
    if (
      value.symTicker !== key ||
      value.exchangeName !== exchange ||
      !value.exSymbol ||
      !value.symDetails
    )
      throw new Error(`Invalid ${exchange} symbol master record: ${key}`);
    rows.push({
      fyers_symbol: key,
      exchange,
      trading_symbol: value.exSymbol,
      name: value.symDetails,
      isin: value.isin || null,
      series: value.exSeries || null,
      trade_status: value.tradeStatus ?? null,
      source_date: /^\d{4}-\d{2}-\d{2}$/.test(value.lastUpdate)
        ? value.lastUpdate
        : null,
    });
  }
}

const sql = neon(process.env.DATABASE_URL);

// A single statement makes replacement all-or-nothing, including removal of stale entries.
await sql`WITH incoming AS MATERIALIZED (
  SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(fyers_symbol text, exchange text, trading_symbol text, name text, isin text, series text, trade_status integer, source_date date)
), upserted AS (
  INSERT INTO fyers_symbol_catalog(fyers_symbol, exchange, trading_symbol, name, isin, series, trade_status, source_date, refreshed_at)
  SELECT fyers_symbol, exchange, trading_symbol, name, isin, series, trade_status, source_date, now() FROM incoming
  ON CONFLICT (fyers_symbol) DO UPDATE SET exchange=EXCLUDED.exchange, trading_symbol=EXCLUDED.trading_symbol, name=EXCLUDED.name, isin=EXCLUDED.isin, series=EXCLUDED.series, trade_status=EXCLUDED.trade_status, source_date=EXCLUDED.source_date, refreshed_at=EXCLUDED.refreshed_at RETURNING fyers_symbol
), removed AS (
  DELETE FROM fyers_symbol_catalog WHERE NOT EXISTS (SELECT 1 FROM incoming WHERE incoming.fyers_symbol=fyers_symbol_catalog.fyers_symbol) RETURNING fyers_symbol
) SELECT (SELECT count(*) FROM upserted), (SELECT count(*) FROM removed)`;
console.log(`Imported ${rows.length} FYERS cash-market symbols.`);
