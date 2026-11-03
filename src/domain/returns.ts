import Decimal from "decimal.js";

const DAY = 86400000;
function daysBetween(from: string, to: string) {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY
  );
}
export function annualizedReturn(
  cost: string,
  value: string,
  from: string,
  to: string,
) {
  const days = daysBetween(from, to);
  const base = new Decimal(cost);
  const end = new Decimal(value);
  if (!Number.isFinite(days) || days <= 0 || base.lte(0) || end.lte(0))
    return null;
  return end.div(base).pow(new Decimal(365).div(days)).minus(1).mul(100);
}
export function quantityAt(
  trades: { type: string; transaction_date: string; quantity: string }[],
  asOf: string,
) {
  const relevant = trades.filter((t) => t.transaction_date <= asOf);
  const quantity = relevant.reduce(
    (total, t) =>
      t.type === "BUY" ? total.plus(t.quantity) : total.minus(t.quantity),
    new Decimal(0),
  );
  return quantity.isNegative() ? null : quantity;
}
export function xirr(flows: { date: string; amount: string }[]) {
  const grouped = new Map<string, Decimal>();
  for (const flow of flows)
    grouped.set(
      flow.date,
      (grouped.get(flow.date) ?? new Decimal(0)).plus(flow.amount),
    );
  const items = [...grouped]
    .filter(([, amount]) => !amount.isZero())
    .sort(([a], [b]) => a.localeCompare(b));
  if (items.length < 2 || items[0][1].gte(0) || items.at(-1)![1].lte(0))
    return null;
  let transitions = 0;
  for (let i = 1; i < items.length; i++)
    if (items[i][1].isNegative() !== items[i - 1][1].isNegative())
      transitions++;
  if (transitions !== 1) return null;
  const elapsed = items.map(([d]) => daysBetween(items[0][0], d));
  if (elapsed.some((d) => !Number.isFinite(d)) || elapsed.at(-1)! <= 0)
    return null;
  const npv = (rate: Decimal) =>
    items.reduce(
      (sum, [, amount], i) =>
        sum.plus(
          amount.div(rate.plus(1).pow(new Decimal(elapsed[i]).div(365))),
        ),
      new Decimal(0),
    );
  let low = new Decimal("-0.999999"),
    high = new Decimal("10000");
  if (npv(low).lte(0) || npv(high).gte(0)) return null;
  for (let i = 0; i < 150; i++) {
    const mid = low.plus(high).div(2);
    if (npv(mid).gt(0)) low = mid;
    else high = mid;
  }
  return low.plus(high).div(2).mul(100);
}
