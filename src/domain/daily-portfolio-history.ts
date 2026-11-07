import Decimal from "decimal.js";

const Money = Decimal.clone({ precision: 64, rounding: Decimal.ROUND_HALF_UP });

type Trade = {
  instrument_id: string;
  type: string;
  transaction_date: string;
  quantity: string;
};

type Price = { instrument_id: string; market_date: string; price: string };

/** Value all holdings at each observed close; never substitute a missing price. */
export function dailyPortfolioHistory(
  trades: readonly Trade[],
  prices: readonly Price[],
) {
  const orderedTrades = [...trades].sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date),
  );
  const dates = [...new Set(prices.map((price) => price.market_date))].sort();
  const byDate = new Map<string, Map<string, string>>();

  for (const price of prices) {
    const row = byDate.get(price.market_date) ?? new Map<string, string>();

    row.set(price.instrument_id, price.price);
    byDate.set(price.market_date, row);
  }

  const quantities = new Map<string, Decimal>();
  let tradeIndex = 0;

  return dates.map((date) => {
    while (
      tradeIndex < orderedTrades.length &&
      orderedTrades[tradeIndex].transaction_date <= date
    ) {
      const trade = orderedTrades[tradeIndex++];

      if (trade.type !== "BUY" && trade.type !== "SELL") continue;

      const old = quantities.get(trade.instrument_id) ?? new Money(0);

      quantities.set(
        trade.instrument_id,
        trade.type === "BUY"
          ? old.plus(trade.quantity)
          : old.minus(trade.quantity),
      );
    }

    const closes = byDate.get(date);
    let value = new Money(0);

    for (const [instrument, quantity] of quantities) {
      if (quantity.isNegative()) return { date, value: null };
      if (quantity.isZero()) continue;

      const price = closes?.get(instrument);

      if (price === undefined) return { date, value: null };
      value = value.plus(quantity.mul(price));
    }

    return { date, value: value.toFixed() };
  });
}
