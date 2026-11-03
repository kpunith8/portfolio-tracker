import test from "node:test";
import assert from "node:assert/strict";
import {
  annualizedReturn,
  xirr,
  quantityAt,
} from "../../src/domain/returns.ts";

test("annualized purchase return accounts for elapsed days", () => {
  assert.equal(
    annualizedReturn("100", "110", "2025-01-01", "2026-01-01")?.toFixed(2),
    "10.00",
  );
  assert.equal(
    annualizedReturn("100", "110", "2026-01-01", "2026-01-01"),
    null,
  );
});
test("XIRR includes dated buys, sale proceeds and terminal valuation", () => {
  const flows = [
    { date: "2024-01-01", amount: "-1000" },
    { date: "2025-01-01", amount: "400" },
    { date: "2026-01-01", amount: "800" },
  ];
  const result = xirr(flows);
  assert.ok(result && result.gt(11) && result.lt(12));
  assert.equal(
    xirr([
      { date: "2024-01-01", amount: "-100" },
      { date: "2025-01-01", amount: "200" },
      { date: "2026-01-01", amount: "-100" },
    ]),
    null,
  );
  assert.equal(xirr([{ date: "2024-01-01", amount: "-100" }]), null);
});
test("historical quantity includes only trades through the close date", () => {
  const trades = [
    { type: "BUY", transaction_date: "2024-01-01", quantity: "10" },
    { type: "SELL", transaction_date: "2025-01-05", quantity: "3" },
    { type: "BUY", transaction_date: "2026-01-01", quantity: "2" },
  ];
  assert.equal(quantityAt(trades, "2025-01-04")?.toFixed(), "10");
  assert.equal(quantityAt(trades, "2025-01-05")?.toFixed(), "7");
  assert.equal(
    quantityAt(
      [{ type: "SELL", transaction_date: "2025-01-01", quantity: "3" }],
      "2025-01-01",
    ),
    null,
  );
});
