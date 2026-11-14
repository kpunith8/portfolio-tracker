import Decimal from "decimal.js";

const Money = Decimal.clone({ precision: 64, rounding: Decimal.ROUND_HALF_UP });

export type NetWorthAsset = {
  id: string;
  asset_type: "MUTUAL_FUND" | "DEBT_OTHER";
};

export type NetWorthEntry = {
  instrument_id: string;
  entry_type: "PURCHASE" | "INTEREST";
  date: string;
  quantity: string | null;
  amount: string;
};

export type NetWorthNav = {
  instrument_id: string;
  date: string;
  price: string;
};

/** Add recorded manual balances to stock values only where every required value is available. */
export function combinedNetWorth(
  stockHistory: readonly { date: string; value: string | null }[],
  assets: readonly NetWorthAsset[],
  entries: readonly NetWorthEntry[],
  navs: readonly NetWorthNav[],
) {
  return stockHistory.map((point) => {
    if (point.value === null) return { date: point.date, value: null };

    let total = new Money(point.value);

    for (const asset of assets) {
      const past = entries.filter(
        (entry) => entry.instrument_id === asset.id && entry.date <= point.date,
      );
      const purchases = past.filter((entry) => entry.entry_type === "PURCHASE");

      if (!purchases.length) continue;
      if (asset.asset_type === "DEBT_OTHER") {
        total = past.reduce((sum, entry) => sum.plus(entry.amount), total);
      } else {
        const nav = navs
          .filter(
            (item) =>
              item.instrument_id === asset.id && item.date <= point.date,
          )
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const latestPurchase = purchases.reduce(
          (latest, entry) => (entry.date > latest ? entry.date : latest),
          "",
        );

        if (
          !nav ||
          nav.date < latestPurchase ||
          purchases.some((entry) => entry.quantity === null)
        )
          return { date: point.date, value: null };

        const units = purchases.reduce(
          (sum, entry) => sum.plus(entry.quantity!),
          new Money(0),
        );

        total = total.plus(units.mul(nav.price));
      }
    }

    return { date: point.date, value: total.toString() };
  });
}
