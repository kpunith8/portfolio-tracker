export async function searchSymbols(query: string) {
  if (!"EXAMPLE FUND".includes(query.toUpperCase())) return [];

  return [
    {
      fyersSymbol: "BSE:EXAMPLE-A",
      symbol: "EXAMPLE",
      exchange: "BSE",
      name: "EXAMPLE FUND GROWTH",
      series: "A",
    },
  ];
}
