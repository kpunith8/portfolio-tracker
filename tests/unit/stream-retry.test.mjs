import test from "node:test";
import assert from "node:assert/strict";
import { streamRetryDelay } from "../../src/domain/stream-retry.ts";

test("reconnects quickly after a disconnect and backs off repeated failures", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 10].map(streamRetryDelay),
    [1000, 1000, 2000, 4000, 8000, 16000, 30000],
  );
});

test("stream events distinguish a connected socket from live prices and rotation", async () => {
  const { streamEventStatus } =
    await import("../../src/domain/stream-retry.ts");
  assert.equal(streamEventStatus({ status: "connected" }), "connected");
  assert.equal(streamEventStatus({ tick: { symbol: "NSE:ABC-EQ" } }), "live");
  assert.equal(streamEventStatus({ status: "rotate" }), "rotate");
  assert.equal(streamEventStatus({ status: "error" }), "error");
  assert.equal(streamEventStatus({ status: "heartbeat" }), null);
});

test("stream rotates before the Vercel deadline and includes setup time", async () => {
  const { streamRotationDelay } =
    await import("../../src/domain/stream-retry.ts");
  assert.equal(streamRotationDelay(1000, 1000), 270000);
  assert.equal(streamRotationDelay(1000, 11000), 260000);
  assert.equal(streamRotationDelay(1000, 280000), 0);
});

test("only Vercel production enables automatic retry and rotation", async () => {
  const { isProductionStream } =
    await import("../../src/domain/stream-retry.ts");
  assert.equal(isProductionStream("production"), true);
  for (const environment of ["preview", "development", undefined, ""]) {
    assert.equal(isProductionStream(environment), false);
  }
});
