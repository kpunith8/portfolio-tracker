"use server";

import { revalidatePath } from "next/cache";
import { subject } from "../../server/auth/subject";
import { database } from "../../server/db/database";
import { isUuid } from "../../domain/identifier-utils";
import { marketDate } from "../../domain/market-date-utils";
import {
  validManualAmount,
  validManualDate,
  validateManualPurchase,
  type ManualAssetType,
  type ManualPurchase,
} from "../../domain/manual-assets";

export async function saveManualAssets(
  type: ManualAssetType,
  rows: ManualPurchase[],
  requestId: string,
  source: "MANUAL" | "CSV",
) {
  if (
    !["MUTUAL_FUND", "DEBT_OTHER"].includes(type) ||
    !["MANUAL", "CSV"].includes(source) ||
    !isUuid(requestId) ||
    !Array.isArray(rows) ||
    rows.length < 1 ||
    rows.length > 1000
  )
    return { error: "Check your entries." };

  const today = marketDate(Date.now() / 1000);

  for (const row of rows) {
    const error = validateManualPurchase(type, row, today);

    if (error) return { error };
  }

  try {
    const user = await subject();
    const sql = database();

    await sql`SELECT import_manual_assets(${user},${requestId}::uuid,${type},${JSON.stringify(rows)}::jsonb,${source})`;
    revalidatePath("/dashboard");

    return { success: true };
  } catch {
    return {
      error:
        "Could not confirm the save. Retry without changing the entries to check safely.",
    };
  }
}

export async function saveManualObservation(
  instrument: string,
  kind: "NAV" | "INTEREST",
  date: string,
  amount: string,
  requestId: string,
) {
  if (
    !isUuid(instrument) ||
    !isUuid(requestId) ||
    !["NAV", "INTEREST"].includes(kind) ||
    typeof date !== "string" ||
    !validManualDate(date, marketDate(Date.now() / 1000)) ||
    typeof amount !== "string" ||
    !validManualAmount(amount, true)
  )
    return { error: "Enter a valid date and positive amount." };
  try {
    const user = await subject();
    const sql = database();

    await sql`SELECT record_manual_observation(${user},${requestId}::uuid,${instrument}::uuid,${kind},${date}::date,${amount}::numeric)`;
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(
        "price_observations_portfolio_id_instrument_id_source_interval",
      )
    )
      return {
        error:
          "A NAV is already recorded for this date. Enter a different date.",
      };

    return {
      error:
        "Could not confirm the save. Retry without changing the entry to check safely.",
    };
  }
}

export async function saveDebtInterest(
  purchase: string,
  date: string,
  amount: string,
  requestId: string,
) {
  if (
    !isUuid(purchase) ||
    !isUuid(requestId) ||
    !validManualDate(date, marketDate(Date.now() / 1000)) ||
    !validManualAmount(amount, true)
  )
    return { error: "Enter a valid date and positive amount." };
  try {
    const user = await subject();
    const sql = database();

    await sql`SELECT record_debt_interest(${user},${requestId}::uuid,${purchase}::uuid,${date}::date,${amount}::numeric)`;
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("INVALID_PURCHASE"))
      return { error: "Credit date must be on or after the purchase date." };

    return {
      error: "Could not confirm the save. Retry without changing the entry.",
    };
  }
}

export async function deleteDebtPurchase(purchase: string) {
  if (!isUuid(purchase)) return { error: "Purchase not found." };
  try {
    const user = await subject();
    const sql = database();

    await sql`SELECT void_debt_purchase(${user},${purchase}::uuid)`;
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("INTEREST_EXISTS"))
      return {
        error:
          "This purchase has linked or unallocated interest credits and cannot be deleted.",
      };

    return { error: "Could not delete the purchase. Refresh and try again." };
  }
}
