import Decimal from "decimal.js";
Decimal.set({ precision: 64, rounding: Decimal.ROUND_HALF_UP });

export type LotInput = {
  quantity: string;
  unit_price: string;
  fees: string;
  taxes: string;
  sold: string;
  allocated_cost: string;
};
export function remainingLot(lot: LotInput) {
  const quantity = new Decimal(lot.quantity);
  const remaining = quantity.minus(lot.sold);
  const cost = quantity
    .mul(lot.unit_price)
    .plus(lot.fees)
    .plus(lot.taxes)
    .minus(lot.allocated_cost);
  return { remaining, cost };
}

export function purchasePerformance(input: {
  quantity: string;
  purchaseCost: string;
  price: string | null;
  priceDate: string | null;
  purchaseDate: string;
}) {
  const { quantity, purchaseCost, price, priceDate, purchaseDate } = input;
  if (!price || !priceDate || purchaseDate >= priceDate) return null;
  const shares = new Decimal(quantity);
  const cost = new Decimal(purchaseCost);
  if (shares.lte(0) || cost.lte(0)) return null;
  const amount = shares.mul(price).minus(cost);
  return { amount, percent: amount.div(cost).mul(100) };
}

export function currentHoldingValue(
  quantity: string,
  price: string | null,
  priceDate: string | null,
  latestTrade: string,
) {
  if (price === null || !priceDate || priceDate < latestTrade) return null;
  return new Decimal(quantity).mul(price);
}
