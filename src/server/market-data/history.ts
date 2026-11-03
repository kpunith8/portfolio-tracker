import "server-only";
import { createHash } from "node:crypto";
import { parse } from "lossless-json";
import { database } from "../portfolio/ledger";
import { getToken, owner } from "../fyers/session";
import { reserveSlot } from "./fyers";
import {
  marketDate,
  numberText,
  priorClose,
  targetDate,
  type Period,
} from "../../domain/market-data";

export async function refreshBaseline(instrumentId: string, period: Period) {
  const user = await owner();
  const token = user ? await getToken(user) : null;
  const appId = process.env.FYERS_APP_ID;
  if (!user || !token || !appId) return "reconnect" as const;
  const sql = database();
  try {
    const rows =
      await sql`SELECT i.fyers_symbol,b.as_of_date::text AS as_of_date,b.status FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id
      LEFT JOIN ticker_period_baselines b ON b.portfolio_id=i.portfolio_id AND b.instrument_id=i.id AND b.period=${period}
      WHERE p.kinde_subject=${user} AND i.id=${instrumentId}::uuid AND i.is_active AND i.asset_type='STOCK'`;
    if (!rows.length || !rows[0].fyers_symbol) return "unavailable" as const;
    const asOf = marketDate(Math.floor(Date.now() / 1000));
    if (rows[0].as_of_date === asOf && rows[0].status === "AVAILABLE")
      return "cached" as const;
    const key = createHash("sha256").update(appId).digest("hex");
    if (!(await reserveSlot(key))) return "throttled" as const;
    const target = targetDate(asOf, period);
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
    const response = await fetch(
      `https://api-t1.fyers.in/data/history?${query}`,
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
    if (result.s !== "ok")
      return ["-8", "-15", "-16", "-17"].includes(numberText(result.code) || "")
        ? ("reconnect" as const)
        : ("unavailable" as const);
    if (!Array.isArray(result.candles)) return "unavailable" as const;
    const chosen = priorClose(
      result.candles,
      target,
      Math.floor(Date.now() / 1000),
    );
    if (!chosen) return "unavailable" as const;
    await sql`INSERT INTO ticker_period_baselines(portfolio_id,instrument_id,period,as_of_date,target_date,market_date,price,status,adjustment_basis,checked_at)
      SELECT i.portfolio_id,i.id,${period},${asOf}::date,${target}::date,${chosen.day}::date,${chosen.price}::numeric,'AVAILABLE','UNKNOWN',${requestedAt}::timestamptz
      FROM instruments i JOIN portfolios p ON p.id=i.portfolio_id WHERE i.id=${instrumentId}::uuid AND p.kinde_subject=${user}
      ON CONFLICT(portfolio_id,instrument_id,period) DO UPDATE SET as_of_date=excluded.as_of_date,target_date=excluded.target_date,market_date=excluded.market_date,price=excluded.price,status=excluded.status,adjustment_basis=excluded.adjustment_basis,checked_at=excluded.checked_at
      WHERE ticker_period_baselines.as_of_date < excluded.as_of_date OR
        (ticker_period_baselines.as_of_date = excluded.as_of_date AND ticker_period_baselines.checked_at <= excluded.checked_at)`;
    return "updated" as const;
  } catch {
    return "unavailable" as const;
  }
}
