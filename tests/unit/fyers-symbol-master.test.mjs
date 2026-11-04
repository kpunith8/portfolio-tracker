import test from "node:test";
import assert from "node:assert/strict";
import { bseSymbolForIsin } from "../../src/domain/fyers-symbol-master.ts";

test("matches an exact ISIN and handles quoted company names", () => {
  const csv =
    '1,"Example, Limited",50,1,0.05,INE385F01024,session,date,,BSE:EXAMPLE-B\n2,Other,50,1,0.05,INE000A01001,session,date,,BSE:OTHER-A';
  assert.equal(bseSymbolForIsin(csv, "INE385F01024"), "BSE:EXAMPLE-B");
  assert.equal(bseSymbolForIsin(csv, "INE385F01025"), null);
});
test("does not choose between multiple tickers with the same ISIN", () => {
  const csv =
    "1,Example,50,1,0.05,INE385F01024,session,date,,BSE:EXAMPLE-A\n2,Example,50,1,0.05,INE385F01024,session,date,,BSE:EXAMPLE-B";
  assert.equal(bseSymbolForIsin(csv, "INE385F01024"), null);
});
