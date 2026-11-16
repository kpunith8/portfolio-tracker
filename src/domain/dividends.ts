import Decimal from "decimal.js";
import { accrualPeriod, assessmentYear } from "./tax-report.ts";

export type DividendRow = {
  company: string;
  isin: string;
  exDate: string;
  shares: string;
  perShare: string;
  netAmount: string;
  symbol: string | null;
};

export function parseDividendStatement(text: string): DividendRow[] {
  if (
    !/Company Name\s+ISIN\s+Ex Date\s+Number of Shares\s+Dividend per Share\s+Net Dividend Amount/i.test(
      text,
    )
  )
    throw new Error("This statement format is not supported.");

  const rows: DividendRow[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const pattern =
    /^(.+?)\s+(IN[A-Z0-9]{10})\s+(\d{2})-(\d{2})-(\d{4})\s+(\d+)\s+Rs\.\s*([\d,.]+)\s+Rs\.\s*([\d,.]+)$/i;

  for (const line of lines) {
    if (!/\bIN[A-Z0-9]{10}\b/.test(line)) continue;

    const match = line.match(pattern);

    if (!match)
      throw new Error(
        "A statement row could not be read. No dividends were imported.",
      );

    const [, company, isin, day, month, year, shares, perShare, amount] = match;
    const exDate = `${year}-${month}-${day}`;
    const date = new Date(`${exDate}T00:00:00Z`);

    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== exDate ||
      new Decimal(shares).lte(0)
    )
      throw new Error("Invalid date or share quantity in statement.");
    rows.push({
      company,
      isin: isin.toUpperCase(),
      exDate,
      shares,
      perShare: perShare.replaceAll(",", ""),
      netAmount: amount.replaceAll(",", ""),
      symbol: null,
    });
  }

  const total = text.match(/Total dividend amount\s+Rs\.\s*([\d,.]+)/i);

  if (
    !rows.length ||
    rows.length > 1000 ||
    !total ||
    !rows
      .reduce((sum, row) => sum.plus(row.netAmount), new Decimal(0))
      .eq(total[1].replaceAll(",", ""))
  )
    throw new Error(
      "Statement rows do not reconcile with the printed total. No dividends were imported.",
    );

  return rows;
}

export function dividendReport(rows: DividendRow[]) {
  const byYear = new Map<
    number,
    { rows: DividendRow[]; periods: DividendRow[][] }
  >();
  const byCompany = new Map<string, DividendRow[]>();

  for (const row of rows) {
    const year = assessmentYear(row.exDate);
    let yearGroup = byYear.get(year);

    if (!yearGroup) {
      yearGroup = { rows: [], periods: Array.from({ length: 5 }, () => []) };
      byYear.set(year, yearGroup);
    }

    yearGroup.rows.push(row);
    yearGroup.periods[accrualPeriod(row.exDate)].push(row);

    let companyRows = byCompany.get(row.isin);

    if (!companyRows) {
      companyRows = [];
      byCompany.set(row.isin, companyRows);
    }

    companyRows.push(row);
  }

  const total = (entries: DividendRow[]) =>
    entries
      .reduce((sum, row) => sum.plus(row.netAmount), new Decimal(0))
      .toString();

  const byDate = (a: DividendRow, b: DividendRow) =>
    a.exDate.localeCompare(b.exDate);

  const years = [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, group]) => ({
      year,
      periods: group.periods.map((entries) => {
        entries.sort(byDate);

        return { rows: entries, total: total(entries) };
      }),
      total: total(group.rows),
    }));
  const companies = [...byCompany.entries()]
    .map(([isin, entries]) => {
      entries.sort(byDate);

      return {
        isin,
        company: entries.at(-1)!.company,
        symbol: entries.find((row) => row.symbol)?.symbol ?? null,
        rows: entries,
        total: total(entries),
      };
    })
    .sort((a, b) => new Decimal(b.total).cmp(a.total));

  return { years, companies };
}

export type DividendImportStatus = "new" | "duplicate" | "conflict";

export function classifyDividendRows(
  rows: DividendRow[],
  existing: DividendRow[],
): DividendImportStatus[] {
  const known = new Map(
    existing.map((row) => [`${row.isin}:${row.exDate}`, row]),
  );

  return rows.map((row) => {
    const key = `${row.isin}:${row.exDate}`;
    const prior = known.get(key);

    if (!prior) {
      known.set(key, row);

      return "new";
    }

    return ["shares", "perShare", "netAmount"].every((field) =>
      new Decimal(prior[field as "shares" | "perShare" | "netAmount"]).eq(
        row[field as "shares" | "perShare" | "netAmount"],
      ),
    )
      ? "duplicate"
      : "conflict";
  });
}
