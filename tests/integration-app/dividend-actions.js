"use server";

import { cookies } from "next/headers";
import { readDividends } from "./dividends";

export async function getDividendReport() {
  const cookieStore = await cookies();

  if (cookieStore.get("fixture-dividend-load-error")?.value === "1")
    return { error: "Could not load dividend records. Please try again." };

  return { rows: await readDividends() };
}

export async function previewDividendPdf(form) {
  const file = form.get("statement");
  const status =
    file?.name === "duplicate.pdf"
      ? "duplicate"
      : file?.name === "conflict.pdf"
        ? "conflict"
        : "new";

  return {
    rows: [
      {
        company: "TEST LTD",
        isin: "INE123A01012",
        exDate: "2025-06-15",
        shares: "10",
        perShare: "2",
        netAmount: "20",
        symbol: null,
      },
    ],
    statuses: [status],
  };
}

export async function saveDividendRows(rows) {
  (await cookies()).set("fixture-dividend-saved", "1");

  return { inserted: rows.length };
}
