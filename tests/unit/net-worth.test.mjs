import test from "node:test";
import assert from "node:assert/strict";
import { combinedNetWorth } from "../../src/domain/net-worth.ts";

test("combines dated fund NAV and debt credits without inventing missing values", () => {
  const assets = [
    { id: "fund", asset_type: "MUTUAL_FUND" },
    { id: "debt", asset_type: "DEBT_OTHER" },
  ];
  const entries = [
    {
      instrument_id: "fund",
      entry_type: "PURCHASE",
      date: "2024-01-01",
      quantity: "2",
      amount: "10",
    },
    {
      instrument_id: "debt",
      entry_type: "PURCHASE",
      date: "2024-01-01",
      quantity: null,
      amount: "100",
    },
    {
      instrument_id: "debt",
      entry_type: "INTEREST",
      date: "2024-01-03",
      quantity: null,
      amount: "5",
    },
  ];
  const navs = [{ instrument_id: "fund", date: "2024-01-02", price: "12" }];

  assert.deepEqual(
    combinedNetWorth(
      [
        { date: "2024-01-01", value: "100" },
        { date: "2024-01-03", value: "100" },
        { date: "2024-01-04", value: null },
      ],
      assets,
      entries,
      navs,
    ),
    [
      { date: "2024-01-01", value: null },
      { date: "2024-01-03", value: "229" },
      { date: "2024-01-04", value: null },
    ],
  );
});
