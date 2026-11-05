import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "lossless-json";
import {
  marketDate,
  numberText,
  priorClose,
  targetDate,
} from "../../src/domain/market-data.ts";

test("calendar targets handle leap days and month ends", () => {
  assert.equal(targetDate("2024-08-31", "6M"), "2024-02-29");
  assert.equal(targetDate("2024-03-01", "365D"), "2023-03-02");
  assert.equal(targetDate("2026-11-03", "15D"), "2026-10-19");
});
test("market dates use India time across UTC midnight", () => {
  assert.equal(
    marketDate(Date.parse("2026-11-02T20:00:00Z") / 1000),
    "2026-11-03",
  );
});
test("selects the latest earlier close without rounding source decimals", () => {
  const rows = parse(
    "[[1793318400,0,0,0,123456789012345.12345678,0],[1793491200,0,0,0,888,0],[1793232000,0,0,0,99,0]]",
  );
  assert.deepEqual(
    priorClose(rows, "2026-10-31", Date.parse("2026-11-03T12:00:00Z") / 1000),
    { day: "2026-10-30", price: "123456789012345.12345678" },
  );
  assert.deepEqual(
    priorClose(rows, "2026-10-30", Date.parse("2026-11-03T12:00:00Z") / 1000),
    { day: "2026-10-30", price: "123456789012345.12345678" },
  );
  assert.equal(
    numberText(parse("123456789012345.12345678")),
    "123456789012345.12345678",
  );
});
test("returns unavailable when no close is on or before target", () => {
  const rows = parse("[[1793491200,0,0,0,999,0]]");
  assert.equal(
    priorClose(rows, "2026-10-01", Date.parse("2026-11-03T12:00:00Z") / 1000),
    null,
  );
});

test("quotes preserve decimal values and reject unexpected, duplicate and missing prices", async () => {
  const { validQuotes } = await import("../../src/domain/market-data.ts");
  const quotes = parse(
    '[{"n":"NSE:ABC-EQ","s":"ok","v":{"lp":123456789012345.12345678,"tt":1793318400}},{"n":"NSE:ABC-EQ","s":"error","v":{"lp":999,"tt":1793318400}},{"n":"NSE:XYZ-EQ","s":"ok","v":{"lp":0,"tt":1793318400}},{"n":"NSE:OTHER-EQ","s":"ok","v":{"lp":30,"tt":1793318400}}]',
  );
  const rows = validQuotes(
    quotes,
    new Map([
      ["NSE:ABC-EQ", "id-a"],
      ["NSE:XYZ-EQ", "id-b"],
    ]),
    Date.parse("2026-11-03T12:00:00Z") / 1000,
  );
  assert.deepEqual(
    rows.map(({ id, price }) => ({ id, price })),
    [{ id: "id-a", price: "123456789012345.12345678" }],
  );
});

test("quote refresh continues after a complete batch with more stale holdings", async () => {
  const { quoteBatchStatus } = await import("../../src/domain/market-data.ts");
  assert.equal(quoteBatchStatus(50, 50, 51), "more");
  assert.equal(quoteBatchStatus(1, 1, 1), "current");
  assert.equal(quoteBatchStatus(49, 50, 51), "unavailable");
});

test("FYERS error codes distinguish reconnect from unavailable", async () => {
  const { fyersErrorStatus } = await import("../../src/domain/market-data.ts");
  for (const code of ["-8", "-15", "-16", "-17"])
    assert.equal(fyersErrorStatus(code), "reconnect");
  for (const code of ["-1", undefined, 15])
    assert.equal(fyersErrorStatus(code), "unavailable");
});
