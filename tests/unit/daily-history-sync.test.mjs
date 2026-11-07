import test from "node:test";
import assert from "node:assert/strict";
import {
  missingHistoryRange,
  historyResponseStatus,
  splitReturnedCoverage,
  fallbackHistoryRange,
} from "../../src/domain/daily-history-sync.ts";

test("partial response records missing weekdays as unavailable rather than complete", () => {
  assert.deepEqual(
    splitReturnedCoverage("2024-01-01", "2024-01-05", [
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
    ]),
    [
      { start: "2024-01-01", end: "2024-01-02", status: "UNAVAILABLE" },
      { start: "2024-01-03", end: "2024-01-05", status: "COMPLETE" },
    ],
  );
});

test("fallback considers symbols with no primary prices", () => {
  assert.deepEqual(
    fallbackHistoryRange("2024-01-01", "2024-01-05", null, [], []),
    { start: "2024-01-01", end: "2024-01-05" },
  );
  assert.deepEqual(
    fallbackHistoryRange(
      "2024-01-01",
      "2024-01-10",
      null,
      [{ start: "2024-01-01", end: "2024-01-04" }],
      ["2024-01-09"],
    ),
    { start: "2024-01-10", end: "2024-01-10" },
  );
});

test("distinguishes a no-data interval from a failed or valid response", () => {
  assert.equal(
    historyResponseStatus({ s: "no_data", candles: [] }),
    "unavailable",
  );
  assert.equal(historyResponseStatus({ s: "ok", candles: [] }), "unavailable");
  assert.equal(
    historyResponseStatus({ s: "ok", candles: [[1, 2, 3, 4, 5]] }),
    "available",
  );
  assert.equal(historyResponseStatus({ s: "error", candles: [] }), "error");
  assert.equal(historyResponseStatus({ s: "ok" }), "error");
});

test("a checked unavailable interval does not block older work", () => {
  assert.deepEqual(
    missingHistoryRange(
      "2022-01-01",
      "2024-01-01",
      [{ start: "2023-01-01", end: "2024-01-01" }],
      [],
    ),
    { start: "2022-01-01", end: "2022-12-31" },
  );
});

test("fetches only missing dates and prioritizes the latest range", () => {
  assert.deepEqual(
    missingHistoryRange(
      "2024-01-01",
      "2024-01-10",
      [{ start: "2024-01-03", end: "2024-01-06" }],
      ["2024-01-09"],
    ),
    { start: "2024-01-10", end: "2024-01-10" },
  );
  assert.deepEqual(
    missingHistoryRange(
      "2024-01-01",
      "2024-01-08",
      [{ start: "2024-01-03", end: "2024-01-06" }],
      [],
    ),
    { start: "2024-01-07", end: "2024-01-08" },
  );
});
test("returns nothing for complete coverage and limits a request to 366 days", () => {
  assert.equal(
    missingHistoryRange(
      "2024-01-01",
      "2024-01-03",
      [{ start: "2024-01-01", end: "2024-01-03" }],
      [],
    ),
    null,
  );

  const result = missingHistoryRange("2020-01-01", "2024-12-31", [], []);

  assert.equal(result.end, "2024-12-31");
  assert.equal(
    (Date.parse(result.end) - Date.parse(result.start)) / 86400000 + 1,
    366,
  );
});
