import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { parse } from "lossless-json";
import {
  historyResponseStatus,
  missingHistoryRange,
  fallbackHistoryRange,
  splitReturnedCoverage,
} from "../../domain/daily-history-sync";
import { marketDate, numberText } from "../../domain/market-data";
import Decimal from "decimal.js";
import { bseSymbolForIsin } from "../../domain/fyers-symbol-master";
import { getToken, owner } from "../fyers/session";
import { database } from "../portfolio/ledger";
import { reserveSlot } from "./fyers";

type Candidate = {
  id: string;
  symbol: string;
  isin: string | null;
  first: string;
  last: string | null;
  coverage: { start: string; end: string }[];
  first_primary_saved: string | null;
  alternate_coverage: { start: string; end: string; symbol: string }[];
};
export async function syncDailyHistory() {
  const user = await owner();
  const token = user ? await getToken(user) : null;
  const appId = process.env.FYERS_APP_ID;
  if (!user || !token || !appId) return "reconnect" as const;
  const sql = database();
  const lease = randomUUID();
  let acquired = false;
  try {
    const claim =
      await sql`INSERT INTO daily_history_sync_leases(portfolio_id,lease_id,expires_at)
      SELECT id,${lease}::uuid,now()+interval '45 seconds' FROM portfolios WHERE kinde_subject=${user}
      ON CONFLICT (portfolio_id) DO UPDATE SET lease_id=EXCLUDED.lease_id,expires_at=EXCLUDED.expires_at
      WHERE daily_history_sync_leases.expires_at < now() RETURNING portfolio_id`;
    if (!claim.length) return "busy" as const;
    acquired = true;
    const rows =
      await sql`SELECT i.id,i.fyers_symbol AS symbol,i.isin,(MIN(t.transaction_date) FILTER (WHERE t.type='BUY'))::text AS first,
      CASE WHEN SUM(CASE WHEN t.type='BUY' THEN t.quantity ELSE -t.quantity END)=0 THEN MAX(t.transaction_date)::text ELSE NULL END AS last,
      COALESCE((SELECT json_agg(json_build_object('start',c.start_date::text,'end',c.end_date::text)) FROM daily_history_coverage c WHERE c.portfolio_id=i.portfolio_id AND c.instrument_id=i.id AND (c.status='COMPLETE' OR c.checked_at>now()-interval '1 day' OR EXISTS (SELECT 1 FROM daily_history_alternate_coverage a WHERE a.portfolio_id=c.portfolio_id AND a.instrument_id=c.instrument_id AND a.status='COMPLETE' AND a.start_date<=c.start_date AND a.end_date>=c.end_date))),'[]'::json) AS coverage,
      (SELECT MIN(d.market_date)::text FROM daily_closing_prices d WHERE d.portfolio_id=i.portfolio_id AND d.instrument_id=i.id AND (d.provider_symbol IS NULL OR d.provider_symbol NOT LIKE 'BSE:%')) AS first_primary_saved
      ,COALESCE((SELECT json_agg(json_build_object('start',a.start_date::text,'end',a.end_date::text,'symbol',a.provider_symbol)) FROM daily_history_alternate_coverage a WHERE a.portfolio_id=i.portfolio_id AND a.instrument_id=i.id AND (a.status='COMPLETE' OR a.checked_at>now()-interval '1 day')),'[]'::json) AS alternate_coverage
      FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id JOIN investment_transactions t ON t.portfolio_id=i.portfolio_id AND t.instrument_id=i.id
      WHERE p.kinde_subject=${user} AND i.asset_type='STOCK' AND i.fyers_symbol IS NOT NULL AND t.type IN ('BUY','SELL') AND t.voided_at IS NULL
      GROUP BY i.id HAVING MIN(t.transaction_date) FILTER (WHERE t.type='BUY') IS NOT NULL ORDER BY i.id`;
    const now = new Date();
    const today = marketDate(Math.floor(now.getTime() / 1000));
    const last = new Date(`${today}T00:00:00Z`);
    // Request only prior days; today's close is fetched on the next market date.
    last.setUTCDate(last.getUTCDate() - 1);
    while (last.getUTCDay() === 0 || last.getUTCDay() === 6)
      last.setUTCDate(last.getUTCDate() - 1);
    const lastDay = last.toISOString().slice(0, 10);
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCFullYear(limit.getUTCFullYear() - 5);
    const earliest = limit.toISOString().slice(0, 10);
    const candidates = rows as unknown as Candidate[];
    const choices = candidates
      .flatMap((r) => {
        const range = missingHistoryRange(
          r.first > earliest ? r.first : earliest,
          r.last && r.last < lastDay ? r.last : lastDay,
          r.coverage,
          [],
        );
        return range ? [{ ...r, range, alternate: false }] : [];
      })
      .sort((a, b) => b.range.end.localeCompare(a.range.end));
    let choice: (typeof choices)[number] | undefined;
    for (const candidate of choices) {
      const saved =
        await sql`SELECT market_date::text AS date FROM daily_closing_prices WHERE portfolio_id=(SELECT id FROM portfolios WHERE kinde_subject=${user}) AND instrument_id=${candidate.id}::uuid AND market_date BETWEEN ${candidate.range.start}::date AND ${candidate.range.end}::date`;
      const range = missingHistoryRange(
        candidate.range.start,
        candidate.range.end,
        [],
        saved.map((row) => String(row.date)),
      );
      if (range) {
        choice = { ...candidate, range };
        break;
      }
    }
    if (!choice) {
      const hasPossibleGap = candidates.some(
        (r) =>
          r.isin &&
          (!r.first_primary_saved ||
            Date.parse(r.first_primary_saved) - Date.parse(r.first) >
              7 * 86400000),
      );
      if (hasPossibleGap) {
        const masterResponse = await fetch(
          "https://public.fyers.in/sym_details/BSE_CM.csv",
          { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000) },
        );
        if (!masterResponse.ok) return "unavailable" as const;
        const master = await masterResponse.text();
        for (const candidate of candidates) {
          if (!candidate.isin) continue;
          const symbol = bseSymbolForIsin(master, candidate.isin);
          if (!symbol) continue;
          const range = fallbackHistoryRange(
            candidate.first > earliest ? candidate.first : earliest,
            candidate.last && candidate.last < lastDay
              ? candidate.last
              : lastDay,
            candidate.first_primary_saved,
            candidate.alternate_coverage.filter(
              (entry) => entry.symbol === symbol,
            ),
            [],
          );
          if (range) {
            const saved =
              await sql`SELECT market_date::text AS date FROM daily_closing_prices WHERE portfolio_id=(SELECT id FROM portfolios WHERE kinde_subject=${user}) AND instrument_id=${candidate.id}::uuid AND market_date BETWEEN ${range.start}::date AND ${range.end}::date`;
            const missing = missingHistoryRange(
              range.start,
              range.end,
              [],
              saved.map((row) => String(row.date)),
            );
            if (missing) {
              choice = {
                ...candidate,
                symbol,
                range: missing,
                alternate: true,
              };
              break;
            }
          }
        }
      }
    }
    if (!choice) {
      const gaps =
        await sql`SELECT EXISTS(SELECT 1 FROM daily_history_coverage c JOIN portfolios p ON p.id=c.portfolio_id WHERE p.kinde_subject=${user} AND c.status='UNAVAILABLE' AND NOT EXISTS (SELECT 1 FROM daily_history_alternate_coverage a WHERE a.portfolio_id=c.portfolio_id AND a.instrument_id=c.instrument_id AND a.status='COMPLETE' AND a.start_date<=c.start_date AND a.end_date>=c.end_date)) OR EXISTS(SELECT 1 FROM daily_history_alternate_coverage a JOIN portfolios p ON p.id=a.portfolio_id WHERE p.kinde_subject=${user} AND a.status='UNAVAILABLE') AS missing`;
      return gaps[0]?.missing ? ("partial" as const) : ("complete" as const);
    }
    const key = createHash("sha256").update(appId).digest("hex");
    if (!(await reserveSlot(key))) return "throttled" as const;
    const params = new URLSearchParams({
      symbol: choice.symbol,
      resolution: "D",
      date_format: "1",
      range_from: choice.range.start,
      range_to: choice.range.end,
      cont_flag: "0",
    });
    const response = await fetch(
      `https://api-t1.fyers.in/data/history?${params}`,
      {
        headers: { Authorization: `${appId}:${token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.status === 429) {
      await sql`UPDATE fyers_rate_limits SET next_allowed_at=GREATEST(next_allowed_at,now()+interval '60 seconds') WHERE app_key=${key}`;
      return "throttled" as const;
    }
    if (response.status === 401 || response.status === 403)
      return "reconnect" as const;
    if (!response.ok) return "unavailable" as const;
    const result = parse(await response.text()) as {
      s?: string;
      code?: unknown;
      candles?: unknown[][];
    };
    const responseStatus = historyResponseStatus(result);
    if (responseStatus === "error")
      return ["-8", "-15", "-16", "-17"].includes(numberText(result.code) || "")
        ? ("reconnect" as const)
        : ("unavailable" as const);
    if (responseStatus === "unavailable") {
      if (choice.alternate) {
        const checked =
          await sql`INSERT INTO daily_history_alternate_coverage(portfolio_id,instrument_id,provider_symbol,start_date,end_date,status)
          SELECT i.portfolio_id,i.id,${choice.symbol},${choice.range.start}::date,${choice.range.end}::date,'UNAVAILABLE' FROM instruments i
          JOIN portfolios p ON p.id=i.portfolio_id JOIN daily_history_sync_leases l ON l.portfolio_id=p.id AND l.lease_id=${lease}::uuid AND l.expires_at>now()
          WHERE p.kinde_subject=${user} AND i.id=${choice.id}::uuid
          ON CONFLICT(portfolio_id,instrument_id,provider_symbol,start_date,end_date) DO UPDATE SET status='UNAVAILABLE',checked_at=now() WHERE daily_history_alternate_coverage.status='UNAVAILABLE' RETURNING 1`;
        return checked.length ? ("updated" as const) : ("busy" as const);
      }
      const checked =
        await sql`INSERT INTO daily_history_coverage(portfolio_id,instrument_id,start_date,end_date,status)
        SELECT i.portfolio_id,i.id,${choice.range.start}::date,${choice.range.end}::date,'UNAVAILABLE' FROM instruments i
        JOIN portfolios p ON p.id=i.portfolio_id JOIN daily_history_sync_leases l ON l.portfolio_id=p.id AND l.lease_id=${lease}::uuid AND l.expires_at>now()
        WHERE p.kinde_subject=${user} AND i.id=${choice.id}::uuid
        ON CONFLICT (portfolio_id,instrument_id,start_date,end_date) DO UPDATE SET status='UNAVAILABLE',checked_at=now()
        WHERE daily_history_coverage.status='UNAVAILABLE' RETURNING 1`;
      return checked.length ? ("updated" as const) : ("busy" as const);
    }
    if (!Array.isArray(result.candles)) return "unavailable" as const;
    const candles: { date: string; price: string }[] = [];
    for (const c of result.candles) {
      const timestamp = numberText(c[0]);
      const raw = numberText(c[4]);
      if (!timestamp || !/^\d{1,10}$/.test(timestamp) || !raw)
        return "unavailable" as const;
      const date = marketDate(Number(timestamp));
      const price = new Decimal(raw);
      if (
        date < choice.range.start ||
        date > choice.range.end ||
        !price.isFinite() ||
        price.lte(0) ||
        price.gte("10000000000000000") ||
        price.decimalPlaces() > 8
      )
        return "unavailable" as const;
      candles.push({ date, price: price.toFixed() });
    }
    const coverage = splitReturnedCoverage(
      choice.range.start,
      choice.range.end,
      candles.map((c) => c.date),
    );
    // Insert prices and coverage atomically only while this worker still owns the lease.
    const written = await sql`WITH valid AS (
      SELECT i.portfolio_id,i.id FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id
      JOIN daily_history_sync_leases l ON l.portfolio_id=p.id AND l.lease_id=${lease}::uuid AND l.expires_at>now()
      WHERE p.kinde_subject=${user} AND i.id=${choice.id}::uuid
    ), prices AS (
      INSERT INTO daily_closing_prices(portfolio_id,instrument_id,market_date,price,adjustment_basis,provider_symbol)
      SELECT valid.portfolio_id,valid.id,c.date::date,c.price::numeric,'UNKNOWN',${choice.symbol} FROM valid CROSS JOIN jsonb_to_recordset(${JSON.stringify(candles)}::jsonb) AS c(date text,price text)
      ON CONFLICT DO NOTHING RETURNING 1
    ), covered AS (
      INSERT INTO daily_history_coverage(portfolio_id,instrument_id,start_date,end_date,status)
      SELECT valid.portfolio_id,valid.id,c.start::date,c."end"::date,c.status FROM valid CROSS JOIN jsonb_to_recordset(${JSON.stringify(coverage)}::jsonb) AS c(start text,"end" text,status text) WHERE NOT ${choice.alternate}
      ON CONFLICT (portfolio_id,instrument_id,start_date,end_date) DO UPDATE SET status=excluded.status,checked_at=now() RETURNING 1
    ), alternate AS (
      INSERT INTO daily_history_alternate_coverage(portfolio_id,instrument_id,provider_symbol,start_date,end_date,status)
      SELECT valid.portfolio_id,valid.id,${choice.symbol},c.start::date,c."end"::date,c.status FROM valid CROSS JOIN jsonb_to_recordset(${JSON.stringify(coverage)}::jsonb) AS c(start text,"end" text,status text) WHERE ${choice.alternate}
      ON CONFLICT (portfolio_id,instrument_id,provider_symbol,start_date,end_date) DO UPDATE SET status=excluded.status,checked_at=now() RETURNING 1
    ) SELECT EXISTS(SELECT 1 FROM covered) OR EXISTS(SELECT 1 FROM alternate) AS ok`;
    return written[0]?.ok ? ("updated" as const) : ("busy" as const);
  } catch {
    return "unavailable" as const;
  } finally {
    if (acquired)
      await sql`DELETE FROM daily_history_sync_leases WHERE lease_id=${lease}::uuid`.catch(
        () => {},
      );
  }
}
