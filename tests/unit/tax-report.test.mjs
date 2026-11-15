import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentYear,
  accrualPeriod,
  holdingTerm,
  buildTaxReport,
} from "../../src/domain/tax-report.ts";

test("assessment years and five accrual periods respect boundaries", () => {
  assert.equal(assessmentYear("2025-03-31"), 2025);
  assert.equal(assessmentYear("2025-04-01"), 2026);
  for (const [date, period] of [
    ["2025-06-15", 0],
    ["2025-06-16", 1],
    ["2025-09-15", 1],
    ["2025-09-16", 2],
    ["2025-12-15", 2],
    ["2025-12-16", 3],
    ["2026-03-15", 3],
    ["2026-03-16", 4],
    ["2026-03-31", 4],
  ])
    assert.equal(accrualPeriod(date), period);
});

test("classifies each FIFO lot at the twelve-month boundary and sums decimal amounts", () => {
  assert.equal(holdingTerm("2024-05-01", "2025-05-01"), "short");
  assert.equal(holdingTerm("2024-05-01", "2025-05-02"), "long");

  const base = {
    sellId: "s",
    symbol: "ABC",
    sellDate: "2025-05-02",
    sellPrice: "0.3",
    quantity: "1",
    buyPrice: "0.1",
  };
  const report = buildTaxReport([
    { ...base, buyDate: "2024-05-01" },
    { ...base, buyDate: "2025-01-01", quantity: "2" },
  ]);

  assert.equal(report[0].long, "0.2");
  assert.equal(report[0].short, "0.4");
});

test("totals unsorted mixed gains and losses by year, period and lot", () => {
  const base = {
    symbol: "ABC",
    quantity: "2",
    buyPrice: "10.10",
    sellPrice: "10.20",
  };
  const lots = Object.freeze([
    { ...base, sellId: "one", buyDate: "2024-01-01", sellDate: "2025-06-16" },
    {
      ...base,
      sellId: "two",
      buyDate: "2025-04-01",
      sellDate: "2025-06-15",
      sellPrice: "10.00",
    },
    { ...base, sellId: "three", buyDate: "2023-01-01", sellDate: "2024-04-01" },
  ]);
  const report = buildTaxReport(lots);

  assert.deepEqual(
    report.map((year) => year.year),
    [2026, 2025],
  );
  assert.equal(report[0].short, "-0.2");
  assert.equal(report[0].long, "0.2");
  assert.equal(report[0].periods[0].rows[0].sellId, "two");
  assert.equal(report[0].periods[1].rows[0].sellId, "one");
  assert.equal(report[1].long, "0.2");
});
