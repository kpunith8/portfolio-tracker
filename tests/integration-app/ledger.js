import { cookies } from "next/headers";
import { instruments, transactions, history } from "./fixture-data";

export function currentMarketDay() {
  return "2026-11-07";
}

export async function readPortfolio() {
  const jar = await cookies();

  if (jar.get("fixture-db-error")?.value === "1")
    throw new Error("Fixture unavailable");

  const empty = jar.get("fixture-empty")?.value === "1";

  return {
    instruments: empty ? [] : instruments,
    transactions: empty ? [] : transactions,
    summaries: empty
      ? []
      : instruments.map((instrument, index) => ({
          id: instrument.id,
          quantity: transactions[index].quantity,
          cost: index ? "250" : "1600",
          latest: transactions[index].transaction_date,
        })),
    history: empty ? [] : history,
    baselines: [],
    chargesMissing: false,
    total: empty ? 0 : 2,
    page: 1,
  };
}
