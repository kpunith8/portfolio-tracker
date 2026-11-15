"use server";

import { revalidatePath } from "next/cache";
import { subject } from "../../server/auth/subject";
import { database } from "../../server/db/database";
import {
  readDividends,
  readExistingDividendRows,
} from "../../server/portfolio/dividends";
import { isUuid } from "../../domain/identifier-utils";
import {
  classifyDividendRows,
  parseDividendStatement,
  type DividendImportStatus,
  type DividendRow,
} from "../../domain/dividends";

export async function getDividendReport(): Promise<{
  rows?: DividendRow[];
  error?: string;
}> {
  try {
    return { rows: await readDividends() };
  } catch {
    return { error: "Could not load dividend records. Please try again." };
  }
}

export async function previewDividendPdf(form: FormData): Promise<{
  rows?: DividendRow[];
  statuses?: DividendImportStatus[];
  error?: string;
}> {
  const user = await subject();

  const file = form.get("statement");

  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 4_000_000 ||
    !file.name.toLowerCase().endsWith(".pdf")
  )
    return { error: "Choose a PDF statement smaller than 4 MB." };
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useSystemFonts: true,
    });

    try {
      const pdf = await task.promise;

      if (pdf.numPages > 30)
        return { error: "Statement must contain no more than 30 pages." };

      let text = "";

      for (let n = 1; n <= pdf.numPages; n++) {
        const content = await (await pdf.getPage(n)).getTextContent();

        for (const item of content.items)
          if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
        text += "\n";
        if (text.length > 500_000) throw new Error("Statement is too large.");
      }

      const rows = parseDividendStatement(text);

      try {
        const existing = await readExistingDividendRows(user, rows);

        return { rows, statuses: classifyDividendRows(rows, existing) };
      } catch {
        return {
          error:
            "Could not check existing dividends. Check the database connection and try again.",
        };
      }
    } finally {
      await task.destroy();
    }
  } catch (error) {
    return {
      error:
        error instanceof Error && /statement|dividend|date/i.test(error.message)
          ? error.message
          : "Could not read this statement. Check that it is a supported text-based dividend PDF.",
    };
  }
}

export async function saveDividendRows(
  rows: DividendRow[],
  requestId: string,
): Promise<{ inserted?: number; error?: string }> {
  const user = await subject();

  if (
    !isUuid(requestId) ||
    !Array.isArray(rows) ||
    rows.length < 1 ||
    rows.length > 1000
  )
    return { error: "Check the import and try again." };

  const valid = rows.every(
    (r) =>
      r &&
      typeof r.company === "string" &&
      r.company.trim().length > 0 &&
      r.company.length <= 200 &&
      typeof r.isin === "string" &&
      /^IN[A-Z0-9]{10}$/.test(r.isin) &&
      typeof r.exDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.exDate) &&
      [r.shares, r.perShare, r.netAmount].every(
        (v) => typeof v === "string" && /^\d{1,16}(\.\d{1,8})?$/.test(v),
      ),
  );

  if (!valid) return { error: "Check the dividend rows and try again." };

  const payload = rows.map(
    ({ company, isin, exDate, shares, perShare, netAmount }) => ({
      company,
      isin,
      exDate,
      shares,
      perShare,
      netAmount,
    }),
  );

  try {
    const sql = database();
    const result =
      await sql`SELECT import_portfolio_dividends(${user}, ${requestId}::uuid, ${JSON.stringify(payload)}::jsonb) AS inserted`;

    revalidatePath("/dashboard");

    return { inserted: Number(result[0].inserted) };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message.includes("DIVIDEND_CONFLICT")
          ? "An entry with the same ISIN and ex-date has different values. Nothing was imported; review the statement."
          : "Could not save the statement. Retry the same import without changing it.",
    };
  }
}
