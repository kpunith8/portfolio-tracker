import Decimal from "decimal.js";
import { xirr } from "./returns.ts";

Decimal.set({ precision: 64, rounding: Decimal.ROUND_HALF_UP });

export type ManualAssetType = "MUTUAL_FUND" | "DEBT_OTHER";

export type ManualPurchase = {
  name: string;
  date: string;
  quantity: string;
  price: string;
  expenseRatio: string;
};

export const debtInvestmentNames = ["Sukanya Yojane", "PPF", "FD"] as const;

const decimal = /^\d{1,16}(\.\d{1,8})?$/;

export function validManualDate(date: string, today: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date <= today &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
  );
}

export function validManualAmount(value: string, positive = false) {
  return decimal.test(value) && (!positive || new Decimal(value).gt(0));
}

export function validateManualPurchase(
  type: ManualAssetType,
  row: ManualPurchase,
  today: string,
): string | null {
  if (
    !row ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    row.name.trim().length > 200 ||
    typeof row.date !== "string" ||
    !validManualDate(row.date, today) ||
    typeof row.price !== "string" ||
    !validManualAmount(row.price, true)
  )
    return "Check the name, date and amount.";
  if (
    type === "DEBT_OTHER" &&
    !debtInvestmentNames.some((name) => name === row.name)
  )
    return "Select a supported debt investment.";
  if (
    type === "MUTUAL_FUND" &&
    (typeof row.quantity !== "string" ||
      !validManualAmount(row.quantity, true) ||
      typeof row.expenseRatio !== "string" ||
      (row.expenseRatio !== "" &&
        (!/^\d{1,3}(\.\d{1,4})?$/.test(row.expenseRatio) ||
          new Decimal(row.expenseRatio).gt(100))))
  )
    return "Check the units and expense ratio.";

  return null;
}

export function manualFundMetrics(
  purchases: { date: string; quantity: string; price: string }[],
  nav: { date: string; price: string } | null,
) {
  const quantity = purchases.reduce(
    (sum, p) => sum.plus(p.quantity),
    new Decimal(0),
  );
  const cost = purchases.reduce(
    (sum, p) => sum.plus(new Decimal(p.quantity).mul(p.price)),
    new Decimal(0),
  );
  const value =
    nav && purchases.every((p) => p.date <= nav.date)
      ? quantity.mul(nav.price)
      : null;
  const rate =
    value && nav
      ? xirr([
          ...purchases.map((p) => ({
            date: p.date,
            amount: new Decimal(p.quantity).mul(p.price).negated().toString(),
          })),
          { date: nav.date, amount: value.toString() },
        ])
      : null;

  return { quantity, cost, value, xirr: rate };
}

export function debtRecordedXirr(
  entries: {
    entry_type: "PURCHASE" | "INTEREST";
    date: string;
    amount: string;
  }[],
) {
  const purchases = entries.filter((entry) => entry.entry_type === "PURCHASE");
  const latest = entries.reduce(
    (day, entry) => (entry.date > day ? entry.date : day),
    "",
  );

  if (!purchases.length || !latest) return null;

  const balance = entries.reduce(
    (sum, entry) => sum.plus(entry.amount),
    new Decimal(0),
  );

  return xirr([
    ...purchases.map((entry) => ({
      date: entry.date,
      amount: new Decimal(entry.amount).negated().toString(),
    })),
    { date: latest, amount: balance.toString() },
  ]);
}
