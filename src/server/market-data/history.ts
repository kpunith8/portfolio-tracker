import {
  findBaseline,
  findCoveredClose,
  saveCoveredBaseline,
  saveFetchedBaseline,
} from "./history-queries";
import "server-only";
import {
  fyersRateKey,
  reserveSlot,
  applyFyersCooldown,
} from "../fyers/rate-limit";
import { fetchFyersData } from "../fyers/request";
import { parse } from "lossless-json";
import { database } from "../db/database";
import { getToken, owner } from "../fyers/session";
import {
  fyersErrorStatus,
  marketDate,
  priorClose,
  targetDate,
  type Period,
} from "../../domain/market-data";

export async function refreshBaseline(instrumentId: string, period: Period) {
  const user = await owner();
  const token = user ? await getToken(user) : null;
  const appId = process.env.FYERS_APP_ID;
  if (!user) return "reconnect" as const;
  const sql = database();
  try {
    const rows = await findBaseline(sql, period, user, instrumentId);
    if (!rows.length || !rows[0].fyers_symbol) return "unavailable" as const;
    const asOf = marketDate(Math.floor(Date.now() / 1000));
    if (rows[0].as_of_date === asOf && rows[0].status === "AVAILABLE")
      return "cached" as const;
    const target = targetDate(asOf, period);
    const cached = await findCoveredClose(sql, user, instrumentId, target);
    if (cached.length) {
      const chosen = cached[0];
      await saveCoveredBaseline(
        sql,
        period,
        asOf,
        target,
        chosen.day,
        chosen.price,
        instrumentId,
        user,
      );
      return "updated" as const;
    }
    if (!token || !appId) return "reconnect" as const;
    const key = fyersRateKey(appId);
    if (!(await reserveSlot(key))) return "throttled" as const;
    const start = new Date(`${target}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 14);
    const query = new URLSearchParams({
      symbol: rows[0].fyers_symbol,
      resolution: "D",
      date_format: "1",
      range_from: start.toISOString().slice(0, 10),
      range_to: target,
      cont_flag: "0",
    });
    const requestedAt = new Date().toISOString();
    const response = await fetchFyersData("history", query, appId, token);
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
    if (result.s !== "ok") return fyersErrorStatus(result.code);
    if (!Array.isArray(result.candles)) return "unavailable" as const;
    const chosen = priorClose(
      result.candles,
      target,
      Math.floor(Date.now() / 1000),
    );
    if (!chosen) return "unavailable" as const;
    await saveFetchedBaseline(
      sql,
      period,
      asOf,
      target,
      chosen.day,
      chosen.price,
      requestedAt,
      instrumentId,
      user,
    );
    return "updated" as const;
  } catch {
    return "unavailable" as const;
  }
}
