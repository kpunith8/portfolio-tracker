import { cookies } from "next/headers";

export async function readTaxReport() {
  const cookieStore = await cookies();

  if (cookieStore.get("fixture-tax-empty")?.value === "1")
    return { lots: [], incomplete: false, hasMutualFundPurchases: false };

  const base = {
    sellId: "fixture-sale",
    symbol: "ALPHA",
    sellDate: "2025-06-16",
    sellPrice: "120",
  };

  return {
    lots: [
      { ...base, buyDate: "2024-01-01", quantity: "2", buyPrice: "100" },
      { ...base, buyDate: "2025-01-01", quantity: "1", buyPrice: "110" },
      {
        ...base,
        sellId: "fixture-old-sale",
        sellDate: "2024-05-01",
        buyDate: "2023-01-01",
        quantity: "1",
        buyPrice: "100",
      },
    ],
    incomplete: cookieStore.get("fixture-tax-incomplete")?.value === "1",
    hasMutualFundPurchases: false,
  };
}
