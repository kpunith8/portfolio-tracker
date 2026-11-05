import test from "node:test";
import assert from "node:assert/strict";
import { streamRetryDelay } from "../../src/domain/stream-retry.ts";

test("reconnects quickly after a disconnect and backs off repeated failures", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 10].map(streamRetryDelay),
    [1000, 1000, 2000, 4000, 8000, 16000, 30000],
  );
});
