import test from "node:test";
import assert from "node:assert/strict";
import { marketTotals } from "../../src/domain/live-market.ts";

test("totals use all holdings and decimal arithmetic", () => {
  const totals = marketTotals([
    { cost: "0.10", value: "0.30" },
    { cost: "0.20", value: "0.40" },
  ]);

  assert.equal(totals.invested.toFixed(2), "0.30");
  assert.equal(totals.current.toFixed(2), "0.70");
  assert.equal(totals.profit.toFixed(2), "0.40");
});
test("missing prices leave aggregate value and profit unavailable", () => {
  const totals = marketTotals([
    { cost: "100", value: "120" },
    { cost: "50", value: null },
  ]);

  assert.equal(totals.invested.toFixed(), "150");
  assert.equal(totals.current, null);
  assert.equal(totals.profit, null);
});

test("validates live quote data and computes daily movement", async () => {
  const { parseMarketTick, dailyMovement } =
    await import("../../src/domain/live-market.ts");

  assert.equal(
    parseMarketTick(
      {
        type: "sf",
        symbol: "NSE:ABC-EQ",
        ltp: 125,
        prev_close_price: 100,
        last_traded_time: 1690953622,
      },
      new Set(["NSE:ABC-EQ"]),
    )?.price,
    "125",
  );
  assert.equal(
    parseMarketTick(
      { type: "sf", symbol: "NSE:OTHER-EQ", ltp: 125 },
      new Set(["NSE:ABC-EQ"]),
    ),
    null,
  );

  const day = dailyMovement("4", "125", "100");

  assert.equal(day.amount.toFixed(), "100");
  assert.equal(day.percent.toFixed(), "25");
  assert.equal(dailyMovement("4", "125", null), null);
});

test("keeps newer market data and retains the previous close only within its market day", async () => {
  const { mergeMarketTick } = await import("../../src/domain/live-market.ts");
  const previous = {
    symbol: "NSE:ABC-EQ",
    price: "100",
    previousClose: "90",
    marketDate: "2026-11-04",
    tradedAt: 1000,
  };

  assert.deepEqual(
    mergeMarketTick(previous, { ...previous, price: "99", tradedAt: 999 }),
    previous,
  );
  assert.equal(
    mergeMarketTick(previous, {
      ...previous,
      price: "101",
      previousClose: null,
      tradedAt: 1001,
    }).previousClose,
    "90",
  );
  assert.equal(
    mergeMarketTick(previous, {
      ...previous,
      marketDate: "2026-11-05",
      previousClose: null,
      tradedAt: 2000,
    }).previousClose,
    null,
  );
});

test("sorts by 1D percentage rather than stock price, with unavailable values last", async () => {
  const { compareMarketPercent, dailyMovement } =
    await import("../../src/domain/live-market.ts");
  const rows = [
    { name: "high price", percent: dailyMovement("1", "4000", "4100").percent },
    { name: "low price", percent: dailyMovement("1", "100", "80").percent },
    { name: "missing", percent: null },
  ];

  assert.deepEqual(
    [...rows]
      .sort((a, b) => compareMarketPercent(a.percent, b.percent, false))
      .map((r) => r.name),
    ["low price", "high price", "missing"],
  );
  assert.deepEqual(
    [...rows]
      .sort((a, b) => compareMarketPercent(a.percent, b.percent, true))
      .map((r) => r.name),
    ["high price", "low price", "missing"],
  );
});

test("sorts returns by percentage instead of profit amount and keeps zero cost unavailable", async () => {
  const { returnPercent, compareMarketPercent } =
    await import("../../src/domain/live-market.ts");
  const rows = [
    { name: "larger profit", percent: returnPercent("1000", "10000") },
    { name: "higher return", percent: returnPercent("100", "200") },
    { name: "zero cost", percent: returnPercent("100", "0") },
    { name: "unpriced", percent: returnPercent(null, "100") },
  ];

  assert.deepEqual(
    [...rows]
      .sort((a, b) => compareMarketPercent(a.percent, b.percent, false))
      .map((r) => r.name),
    ["higher return", "larger profit", "zero cost", "unpriced"],
  );
  assert.deepEqual(
    [...rows]
      .sort((a, b) => compareMarketPercent(a.percent, b.percent, true))
      .map((r) => r.name),
    ["larger profit", "higher return", "zero cost", "unpriced"],
  );
});
