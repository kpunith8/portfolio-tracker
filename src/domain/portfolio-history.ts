import Decimal from "decimal.js";

type Trade = {
  instrument_id: string;
  type: string;
  transaction_date: string;
  quantity: string;
  unit_price: string;
  fees: string;
  taxes: string;
  sale_cost: string | null;
};

type Quote = { price: string; date: string };

export function portfolioHistory(
  trades: Trade[],
  quotes: Record<string, Quote>,
  from: string,
  to: string,
) {
  const dates = [
    ...new Set([
      from,
      to,
      ...trades
        .map((t) => t.transaction_date)
        .filter((date) => date >= from && date <= to),
    ]),
  ].sort();
  const sortedTrades = [...trades].sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date),
  );
  const positions = new Map<
    string,
    { quantity: Decimal; cost: Decimal; lastTrade: string; invalid: boolean }
  >();
  let tradeIndex = 0;
  let totalCost = new Decimal(0);
  let activeCount = 0;
  let invalidCount = 0;

  function contribution(
    p: { quantity: Decimal; cost: Decimal; invalid: boolean },
    direction: 1 | -1,
  ) {
    if (
      p.invalid ||
      p.quantity.isNegative() ||
      p.cost.isNegative() ||
      (p.quantity.isZero() && !p.cost.isZero())
    ) {
      invalidCount += direction;
    } else if (p.quantity.gt(0)) {
      totalCost =
        direction === 1 ? totalCost.plus(p.cost) : totalCost.minus(p.cost);
      activeCount += direction;
    }
  }

  return dates.map((date) => {
    while (
      tradeIndex < sortedTrades.length &&
      sortedTrades[tradeIndex].transaction_date <= date
    ) {
      const trade = sortedTrades[tradeIndex++];
      const p = positions.get(trade.instrument_id) ?? {
        quantity: new Decimal(0),
        cost: new Decimal(0),
        lastTrade: trade.transaction_date,
        invalid: false,
      };

      if (positions.has(trade.instrument_id)) contribution(p, -1);
      if (trade.type === "BUY") {
        p.quantity = p.quantity.plus(trade.quantity);
        p.cost = p.cost.plus(
          new Decimal(trade.quantity)
            .mul(trade.unit_price)
            .plus(trade.fees)
            .plus(trade.taxes),
        );
      } else {
        p.quantity = p.quantity.minus(trade.quantity);
        if (trade.sale_cost === null) p.invalid = true;
        else p.cost = p.cost.minus(trade.sale_cost);
      }

      p.lastTrade = trade.transaction_date;
      positions.set(trade.instrument_id, p);
      contribution(p, 1);
    }

    if (invalidCount > 0)
      return { date, value: null, estimated: true, estimatedCount: 0 };

    let total = totalCost;
    let estimatedCount = activeCount;

    if (date === to)
      for (const [id, p] of positions) {
        if (p.quantity.isZero()) continue;

        const quote = quotes[id];

        if (quote && quote.date <= to && quote.date >= p.lastTrade) {
          total = total.minus(p.cost).plus(p.quantity.mul(quote.price));
          estimatedCount--;
        }
      }

    return {
      date,
      value: total.toFixed(),
      estimated: estimatedCount > 0,
      estimatedCount,
    };
  });
}

export function clipPortfolioHistory<T extends { date: string }>(
  history: readonly T[],
  from: string,
  to: string,
): T[] {
  const visible = history.filter(
    (point) => point.date >= from && point.date <= to,
  );
  const prior = [...history].reverse().find((point) => point.date < from);

  if (prior && visible[0]?.date !== from)
    visible.unshift({ ...prior, date: from });

  return visible;
}
