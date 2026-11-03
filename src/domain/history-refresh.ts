type CachedBaseline = {
  period: string;
  instrument_id: string;
  as_of_date: string;
  status: string;
};
export function pendingHistoricalPeriods<P extends string>(
  periods: readonly P[],
  entries: readonly CachedBaseline[],
  instrumentId: string,
  asOf: string,
): P[] {
  return periods.filter(
    (period) =>
      !entries.some(
        (entry) =>
          entry.instrument_id === instrumentId &&
          entry.period === period &&
          entry.as_of_date === asOf &&
          entry.status === "AVAILABLE",
      ),
  );
}
