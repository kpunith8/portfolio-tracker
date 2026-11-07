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

test("extracts full exchange symbols and preserves distinct trading series", async () => {
  const { parseSymbolMaster } =
    await import("../../src/domain/fyers-symbol-master.ts");
  const csv =
    '1,"Example, Limited",0,1,0.05,INE385F01024,session,2026-01-02,,NSE:EXAMPLE-EQ,10,10,1,EXAMPLE\n2,Example,0,1,0.05,INE385F01024,session,2026-01-02,,NSE:EXAMPLE-BE,10,10,2,EXAMPLE\n';

  assert.deepEqual(parseSymbolMaster(csv, "NSE"), [
    {
      symbol: "EXAMPLE",
      exchange: "NSE",
      name: "Example, Limited",
      fyersSymbol: "NSE:EXAMPLE-EQ",
      isin: "INE385F01024",
    },
    {
      symbol: "EXAMPLE",
      exchange: "NSE",
      name: "Example",
      fyersSymbol: "NSE:EXAMPLE-BE",
      isin: "INE385F01024",
    },
  ]);
});

test("rejects malformed and unexpected exchange rows", async () => {
  const { parseSymbolMaster } =
    await import("../../src/domain/fyers-symbol-master.ts");

  assert.throws(() =>
    parseSymbolMaster(
      "1,Example,0,1,0.05,INE385F01024,s,d,,BSE:EXAMPLE-A,10,10,1,EXAMPLE",
      "NSE",
    ),
  );
  assert.throws(() => parseSymbolMaster('1,"unfinished', "NSE"));
});
