"use server";
import {
  deletePurchaseRecord,
  recordTradeEntry,
} from "../../server/portfolio/trade-queries";
import { isUuid } from "../../domain/identifier-utils";
import { revalidatePath, updateTag } from "next/cache";
import { ledgerCacheTag } from "../../server/portfolio/ledger";
import { database } from "../../server/db/database";
import { subject } from "../../server/auth/subject";

type Result = { error?: string; success?: boolean };

export async function deletePurchase(
  _state: Result,
  form: FormData,
): Promise<Result> {
  const id = String(form.get("id") || "");

  if (!isUuid(id)) return { error: "Purchase not found." };
  try {
    const user = await subject();
    const sql = database();

    await deletePurchaseRecord(sql, user, id);
    updateTag(ledgerCacheTag(user));
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("SALE_REPLAY_REQUIRED")
    )
      return {
        error:
          "This purchase has a later recorded sale. It cannot be deleted until sale allocations can be recalculated.",
      };

    return {
      error:
        "Could not delete this purchase. Check your portfolio and try again.",
    };
  }
}

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

  if (!/^\d{1,18}$/.test(quantity) || /^0+$/.test(quantity))
    return { error: "Enter a positive whole-number quantity." };
  if (
    !["BUY", "SELL"].includes(type) ||
    (instrument && !isUuid(instrument)) ||
    (lot && !isUuid(lot)) ||
    (!instrument && (type !== "BUY" || !/^[A-Z0-9&-]{1,30}$/.test(symbol))) ||
    !/^\d{1,16}(\.\d{1,8})?$/.test(price) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return { error: "Check the ticker, date, quantity and price." };
  try {
    const user = await subject();
    const sql = database();

    await recordTradeEntry(
      sql,
      user,
      type,
      instrument || null,
      symbol || null,
      quantity,
      price,
      date,
      lot || null,
    );
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
