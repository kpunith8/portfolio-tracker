"use server";
import { revalidatePath, updateTag } from "next/cache";
import {
  database,
  ledgerCacheTag,
  subject,
} from "../../server/portfolio/ledger";

type Result = { error?: string; success?: boolean };
export async function recordTrade(
  _state: Result,
  form: FormData,
): Promise<Result> {
  const type = String(form.get("type") || "");
  const instrument = String(form.get("instrument") || "");
  const symbol = String(form.get("symbol") || "")
    .trim()
    .toUpperCase();
  const quantity = String(form.get("quantity") || "").trim();
  const price = String(form.get("price") || "").trim();
  const date = String(form.get("date") || "");
  const lot = String(form.get("lot") || "");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!/^\d{1,18}$/.test(quantity) || /^0+$/.test(quantity))
    return { error: "Enter a positive whole-number quantity." };
  if (
    !["BUY", "SELL"].includes(type) ||
    (instrument && !uuid.test(instrument)) ||
    (lot && !uuid.test(lot)) ||
    (!instrument && (type !== "BUY" || !/^[A-Z0-9&-]{1,30}$/.test(symbol))) ||
    !/^\d{1,16}(\.\d{1,8})?$/.test(price) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return { error: "Check the ticker, date, quantity and price." };
  try {
    const user = await subject();
    const sql = database();
    await sql`SELECT record_portfolio_trade(${user},${type},${instrument || null}::uuid,${symbol || null},${quantity}::numeric,${price}::numeric,${date}::date,${lot || null}::uuid)`;
    updateTag(ledgerCacheTag(user));
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.includes("FIFO_OLDEST_FIRST"))
      return {
        error:
          "Sales are applied to the oldest available purchase first. Select the oldest purchase.",
      };
    if (
      message.includes("LOT_QUANTITY_EXCEEDED") ||
      message.includes("INSUFFICIENT_SHARES")
    )
      return { error: "The sale exceeds the available shares." };
    if (message.includes("BACKDATED_REPLAY_REQUIRED"))
      return {
        error:
          "This date precedes a recorded sale. Backdated changes need ledger replay, which is not available yet.",
      };
    if (message.includes("INVALID_TRADE"))
      return {
        error:
          "Enter a valid, non-future date and a positive whole-number quantity.",
      };
    return {
      error:
        "Could not save this transaction. Check your portfolio and try again.",
    };
  }
}
