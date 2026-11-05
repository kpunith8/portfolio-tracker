import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Next.js supplies this build-time marker; it has no runtime behavior in this test.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { saveDailyHistory, listSavedHistoryDates, releaseHistoryLease } =
  await import("../../src/server/market-data/daily-history-queries.ts");
const { saveFetchedBaseline } =
  await import("../../src/server/market-data/history-queries.ts");
const { recordTradeEntry } =
  await import("../../src/server/portfolio/trade-queries.ts");

const capture = (strings, ...values) => ({ text: strings.join("?"), values });

test("daily history writes remain lease-protected, user-scoped and atomic", () => {
  const query = saveDailyHistory(
    capture,
    "lease-1",
    "user-1",
    "instrument-1",
    "BSE:ABC-EQ",
    "[]",
    "[]",
    true,
  );
  assert.match(query.text, /WITH valid AS/);
  assert.match(query.text, /l\.lease_id=\?::uuid AND l\.expires_at>now\(\)/);
  assert.match(query.text, /p\.kinde_subject=\?/);
  assert.match(query.text, /INSERT INTO daily_closing_prices/);
  assert.match(query.text, /ON CONFLICT DO NOTHING/);
  assert.match(query.text, /INSERT INTO daily_history_alternate_coverage/);
  assert.ok(query.values.includes("user-1"));
  assert.ok(query.values.includes("lease-1"));
  assert.equal(query.values.at(-1), true);
});

test("history reads and cleanup use the given owner and lease", () => {
  const query = listSavedHistoryDates(
    capture,
    "owner",
    "ticker",
    "2026-01-01",
    "2026-01-31",
  );
  assert.deepEqual(query.values, [
    "owner",
    "ticker",
    "2026-01-01",
    "2026-01-31",
  ]);
  assert.match(query.text, /kinde_subject=\?/);
  assert.deepEqual(releaseHistoryLease(capture, "lease").values, ["lease"]);
});

test("baseline and trade operations bind the supplied user and input values", () => {
  const baseline = saveFetchedBaseline(
    capture,
    "7D",
    "2026-11-05",
    "2026-10-29",
    "2026-10-28",
    "12.34",
    "2026-11-05T00:00:00Z",
    "ticker",
    "owner",
  );
  assert.match(baseline.text, /p\.kinde_subject=\?/);
  assert.deepEqual(baseline.values.slice(0, 8), [
    "7D",
    "2026-11-05",
    "2026-10-29",
    "2026-10-28",
    "12.34",
    "2026-11-05T00:00:00Z",
    "ticker",
    "owner",
  ]);
  const trade = recordTradeEntry(
    capture,
    "owner",
    "BUY",
    null,
    "ABC",
    "10",
    "12.34",
    "2026-11-05",
    null,
  );
  assert.deepEqual(trade.values, [
    "owner",
    "BUY",
    null,
    "ABC",
    "10",
    "12.34",
    "2026-11-05",
    null,
  ]);
});
