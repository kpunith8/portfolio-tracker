import test from "node:test";
import assert from "node:assert/strict";
import { remainingLot } from "../../src/domain/holdings.ts";

test("remaining cost subtracts allocated acquisition cost after partial sale", () => {
  const lot = remainingLot({
    quantity: "10",
    unit_price: "100",
    fees: "10",
    taxes: "0",
    sold: "4",
    allocated_cost: "404",
  });

  assert.equal(lot.remaining.toFixed(), "6");
  assert.equal(lot.cost.toFixed(), "606");
});
test("remaining cost preserves allocation rounding rather than recalculating it", () => {
  const lot = remainingLot({
    quantity: "3",
    unit_price: "0.1",
    fees: "0.01",
    taxes: "0",
    sold: "2",
    allocated_cost: "0.20666667",
  });

  assert.equal(lot.remaining.toFixed(), "1");
  assert.equal(lot.cost.toFixed(), "0.10333333");
});

test("purchase performance varies with each purchase cost and includes charges", async () => {
  const { purchasePerformance } = await import("../../src/domain/holdings.ts");
  const base = {
    quantity: "10",
    purchaseCost: "1005",
    price: "120",
    priceDate: "2026-10-01",
    purchaseDate: "2026-01-01",
  };
  const first = purchasePerformance(base);

  assert.equal(first.amount.toFixed(), "195");
  assert.equal(first.percent.toFixed(2), "19.40");

  const second = purchasePerformance({ ...base, purchaseCost: "1300" });

  assert.equal(second.amount.toFixed(), "-100");
  assert.equal(second.percent.toFixed(2), "-7.69");
});
test("purchase performance is unavailable for pre-purchase or missing prices and zero cost", async () => {
  const { purchasePerformance } = await import("../../src/domain/holdings.ts");
  const valid = {
    quantity: "3",
    purchaseCost: "300",
    price: "90",
    priceDate: "2026-10-01",
    purchaseDate: "2026-01-01",
  };

  for (const change of [
    { purchaseDate: "2026-10-01" },
    { purchaseDate: "2026-10-02" },
    { price: null },
    { priceDate: null },
    { quantity: "0" },
    { purchaseCost: "0" },
  ]) {
    assert.equal(purchasePerformance({ ...valid, ...change }), null);
  }
});

test("a quote before the latest trade cannot value current shares", async () => {
  const { currentHoldingValue } = await import("../../src/domain/holdings.ts");

  assert.equal(
    currentHoldingValue("10", "100", "2026-11-01", "2026-11-02"),
    null,
  );
  assert.equal(
    currentHoldingValue("10", "100", "2026-11-02", "2026-11-02").toString(),
    "1000",
  );
});
