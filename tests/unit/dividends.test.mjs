import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDividendStatement,
  dividendReport,
} from "../../src/domain/dividends.ts";

test("parses statement rows exactly and reconciles stated net total", () => {
  const text = `Equity dividends from 01-04-2025 to 31-03-2026\nCompany Name ISIN Ex Date Number of Shares Dividend per Share Net Dividend Amount\nACME LTD INE123A01012 15-06-2025 10 Rs. 2.5 Rs. 25.00\nTotal dividend amount Rs. 25.00`;
  const rows = parseDividendStatement(text);

  assert.equal(rows[0].exDate, "2025-06-15");
  assert.equal(rows[0].netAmount, "25.00");
  assert.throws(() =>
    parseDividendStatement(
      text.replace("amount Rs. 25.00", "amount Rs. 25.01"),
    ),
  );
});

test("groups ex-date estimates by period and company without floating point drift", () => {
  const base = {
    company: "Acme",
    isin: "INE123A01012",
    exDate: "2025-06-15",
    netAmount: "0.10",
    shares: "1",
    perShare: "0.10",
    symbol: null,
  };
  const result = dividendReport([
    base,
    { ...base, exDate: "2025-06-16", netAmount: "0.20" },
  ]);

  assert.equal(result.years[0].total, "0.3");
  assert.equal(result.years[0].periods[0].total, "0.1");
  assert.equal(result.years[0].periods[1].total, "0.2");
  assert.equal(result.companies[0].total, "0.3");
  assert.equal(result.companies[0].rows[0].exDate, "2025-06-15");
});

test("preview distinguishes new, duplicate and conflicting dividends", async () => {
  const { classifyDividendRows } =
    await import("../../src/domain/dividends.ts");
  const row = {
    company: "Acme",
    isin: "INE123A01012",
    exDate: "2025-06-15",
    shares: "10",
    perShare: "2.50",
    netAmount: "25.00",
    symbol: null,
  };
  const existing = {
    ...row,
    shares: "10.0000",
    perShare: "2.5",
    netAmount: "25",
  };

  assert.deepEqual(
    classifyDividendRows(
      [row, { ...row, exDate: "2025-06-16" }, { ...row, netAmount: "26" }],
      [existing],
    ),
    ["duplicate", "new", "conflict"],
  );
  assert.deepEqual(classifyDividendRows([row, row], []), ["new", "duplicate"]);
});

test("groups unsorted dividend records without changing input and preserves totals and company ordering", () => {
  const a = {
    company: "Old name",
    isin: "INE111111111",
    symbol: null,
    exDate: "2025-06-16",
    shares: "1",
    perShare: "0.10",
    netAmount: "0.10",
  };
  const b = {
    ...a,
    company: "New name",
    symbol: "ACME",
    exDate: "2026-03-16",
    netAmount: "0.20",
  };
  const c = {
    ...a,
    company: "Other",
    isin: "INE222222222",
    exDate: "2025-06-15",
    netAmount: "0.40",
  };
  const input = Object.freeze([b, c, a]);
  const report = dividendReport(input);

  assert.equal(report.years[0].total, "0.7");
  assert.deepEqual(
    report.years[0].periods.map((period) => period.total),
    ["0.4", "0.1", "0", "0", "0.2"],
  );
  assert.deepEqual(
    report.companies.map((company) => company.total),
    ["0.4", "0.3"],
  );
  assert.equal(report.companies[1].company, "New name");
  assert.deepEqual(
    report.companies[1].rows.map((row) => row.exDate),
    ["2025-06-16", "2026-03-16"],
  );
  assert.deepEqual(
    input.map((row) => row.exDate),
    ["2026-03-16", "2025-06-15", "2025-06-16"],
  );
});
