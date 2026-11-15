import { cookies } from "next/headers";

const sample = {
  company: "ACME LTD",
  isin: "INE123A01012",
  shares: "10",
  perShare: "2.5",
  netAmount: "25.00",
  symbol: "ACME",
};

export async function readExistingDividendRows() {
  const cookieStore = await cookies();
  const state = cookieStore.get("fixture-dividend-existing")?.value;

  if (!state) return [];

  return [
    {
      ...sample,
      exDate: "2025-06-15",
      netAmount: state === "conflict" ? "26" : "25",
    },
  ];
}

export async function readDividends() {
  const cookieStore = await cookies();

  if (cookieStore.get("fixture-tax-empty")?.value === "1") return [];
  if (cookieStore.get("fixture-large-dividends")?.value === "1")
    return Array.from({ length: 100 }, (_, i) => ({
      ...sample,
      company: `COMPANY ${i}`,
      isin: `INE${String(i).padStart(9, "0")}`,
      exDate: `2025-06-${String(1 + (i % 28)).padStart(2, "0")}`,
      symbol: `SYM${i}`,
    }));

  const saved =
    cookieStore.get("fixture-dividend-saved")?.value === "1"
      ? [
          {
            ...sample,
            company: "TEST LTD",
            isin: "INE999999999",
            exDate: "2025-06-15",
            netAmount: "20",
          },
        ]
      : [];

  return [
    ...saved,
    { ...sample, exDate: "2025-06-15" },
    { ...sample, exDate: "2025-06-16", netAmount: "15", symbol: "ACME" },
    { ...sample, exDate: "2024-04-01", netAmount: "10", symbol: "ACME" },
    {
      ...sample,
      company: "BETA LTD",
      isin: "INE456A01019",
      exDate: "2025-06-16",
      netAmount: "5",
      symbol: null,
    },
  ];
}
