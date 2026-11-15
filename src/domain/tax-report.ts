import Decimal from "decimal.js";

export type SaleLot = {
  sellId: string;
  symbol: string;
  sellDate: string;
  buyDate: string;
  quantity: string;
  buyPrice: string;
  sellPrice: string;
};

export function assessmentYear(date: string) {
  const [year, month] = date.split("-").map(Number);

  return year + (month >= 4 ? 1 : 0);
}

export function accrualPeriod(date: string) {
  const md = date.slice(5);

  if (md >= "04-01" && md <= "06-15") return 0;
  if (md >= "06-16" && md <= "09-15") return 1;
  if (md >= "09-16" && md <= "12-15") return 2;
  if (md >= "12-16" || md <= "03-15") return 3;

  return 4;
}

export function holdingTerm(buy: string, sell: string): "short" | "long" {
  const [year, month, day] = buy.split("-").map(Number);
  const anniversary = new Date(Date.UTC(year + 1, month - 1, day));

  // Clamp leap-day anniversaries to the last day of February.
  if (anniversary.getUTCMonth() !== month - 1) anniversary.setUTCDate(0);

  return sell > anniversary.toISOString().slice(0, 10) ? "long" : "short";
}

export function buildTaxReport(lots: SaleLot[]) {
  const groups = new Map<number, SaleLot[][]>();

  for (const lot of lots) {
    const year = assessmentYear(lot.sellDate);
    let periods = groups.get(year);

    if (!periods) {
      periods = Array.from({ length: 5 }, () => []);
      groups.set(year, periods);
    }

    periods[accrualPeriod(lot.sellDate)].push(lot);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, groupedPeriods]) => {
      const periods = groupedPeriods.map((lotsInPeriod) => {
        const rows = lotsInPeriod.map((lot) => ({
          ...lot,
          term: holdingTerm(lot.buyDate, lot.sellDate),
          gain: new Decimal(lot.sellPrice)
            .minus(lot.buyPrice)
            .mul(lot.quantity)
            .toString(),
        }));

        const total = (term: "short" | "long") =>
          rows
            .filter((row) => row.term === term)
            .reduce((sum, row) => sum.plus(row.gain), new Decimal(0))
            .toString();

        return { rows, short: total("short"), long: total("long") };
      });

      return {
        year,
        periods,
        short: periods
          .reduce((sum, period) => sum.plus(period.short), new Decimal(0))
          .toString(),
        long: periods
          .reduce((sum, period) => sum.plus(period.long), new Decimal(0))
          .toString(),
      };
    });
}
