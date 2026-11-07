import Decimal from "decimal.js";

/** Validate a normalized provider price without converting through a binary float. */
export function validMarketPrice(value: string): Decimal | null {
  const price = new Decimal(value);

  return price.isFinite() &&
    price.gt(0) &&
    price.lt("10000000000000000") &&
    price.decimalPlaces() <= 8
    ? price
    : null;
}
