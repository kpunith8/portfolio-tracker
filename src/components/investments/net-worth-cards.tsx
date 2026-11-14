"use client";

import Decimal from "decimal.js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRecordedDate } from "../../domain/market-date-utils";
import { combinedNetWorth } from "../../domain/net-worth";
import { manualFundMetrics } from "../../domain/manual-assets";
import { type ManualAssetData, money } from "./manual-assets";

export function NetWorthCards({
  manual,
  stocks,
  stockHistory,
}: {
  manual: ManualAssetData | null;
  stocks: string | null;
  stockHistory: { date: string; value: string | null }[];
}) {
  if (!manual)
    return (
      <section className="real-panel">
        <h2>Portfolio composition and net worth</h2>
        <p>
          Manual investment data is unavailable. Check the database connection.
        </p>
      </section>
    );

  const funds = manual.assets.filter((a) => a.asset_type === "MUTUAL_FUND");
  const debt = manual.assets.filter((a) => a.asset_type === "DEBT_OTHER");
  let fundValue = new Decimal(0);
  let missing = stocks === null;

  for (const asset of funds) {
    const purchases = manual.entries
      .filter(
        (e) => e.instrument_id === asset.id && e.entry_type === "PURCHASE",
      )
      .map((e) => ({ date: e.date, quantity: e.quantity!, price: e.amount }));
    const nav = manual.navs.find((n) => n.instrument_id === asset.id) ?? null;
    const value = manualFundMetrics(purchases, nav).value;

    if (purchases.length && value === null) missing = true;
    if (value !== null) fundValue = fundValue.plus(value);
  }

  const debtValue = manual.entries
    .filter((e) => debt.some((a) => a.id === e.instrument_id))
    .reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
  const parts = [
    {
      name: "Stocks",
      value: stocks === null ? 0 : Number(stocks),
      color: "#286a49",
    },
    { name: "Mutual funds", value: fundValue.toNumber(), color: "#537a86" },
    { name: "Debt & other", value: debtValue.toNumber(), color: "#82603d" },
  ];
  const history = combinedNetWorth(
    stockHistory,
    manual.assets,
    manual.entries,
    manual.navs,
  ).map((p) => ({
    ...p,
    timestamp: Date.parse(`${p.date}T00:00:00Z`),
    value: p.value === null ? null : Number(p.value),
  }));

  return (
    <div className="real-dashboard-grid net-worth-grid">
      <section className="real-panel">
        <div className="panel-heading">
          <div>
            <h2>Portfolio composition</h2>
            <p>Latest recorded values</p>
          </div>
        </div>
        {parts.some((p) => p.value > 0) ? (
          <>
            <div className="net-worth-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={parts}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="45%"
                    outerRadius="75%"
                  >
                    {parts.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      const item = payload?.[0]?.payload as
                        (typeof parts)[number] | undefined;

                      return active && item ? (
                        <div
                          className="history-tooltip"
                          style={{ color: item.color, borderColor: item.color }}
                        >
                          <span>{item.name}</span>
                          <strong>{money(new Decimal(item.value))}</strong>
                        </div>
                      ) : null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="composition-legend">
              {parts.map((p) => (
                <div key={p.name}>
                  <span>{p.name}</span>
                  <strong>{money(new Decimal(p.value))}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="panel-message">No recorded values available.</p>
        )}
        {missing && (
          <p className="panel-note">
            Some investments have no usable price or NAV and are excluded.
          </p>
        )}
      </section>
      <section className="real-panel">
        <div className="panel-heading">
          <div>
            <h2>Net worth over time</h2>
            <p>Recorded investment value across asset types</p>
          </div>
        </div>
        {history.some((p) => p.value !== null) ? (
          <div className="net-worth-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={history}
                accessibilityLayer
                margin={{ top: 20, right: 15, bottom: 5, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#e5eee7" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  minTickGap={35}
                  tickFormatter={(value: number) =>
                    formatRecordedDate(
                      new Date(value).toISOString().slice(0, 10),
                    )
                  }
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#526a59" }}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`
                  }
                  width={70}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#526a59" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as
                      (typeof history)[number] | undefined;

                    return active && point?.value != null ? (
                      <div className="history-tooltip">
                        <span>{formatRecordedDate(point.date)}</span>
                        <strong>{money(new Decimal(point.value))}</strong>
                      </div>
                    ) : null;
                  }}
                />
                <Area
                  type="linear"
                  dataKey="value"
                  stroke="#357756"
                  strokeWidth={2.5}
                  fill="#e9f3ec"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="panel-message">
            Net worth history is unavailable until dated values are recorded.
          </p>
        )}
        <p className="panel-note">
          Debt uses recorded principal and credits; fund NAVs use the latest
          recorded date. Missing stock closes or fund NAVs leave gaps. Values
          may be stale and include the effect of purchases.
        </p>
      </section>
    </div>
  );
}
