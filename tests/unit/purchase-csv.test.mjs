import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePurchaseCsv,
  purchaseCsvTemplate,
} from "../../src/domain/purchase-csv.ts";

test("parses a UTF-8 template with quoted fields and preserves decimal text", () => {
  const csv =
    '\ufeffsymbol,exchange,quantity,price,date\r\n"ABC",NSE,10,123.4500,2024-01-02\r\n';

  assert.deepEqual(parsePurchaseCsv(csv), {
    rows: [
      {
        symbol: "ABC",
        exchange: "NSE",
        quantity: "10",
        price: "123.4500",
        date: "2024-01-02",
      },
    ],
  });
  assert.equal(purchaseCsvTemplate, "symbol,exchange,quantity,price,date\r\n");
});

test("rejects malformed files, duplicate headers, and inconsistent columns", () => {
  for (const csv of [
    'symbol,exchange,quantity,price,date\n"ABC,NSE,1,2,2024-01-01',
    "symbol,exchange,quantity,price,price\nABC,NSE,1,2,2024-01-01",
    "symbol,exchange,quantity,price,date\nABC,NSE,1,2",
    'symbol,exchange,quantity,price,date\n"ABC"x,NSE,1,2,2024-01-01',
  ])
    assert.ok(parsePurchaseCsv(csv).error);
});

test("parses escaped quotes and embedded newlines without splitting records", () => {
  const result = parsePurchaseCsv(
    'symbol,exchange,quantity,price,date\n"A""B\nC",NSE,1,2,2024-01-01',
  );

  assert.equal(result.rows?.[0].symbol, 'A"B\nC');
});
