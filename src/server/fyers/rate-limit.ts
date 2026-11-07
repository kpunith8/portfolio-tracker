import "server-only";
import { createHash } from "node:crypto";
import { database } from "../db/database";

export function fyersRateKey(appId: string) {
  return createHash("sha256").update(appId).digest("hex");
}

export async function reserveSlot(key: string) {
  const sql = database();
  const result =
    await sql`INSERT INTO fyers_rate_limits(app_key,next_allowed_at,market_day,requests)
    VALUES (${key},now()+interval '2 seconds',(now() AT TIME ZONE 'Asia/Kolkata')::date,1)
    ON CONFLICT(app_key) DO UPDATE SET next_allowed_at=now()+interval '2 seconds',
      requests=CASE WHEN fyers_rate_limits.market_day=(now() AT TIME ZONE 'Asia/Kolkata')::date THEN fyers_rate_limits.requests+1 ELSE 1 END,
      market_day=(now() AT TIME ZONE 'Asia/Kolkata')::date
    WHERE fyers_rate_limits.next_allowed_at<=now() AND (fyers_rate_limits.market_day<>(now() AT TIME ZONE 'Asia/Kolkata')::date OR fyers_rate_limits.requests<4000)
    RETURNING app_key`;

  return result.length > 0;
}

export async function applyFyersCooldown(key: string) {
  const sql = database();

  await sql`UPDATE fyers_rate_limits SET next_allowed_at=GREATEST(next_allowed_at,now()+interval '60 seconds') WHERE app_key=${key}`;
}
