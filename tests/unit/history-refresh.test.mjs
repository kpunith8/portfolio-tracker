import test from "node:test";
import assert from "node:assert/strict";
import { pendingHistoricalPeriods } from "../../src/domain/history-refresh.ts";

test("only missing, stale, or unavailable periods need a refresh", () => {
  const periods = ["7D", "30D", "90D", "6M", "365D"];
  const entries = [
    {
      period: "7D",
      instrument_id: "a",
      as_of_date: "2026-11-03",
      status: "AVAILABLE",
    },
    {
      period: "30D",
      instrument_id: "a",
      as_of_date: "2026-11-02",
      status: "AVAILABLE",
    },
    {
      period: "90D",
      instrument_id: "a",
      as_of_date: "2026-11-03",
      status: "UNAVAILABLE",
    },
    {
      period: "6M",
      instrument_id: "b",
      as_of_date: "2026-11-03",
      status: "AVAILABLE",
    },
  ];

  assert.deepEqual(
    pendingHistoricalPeriods(periods, entries, "a", "2026-11-03"),
    ["30D", "90D", "6M", "365D"],
  );
  assert.deepEqual(
    pendingHistoricalPeriods(["7D"], entries, "a", "2026-11-03"),
    [],
  );
});
