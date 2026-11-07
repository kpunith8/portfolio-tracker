"use client";

import { formatRecordedDate as labelDate } from "../../domain/market-date-utils";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Decimal from "decimal.js";
import { refreshDailyHistory } from "../../app/dashboard/market-actions";

type Point = {
  date: string;
  value: string | null;
  alternate: boolean;
};

const ranges = ["7D", "30D", "3M", "6M", "1Y", "All"] as const;

type Range = (typeof ranges)[number];

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
  const [status, setStatus] = useState("loading");
  const [updated, setUpdated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      const end = Date.now() + 5 * 60 * 1000;

      while (!cancelled && Date.now() < end) {
        const result = await refreshDailyHistory();

        if (cancelled) return;
        if (result === "updated") {
          setUpdated(true);
          setStatus("loading");
        } else if (result === "complete" || result === "partial") {
          setStatus(result);

          return;
        } else if (result === "reconnect" || result === "unavailable") {
          setStatus(result);

          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      if (!cancelled) setStatus("paused");
    }

    void sync().catch(() => {
      if (!cancelled) setStatus("unavailable");
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const data = useMemo(() => {
    const first = history[0]?.date ?? asOf;
    const requested = startFor(range, asOf, first);
    const from = requested > first ? requested : first;
    const visible = history.filter(
      (point) => point.date >= from && point.date <= asOf,
    );

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

  return (
    <section
      className="real-panel portfolio-history-panel"
      aria-label="Portfolio value history"
    >
      <div className="panel-heading history-heading">
        <div>
          <h2>Portfolio value over time</h2>
          <p>Value of recorded holdings at daily market close</p>
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
      <p className="panel-note" role="status">
        {status === "loading"
          ? "Updating missing history in the background. "
          : status === "reconnect"
            ? "Connect FYERS in Settings to update history. "
            : status === "unavailable"
              ? "Some history could not be loaded. "
              : status === "partial"
                ? "Some older prices are unavailable from FYERS. "
                : status === "paused"
                  ? "History update paused; revisit the dashboard to continue. "
                  : ""}
        {updated && (
          <button
            type="button"
            className="history-refresh"
            onClick={() => {
              setUpdated(false);
              router.refresh();
            }}
          >
            Show updated history
          </button>
        )}
        {(status === "paused" || status === "unavailable") && (
          <button
            type="button"
            className="history-refresh"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            Retry update
          </button>
        )}
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
                  tickFormatter={(v: number) => {
                    const date = labelDate(
                      new Date(v).toISOString().slice(0, 10),
                    );

                    return range === "All"
                      ? date.replace(/^\d+ /, "")
                      : date.replace(/ \d{4}$/, "");
                  }}
                  minTickGap={35}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#526a59" }}
                />
                <YAxis
                  width={70}
                  domain={([minimum, maximum]: readonly [number, number]) => {
                    const padding = Math.max(
                      (maximum - minimum) * 0.08,
                      maximum * 0.005,
                      1,
                    );

                    return [Math.max(0, minimum - padding), maximum + padding];
                  }}
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
                          {p.date === asOf
                            ? "Latest FYERS quote"
                            : p.alternate
                              ? "FYERS daily close · BSE data available"
                              : "FYERS daily close"}
                        </span>
                      </div>
                    ) : null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="plot"
                  baseValue="dataMin"
                  stroke="#357756"
                  strokeWidth={2.5}
                  fill="#e9f3ec"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="history-empty">
          <strong>
            {valid.length === 1
              ? `One complete value: ${money(valid[0].value)} on ${labelDate(valid[0].date)}`
              : "No complete history available for this period"}
          </strong>
          <p>Missing prices for any holding leave that date unavailable.</p>
        </div>
      )}
      <p className="history-footnote">
        Daily closes use recorded quantities and FYERS historical prices.
        Purchases and sales affect value; this is not investment return. FYERS
        adjusts prices for corporate actions; recorded quantities and cached
        prices may use a different basis. Missing NSE history may use BSE closes
        matched by ISIN. Dates with no prices for any holding are not shown;
        history may be incomplete. The vertical axis fits the selected range.
      </p>
    </section>
  );
}
