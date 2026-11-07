import test from "node:test";
import assert from "node:assert/strict";
import { isUuid } from "../../src/domain/identifier-utils.ts";
import { marketDate } from "../../src/domain/market-date-utils.ts";
import { validMarketPrice } from "../../src/domain/price-utils.ts";

test("UUID validation preserves accepted identifiers and rejects malformed input", () => {
  assert.equal(isUuid("A0B1C2D3-1234-abcd-9876-123456789abc"), true);
  for (const value of [
    "",
    "a0b1c2d3-1234-abcd-9876-123456789abcx",
    " a0b1c2d3-1234-abcd-9876-123456789abc",
  ])
    assert.equal(isUuid(value), false);
});

test("market dates follow India time across UTC midnight", () => {
  assert.equal(
    marketDate(Date.parse("2025-01-01T18:30:00Z") / 1000),
    "2025-01-02",
  );
});

test("market prices retain decimal precision and enforce provider bounds", () => {
  assert.equal(validMarketPrice("123.12345678")?.toFixed(), "123.12345678");
  for (const value of ["0", "-1", "10000000000000000", "1.123456789"])
    assert.equal(validMarketPrice(value), null);
});

test("display dates keep the recorded calendar day in UTC", async () => {
  const { formatRecordedDate } =
    await import("../../src/domain/market-date-utils.ts");

  assert.equal(formatRecordedDate("2025-01-02"), "2 Jan 2025");
});
