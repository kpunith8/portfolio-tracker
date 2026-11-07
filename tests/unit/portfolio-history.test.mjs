import test from "node:test";
import assert from "node:assert/strict";
import { portfolioHistory } from "../../src/domain/portfolio-history.ts";

const buy = (id, date, quantity, unit_price, fees = "0", taxes = "0") => ({
  instrument_id: id,
  type: "BUY",
  transaction_date: date,
  quantity,
  unit_price,
  fees,
  taxes,
  sale_cost: null,
});

const sell = (id, date, quantity, sale_cost) => ({
  instrument_id: id,
  type: "SELL",
  transaction_date: date,
  quantity,
  unit_price: "0",
  fees: "0",
  taxes: "0",
  sale_cost,
});

test("historical points track remaining purchase cost and latest uses quotes", () => {
  const trades = [
    buy("a", "2025-01-01", "10", "10", "1"),
    sell("a", "2025-01-03", "4", "40.4"),
    buy("b", "2025-01-03", "2", "20"),
  ];
  const result = portfolioHistory(
    trades,
    {
      a: { price: "12", date: "2025-01-05" },
      b: { price: "30", date: "2025-01-05" },
    },
    "2025-01-01",
    "2025-01-05",
  );

  assert.deepEqual(
    result.map((p) => [p.date, p.value, p.estimated]),
    [
      ["2025-01-01", "101", true],
      ["2025-01-03", "100.6", true],
      ["2025-01-05", "132", false],
    ],
  );
});
test("range begins with holdings purchased before the range", () => {
  const trades = [buy("a", "2024-01-01", "2", "10")];
  const result = portfolioHistory(
    trades,
    { a: { price: "15", date: "2025-01-05" } },
    "2025-01-01",
    "2025-01-05",
  );

  assert.deepEqual(
    result.map((p) => p.value),
    ["20", "30"],
  );
});
test("missing or outdated quote falls back to cost and labels the estimate", () => {
  const trades = [
    buy("a", "2025-01-02", "1", "10"),
    buy("b", "2025-01-01", "2", "5"),
  ];
  const result = portfolioHistory(
    trades,
    { a: { price: "99", date: "2025-01-01" } },
    "2025-01-01",
    "2025-01-03",
  );

  assert.deepEqual(result.at(-1), {
    date: "2025-01-03",
    value: "20",
    estimated: true,
    estimatedCount: 2,
  });
});
test("missing sale allocation is never presented as an estimated value", () => {
  const trades = [
    buy("a", "2025-01-01", "10", "10"),
    sell("a", "2025-01-02", "4", null),
  ];
  const result = portfolioHistory(trades, {}, "2025-01-01", "2025-01-03");

  assert.equal(result[1].value, null);
  assert.equal(result[2].value, null);
});
test("unsorted transactions and same-day sales produce the same dated holdings", () => {
  const trades = [
    sell("a", "2025-01-03", "4", "40.4"),
    buy("a", "2025-01-03", "2", "15"),
    buy("a", "2025-01-01", "10", "10", "1"),
  ];
  const result = portfolioHistory(
    trades,
    { a: { price: "12", date: "2025-01-05" } },
    "2025-01-01",
    "2025-01-05",
  );

  assert.deepEqual(
    result.map((p) => p.value),
    ["101", "90.6", "96"],
  );
});
test("closing and reopening positions on the same day preserves the total", () => {
  const trades = [
    sell("a", "2025-01-03", "10", "100"),
    buy("a", "2025-01-01", "10", "10"),
    buy("a", "2025-01-03", "2", "20"),
  ];
  const result = portfolioHistory(trades, {}, "2025-01-01", "2025-01-04");

  assert.deepEqual(
    result.map((p) => p.value),
    ["100", "40", "40"],
  );
});
test("date range carries the prior cost to its starting boundary", async () => {
  const { clipPortfolioHistory } =
    await import("../../src/domain/portfolio-history.ts");
  const points = [
    { date: "2025-01-01", value: "100", estimated: true, estimatedCount: 1 },
    { date: "2025-01-10", value: "150", estimated: true, estimatedCount: 1 },
    { date: "2025-01-20", value: "200", estimated: false, estimatedCount: 0 },
  ];

  assert.deepEqual(
    clipPortfolioHistory(points, "2025-01-05", "2025-01-20").map((p) => [
      p.date,
      p.value,
    ]),
    [
      ["2025-01-05", "100"],
      ["2025-01-10", "150"],
      ["2025-01-20", "200"],
    ],
  );
  assert.deepEqual(
    clipPortfolioHistory(points, "2025-01-10", "2025-01-20").map((p) => p.date),
    ["2025-01-10", "2025-01-20"],
  );
});
