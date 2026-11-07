"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; value: number; invested: number };

const ranges = [
  { label: "3M", count: 4 },
  { label: "6M", count: 7 },
  { label: "1Y", count: 12 },
  { label: "All", count: Infinity },
];

const money = (value: number) =>
  `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export function PerformanceChart({ history }: { history: Point[] }) {
  const [range, setRange] = useState("1Y");
  const points = history.slice(
    -(ranges.find((item) => item.label === range)?.count ?? history.length),
  );

  return (
    <>
      <div className="chart-toolbar">
        <div className="chart-legend">
          <span>
            <i className="legend-value" /> Portfolio value
          </span>
          <span>
            <i className="legend-invested" /> Invested amount
          </span>
        </div>
        <div className="range-controls" aria-label="Chart range">
          {ranges.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={range === item.label}
              onClick={() => setRange(item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="performance-chart"
        role="img"
        aria-label={`Sample portfolio value chart, ${range}. Starts at ${money(points[0].value)} and ends at ${money(points[points.length - 1].value)}. The invested amount is also shown.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b9d9c5" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#b9d9c5" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#e9ede8"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="date"
              tickFormatter={(date) =>
                new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
                  month: "short",
                })
              }
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#77877b", fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis
              width={58}
              tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
              domain={["dataMin - 50000", "dataMax + 50000"]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#77877b", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name) => [
                money(Number(value)),
                name === "value" ? "Portfolio value" : "Invested amount",
              ]}
              labelFormatter={(label) =>
                new Date(`${label}T00:00:00`).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              }
            />
            <Area
              type="monotone"
              dataKey="invested"
              stroke="#a9b7aa"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#397b5c"
              strokeWidth={2.5}
              fill="url(#portfolio-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-caption">
        Portfolio value includes contributions and market movement; it is not a
        return percentage.
      </p>
    </>
  );
}
