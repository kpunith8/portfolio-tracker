import {
  claimHistoryLease,
  listHistoryCandidates,
  listSavedHistoryDates,
  findHistoryGaps,
  saveUnavailableAlternateCoverage,
  saveUnavailableCoverage,
  saveDailyHistory,
  releaseHistoryLease,
} from "./daily-history-queries";
import "server-only";
import {
  fyersRateKey,
  reserveSlot,
  applyFyersCooldown,
} from "../fyers/rate-limit";
import { fetchFyersData } from "../fyers/request";
import { randomUUID } from "node:crypto";
import { parse } from "lossless-json";
import {
  historyResponseStatus,
  missingHistoryRange,
  fallbackHistoryRange,
  splitReturnedCoverage,
} from "../../domain/daily-history-sync";
import {
  fyersErrorStatus,
  marketDate,
  numberText,
} from "../../domain/market-data";
import { validMarketPrice } from "../../domain/price-utils";
import { bseSymbolForIsin } from "../../domain/fyers-symbol-master";
import { getToken, owner } from "../fyers/session";
import { database } from "../db/database";

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
    const claim = await claimHistoryLease(sql, lease, user);
    if (!claim.length) return "busy" as const;
    acquired = true;
    const rows = await listHistoryCandidates(sql, user);
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
      const saved = await listSavedHistoryDates(
        sql,
        user,
        candidate.id,
        candidate.range.start,
        candidate.range.end,
      );
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
            const saved = await listSavedHistoryDates(
              sql,
              user,
              candidate.id,
              range.start,
              range.end,
            );
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
      const gaps = await findHistoryGaps(sql, user);
      return gaps[0]?.missing ? ("partial" as const) : ("complete" as const);
    }
    const key = fyersRateKey(appId);
    if (!(await reserveSlot(key))) return "throttled" as const;
    const params = new URLSearchParams({
      symbol: choice.symbol,
      resolution: "D",
      date_format: "1",
      range_from: choice.range.start,
      range_to: choice.range.end,
      cont_flag: "0",
    });
    const response = await fetchFyersData("history", params, appId, token);
    if (response.status === 429) {
      await applyFyersCooldown(key);
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
    if (responseStatus === "error") return fyersErrorStatus(result.code);
    if (responseStatus === "unavailable") {
      if (choice.alternate) {
        const checked = await saveUnavailableAlternateCoverage(
          sql,
          choice.symbol,
          choice.range.start,
          choice.range.end,
          lease,
          user,
          choice.id,
        );
        return checked.length ? ("updated" as const) : ("busy" as const);
      }
      const checked = await saveUnavailableCoverage(
        sql,
        choice.range.start,
        choice.range.end,
        lease,
        user,
        choice.id,
      );
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
      const price = validMarketPrice(raw);
      if (date < choice.range.start || date > choice.range.end || !price)
        return "unavailable" as const;
      candles.push({ date, price: price.toFixed() });
    }
    const coverage = splitReturnedCoverage(
      choice.range.start,
      choice.range.end,
      candles.map((c) => c.date),
    );
    // Insert prices and coverage atomically only while this worker still owns the lease.
    const written = await saveDailyHistory(
      sql,
      lease,
      user,
      choice.id,
      choice.symbol,
      JSON.stringify(candles),
      JSON.stringify(coverage),
      choice.alternate,
    );
    return written[0]?.ok ? ("updated" as const) : ("busy" as const);
  } catch {
    return "unavailable" as const;
  } finally {
    if (acquired) await releaseHistoryLease(sql, lease).catch(() => {});
  }
}
