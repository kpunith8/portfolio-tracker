"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Decimal from "decimal.js";
import { clipPortfolioHistory } from "../../domain/portfolio-history";

type Point = {
  date: string;
  value: string | null;
  estimated: boolean;
  estimatedCount: number;
};
const ranges = ["7D", "30D", "3M", "6M", "1Y", "All"] as const;
type Range = (typeof ranges)[number];
const labelDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const money = (value: string) => {
  const [integer, fraction] = new Decimal(value).toFixed(2).split(".");
  return `₹${integer.replace(/\B(?=(\d{2})+(\d)(?!\d))/g, ",")}.${fraction}`;
};
function startFor(range: Range, asOf: string, first: string) {
  if (range === "All") return first;
  const date = new Date(`${asOf}T00:00:00Z`);
  if (range === "7D" || range === "30D")
    date.setUTCDate(date.getUTCDate() - (range === "7D" ? 7 : 30));
  else {
    const months = range === "3M" ? 3 : range === "6M" ? 6 : 12;
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - months);
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  }
  return date.toISOString().slice(0, 10);
}
export function PortfolioHistoryChart({
  history,
  asOf,
}: {
  history: Point[];
  asOf: string;
}) {
  const [range, setRange] = useState<Range>("1Y");
  const data = useMemo(() => {
    const first = history[0]?.date ?? asOf;
    const requested = startFor(range, asOf, first);
    const from = requested > first ? requested : first;
    const visible = clipPortfolioHistory(history, from, asOf);
    return visible.map((point) => ({
      ...point,
      timestamp: Date.parse(`${point.date}T00:00:00Z`),
      plot: point.value === null ? null : Number(point.value),
    }));
  }, [history, asOf, range]);
  const valid = data.filter(
    (point): point is typeof point & { value: string; plot: number } =>
      point.value !== null &&
      point.plot !== null &&
      Number.isFinite(point.plot),
  );
  const peak = valid.reduce<(typeof valid)[number] | null>(
    (a, b) => (!a || new Decimal(b.value).gt(a.value) ? b : a),
    null,
  );
  const trough = valid.reduce<(typeof valid)[number] | null>(
    (a, b) => (!a || new Decimal(b.value).lt(a.value) ? b : a),
    null,
  );
  return (
    <section
      className="real-panel portfolio-history-panel"
      aria-label="Portfolio value history"
    >
      <div className="panel-heading history-heading">
        <div>
          <h2>Portfolio value over time</h2>
          <p>Estimated from purchase costs and the latest available prices</p>
        </div>
        <div className="history-filters" aria-label="History date range">
          {ranges.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={range === option}
              onClick={() => setRange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <p className="panel-note">
        Historical points use the remaining purchase cost of shares held, not
        their historical market value. The latest point uses available FYERS
        quotes and falls back to cost where a quote is missing or predates a
        purchase. Purchases and sales affect the chart.
      </p>
      {valid.length >= 2 ? (
        <>
          <div className="portfolio-chart" aria-label="Portfolio value chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                accessibilityLayer
                margin={{ top: 20, right: 15, bottom: 5, left: 0 }}
              >
                <CartesianGrid stroke="#e8efea" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) =>
                    labelDate(new Date(v).toISOString().slice(0, 10)).replace(
                      / \d{4}$/,
                      "",
                    )
                  }
                  minTickGap={35}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#526a59" }}
                />
                <YAxis
                  width={70}
                  tickFormatter={(v: number) =>
                    `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`
                  }
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#526a59" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as
                      (typeof data)[number] | undefined;
                    return active &&
                      p?.value !== null &&
                      p?.value !== undefined ? (
                      <div className="history-tooltip">
                        <span>{labelDate(p.date)}</span>
                        <strong>{money(p.value)}</strong>
                        <span>
                          {p.estimated
                            ? `Estimated from purchase cost${p.estimatedCount ? ` · ${p.estimatedCount} holding${p.estimatedCount === 1 ? "" : "s"}` : ""}`
                            : "Latest available FYERS quotes"}
                        </span>
                      </div>
                    ) : null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="plot"
                  stroke="#357756"
                  strokeWidth={2.5}
                  fill="#e9f3ec"
                  connectNulls={false}
                  dot={{ r: 3, fill: "#357756" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                {peak && (
                  <ReferenceDot
                    x={peak.timestamp}
                    y={peak.plot}
                    r={5}
                    fill="#24663f"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
                {trough && trough.date !== peak?.date && (
                  <ReferenceDot
                    x={trough.timestamp}
                    y={trough.plot}
                    r={5}
                    fill="#a6322d"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="history-empty">
          <strong>
            {valid.length === 1
              ? `One complete value: ${money(valid[0].value)} on ${labelDate(valid[0].date)}`
              : "Not enough transactions for this period"}
          </strong>
          <p>
            Add a purchase to see your portfolio history. Missing sale
            allocations cannot be estimated.
          </p>
        </div>
      )}
      <p className="history-footnote">
        Historical values are cost estimates, not historical prices or
        investment returns. Latest quotes may be from different times or dates;
        the curve between recorded points is illustrative. Corporate-action
        adjustments are unverified.
      </p>
    </section>
  );
}
