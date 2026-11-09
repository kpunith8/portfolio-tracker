import test from "node:test";
import assert from "node:assert/strict";
import {
  validateManualPurchase,
  manualFundMetrics,
  debtRecordedXirr,
} from "../../src/domain/manual-assets.ts";

test("validates fractional fund units and rejects invalid dates and ratios", () => {
  const row = {
    name: "Fund",
    date: "2024-02-29",
    quantity: "1.125",
    price: "25.25",
    expenseRatio: "0.5",
  };

  assert.equal(validateManualPurchase("MUTUAL_FUND", row, "2024-03-01"), null);
  assert.ok(
    validateManualPurchase(
      "MUTUAL_FUND",
      { ...row, date: "2023-02-29" },
      "2024-03-01",
    ),
  );
  assert.ok(
    validateManualPurchase(
      "MUTUAL_FUND",
      { ...row, expenseRatio: "101" },
      "2024-03-01",
    ),
  );
  assert.ok(
    validateManualPurchase(
      "MUTUAL_FUND",
      { ...row, quantity: "0" },
      "2024-03-01",
    ),
  );
});

test("debt requires an amount but no quantity", () => {
  assert.equal(
    validateManualPurchase(
      "DEBT_OTHER",
      {
        name: "PPF",
        date: "2024-01-01",
        price: "100",
        quantity: "",
        expenseRatio: "",
      },
      "2024-03-01",
    ),
    null,
  );
});

test("debt names must use a supported investment option", () => {
  const row = {
    name: "FD",
    date: "2024-01-01",
    price: "100",
    quantity: "",
    expenseRatio: "",
  };

  for (const name of ["Sukanya Yojane", "PPF", "FD"])
    assert.equal(
      validateManualPurchase("DEBT_OTHER", { ...row, name }, "2024-03-01"),
      null,
    );
  assert.ok(
    validateManualPurchase(
      "DEBT_OTHER",
      { ...row, name: "Other" },
      "2024-03-01",
    ),
  );
});

test("fund returns require a NAV no earlier than the latest purchase", () => {
  const purchases = [
    { date: "2023-01-01", quantity: "2", price: "50" },
    { date: "2024-01-01", quantity: "1", price: "100" },
  ];

  assert.equal(
    manualFundMetrics(purchases, { date: "2023-12-31", price: "100" }).value,
    null,
  );

  const result = manualFundMetrics(purchases, {
    date: "2025-01-01",
    price: "100",
  });

  assert.equal(result.value?.toString(), "300");
  assert.equal(result.cost.toString(), "200");
  assert.ok(result.xirr?.gt(0));
});

test("debt XIRR uses recorded balance on the last event date", () => {
  const entries = [
    { entry_type: "PURCHASE", date: "2023-01-01", amount: "100" },
    { entry_type: "INTEREST", date: "2024-01-01", amount: "10" },
  ];

  assert.ok(debtRecordedXirr(entries).minus(10).abs().lt("0.01"));
  assert.equal(debtRecordedXirr([entries[0]]), null);
  assert.equal(debtRecordedXirr([]), null);
});
