import test from "node:test";
import assert from "node:assert/strict";
import { dailyPortfolioHistory } from "../../src/domain/daily-portfolio-history.ts";

test("values purchases, partial sales and fully sold positions on each close", () => {
  const trades = [
    {
      instrument_id: "A",
      type: "BUY",
      transaction_date: "2024-01-01",
      quantity: "10",
    },
    {
      instrument_id: "A",
      type: "SELL",
      transaction_date: "2024-01-03",
      quantity: "4",
    },
    {
      instrument_id: "A",
      type: "SELL",
      transaction_date: "2024-01-04",
      quantity: "6",
    },
    {
      instrument_id: "B",
      type: "BUY",
      transaction_date: "2024-01-02",
      quantity: "2",
    },
  ];
  const prices = [
    { instrument_id: "A", market_date: "2024-01-01", price: "10" },
    { instrument_id: "A", market_date: "2024-01-02", price: "11" },
    { instrument_id: "B", market_date: "2024-01-02", price: "5" },
    { instrument_id: "A", market_date: "2024-01-03", price: "12" },
    { instrument_id: "B", market_date: "2024-01-03", price: "6" },
    { instrument_id: "B", market_date: "2024-01-04", price: "7" },
  ];

  assert.deepEqual(dailyPortfolioHistory(trades, prices), [
    { date: "2024-01-01", value: "100" },
    { date: "2024-01-02", value: "120" },
    { date: "2024-01-03", value: "84" },
    { date: "2024-01-04", value: "14" },
  ]);
});

test("does not value an incomplete day with a partial portfolio", () => {
  const trades = [
    {
      instrument_id: "A",
      type: "BUY",
      transaction_date: "2024-01-01",
      quantity: "1",
    },
    {
      instrument_id: "B",
      type: "BUY",
      transaction_date: "2024-01-01",
      quantity: "1",
    },
  ];

  assert.deepEqual(
    dailyPortfolioHistory(trades, [
      { instrument_id: "A", market_date: "2024-01-01", price: "10" },
    ]),
    [{ date: "2024-01-01", value: null }],
  );
});

test("uses exact decimal arithmetic for high-value holdings", () => {
  const trades = [
    {
      instrument_id: "A",
      type: "BUY",
      transaction_date: "2024-01-01",
      quantity: "999999999999999999",
    },
  ];
  const prices = [
    {
      instrument_id: "A",
      market_date: "2024-01-01",
      price: "9999999999999999.99",
    },
  ];

  assert.equal(
    dailyPortfolioHistory(trades, prices)[0].value,
    "9999999999999999980000000000000000.01",
  );
});

test("only includes dates with observed market prices", () => {
  const trades = [
    {
      instrument_id: "A",
      type: "BUY",
      transaction_date: "2024-01-01",
      quantity: "1",
    },
  ];
  const prices = [
    { instrument_id: "A", market_date: "2024-01-01", price: "10" },
    { instrument_id: "A", market_date: "2024-01-03", price: "12" },
  ];

  assert.deepEqual(dailyPortfolioHistory(trades, prices), [
    { date: "2024-01-01", value: "10" },
    { date: "2024-01-03", value: "12" },
  ]);
});
