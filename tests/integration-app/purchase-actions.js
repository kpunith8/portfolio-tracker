"use server";

const symbols = [
  {
    symbol: "TEST",
    exchange: "NSE",
    name: "Test Limited",
    series: "EQ",
    fyersSymbol: "NSE:TEST-EQ",
  },
  {
    symbol: "ALPHA",
    exchange: "BSE",
    name: "Alpha Limited",
    series: "A",
    fyersSymbol: "BSE:ALPHA-A",
  },
];

export async function searchSymbols(query) {
  return symbols.filter(
    (s) =>
      s.symbol.includes(query.toUpperCase()) ||
      s.name.toUpperCase().includes(query.toUpperCase()),
  );
}

export async function resolvePurchaseSymbols(rows) {
  return rows.map(
    (r) =>
      symbols.find(
        (s) =>
          s.symbol === r.symbol.toUpperCase() &&
          s.exchange === r.exchange.toUpperCase(),
      ) || null,
  );
}

export async function savePurchases(rows) {
  return rows.some((r) => !r.fyersSymbol)
    ? { error: "Invalid ticker" }
    : { success: true };
}
