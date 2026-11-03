"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  refreshHistoricalPrice,
  refreshPortfolioQuotes,
} from "../../app/dashboard/market-actions";
import { currentHoldingValue, remainingLot } from "../../domain/holdings";
import { displayCompanyName } from "../../domain/company-name";
import { pendingHistoricalPeriods } from "../../domain/history-refresh";
import dynamic from "next/dynamic";
import { annualizedReturn, quantityAt, xirr } from "../../domain/returns";
import type { MarketStatus } from "../../server/market-data/fyers";
import Decimal from "decimal.js";
import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  LoaderCircle,
  X,
} from "lucide-react";
import { recordTrade } from "../../app/dashboard/trade-actions";

Decimal.set({ precision: 64, rounding: Decimal.ROUND_HALF_UP });

const PortfolioHistoryChart = dynamic(
  () =>
    import("./portfolio-history-chart").then(
      (module) => module.PortfolioHistoryChart,
    ),
  {
    loading: () => (
      <section
        className="real-panel portfolio-history-panel chart-loading-panel"
        aria-busy="true"
        aria-label="Portfolio value chart"
      >
        <h2>Portfolio value over time</h2>
        <p>Preparing your portfolio history</p>
        <div className="portfolio-chart chart-loading" role="status">
          <LoaderCircle size={24} aria-hidden="true" />
          <span>Loading chart…</span>
        </div>
      </section>
    ),
  },
);

type Instrument = {
  id: string;
  name: string;
  trading_symbol: string;
  unit: string;
  price: string | null;
  market_date: string | null;
  retrieved_at: string | null;
};
type Transaction = {
  id: string;
  instrument_id: string;
  type: string;
  transaction_date: string;
  quantity: string;
  unit_price: string;
  fees: string;
  taxes: string;
  sold: string;
  allocated_cost: string;
  sale_cost: string | null;
  charges_missing: boolean | null;
};
type Baseline = {
  instrument_id: string;
  period: string;
  as_of_date: string;
  target_date: string;
  market_date: string | null;
  price: string | null;
  status: string;
};
type Data = {
  instruments: Instrument[];
  transactions: Transaction[];
  baselines: Baseline[];
  summaries: { id: string; quantity: string; cost: string; latest: string }[];
  history: {
    date: string;
    value: string | null;
    estimated: boolean;
    estimatedCount: number;
  }[];
  chargesMissing: boolean;
  total: number;
  page: number;
};
const n = (s: string) => new Decimal(s);
const fmt = (v: Decimal | null) => {
  if (v === null) return "Unavailable";
  const [whole, fraction] = v.abs().toFixed(2).split(".");
  const grouped =
    whole.length > 3
      ? whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") +
        "," +
        whole.slice(-3)
      : whole;
  return `${v.isNegative() ? "−" : ""}₹${grouped}.${fraction}`;
};
const date = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const tickerTone = (symbol: string) => {
  let hash = 0;
  for (const character of symbol)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 8;
};
async function refreshQuotesWithRetry() {
  let throttled = 0;
  let updated = false;
  while (true) {
    const status = await refreshPortfolioQuotes();
    if (status === "more") {
      updated = true;
      throttled = 0;
    } else if (status === "throttled" && throttled++ < 6) {
      // Retry after the shared provider rate slot becomes available.
    } else {
      return status === "cached" && updated ? "current" : status;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 2200));
  }
}
const PER_PAGE = 20;
const sortOptions = [
  { value: "date", label: "Date, newest first" },
  { value: "value", label: "Current asset value" },
] as const;

function SortMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const selected =
    sortOptions.find((option) => option.value === value) ?? sortOptions[0];
  useEffect(() => {
    if (open)
      items.current[
        sortOptions.findIndex((option) => option.value === selected.value)
      ]?.focus();
  }, [open, selected.value]);
  return (
    <div
      className="sort-menu"
      ref={root}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="sort-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ArrowDownWideNarrow size={17} aria-hidden="true" />
        <span>
          <span className="sort-prefix">Sort:</span> {selected.label}
        </span>
        <ChevronDown className="sort-caret" size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="sort-popover"
          role="menu"
          aria-label="Sort by"
          onKeyDown={(event) => {
            const current = items.current.findIndex(
              (item) => item === document.activeElement,
            );
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            } else if (
              ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? sortOptions.length - 1
                    : (current +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        sortOptions.length) %
                      sortOptions.length;
              items.current[next]?.focus();
            }
          }}
        >
          <span className="sort-menu-title" aria-hidden="true">
            Sort by
          </span>
          {sortOptions.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                items.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              className="sort-option"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function TradeModal({
  instruments,
  type,
  lot,
  close,
}: {
  instruments: Instrument[];
  type: "BUY" | "SELL";
  lot?: Transaction;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(recordTrade, {});
  const router = useRouter();
  const [selected, setSelected] = useState(
    lot?.instrument_id || (type === "BUY" ? "new" : instruments[0]?.id || ""),
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (state.success) {
      router.refresh();
      close();
    }
  }, [state.success, router, close]);
  return (
    <dialog ref={dialog} className="trade-dialog" onClose={close}>
      <div className="trade-dialog-header">
        <div>
          <h2>{type === "BUY" ? "Record a purchase" : "Record a sale"}</h2>
          <p>Enter the details from your investment records.</p>
        </div>
        <button type="button" aria-label="Close" onClick={close}>
          <X size={19} />
        </button>
      </div>
      <form action={action} className="trade-form">
        <input type="hidden" name="type" value={type} />
        {lot && <input type="hidden" name="lot" value={lot.id} />}
        <label>
          Stock
          <span className="select-shell">
            <select
              name="instrument"
              value={selected === "new" ? "" : selected}
              onChange={(e) => setSelected(e.target.value || "new")}
              required={type === "SELL"}
              disabled={!!lot}
            >
              {type === "BUY" && <option value="">Add a new NSE ticker</option>}
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.trading_symbol}
                </option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </label>
        {lot && (
          <input type="hidden" name="instrument" value={lot.instrument_id} />
        )}{" "}
        {selected === "new" && (
          <label>
            NSE ticker symbol
            <input
              name="symbol"
              placeholder="e.g. HINDALCO"
              maxLength={30}
              required
              autoComplete="off"
            />
            <small>Use the NSE trading symbol from your contract note.</small>
          </label>
        )}
        <label>
          Quantity
          <input
            type="text"
            name="quantity"
            inputMode="numeric"
            pattern="[0-9]+"
            required
            placeholder="0"
          />
          <small>
            {lot
              ? `Up to ${n(lot.quantity).minus(lot.sold).toString()} units in this purchase; oldest purchases are sold first.`
              : "Enter the whole number of shares or units bought or sold."}
          </small>
        </label>
        <label>
          {type === "BUY" ? "Purchase price per share" : "Sale price per share"}
          <input
            type="text"
            name="price"
            inputMode="decimal"
            required
            placeholder="0.00"
          />
        </label>
        <label>
          {type === "BUY" ? "Purchase date" : "Sale date"}
          <input type="date" name="date" required />
        </label>
        {state.error && (
          <p className="trade-error" role="alert">
            {state.error}
          </p>
        )}
        <p className="trade-note">
          Brokerage, charges and taxes are not captured yet. Do not use these
          figures for tax filing.
        </p>
        <div className="trade-buttons">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : type === "BUY"
                ? "Save purchase"
                : "Save sale"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function LiveViews({
  data,
  view,
  detailId,
  marketStatus,
  asOf,
  initialSort,
}: {
  data: Data;
  view: "portfolio" | "transactions" | "dashboard";
  detailId?: string;
  marketStatus: MarketStatus;
  asOf: string;
  initialSort: "date" | "value";
}) {
  const [modal, setModal] = useState<{
    type: "BUY" | "SELL";
    lot?: Transaction;
  } | null>(null);
  const router = useRouter();
  const [quoteStatus, setQuoteStatus] = useState<MarketStatus>(marketStatus);
  const quoteRequest = useRef<Promise<MarketStatus> | null>(null);
  const pageKey = `${data.page}:${initialSort}`;
  useEffect(() => {
    if (view !== "dashboard" && view !== "portfolio") return;
    let cancelled = false;
    const request = quoteRequest.current ?? refreshQuotesWithRetry();
    quoteRequest.current = request;
    void request
      .then((status) => {
        if (cancelled) return;
        setQuoteStatus(status);
        if (status === "current" || status === "unavailable") router.refresh();
      })
      .catch(() => {
        if (!cancelled) setQuoteStatus("unavailable");
      })
      .finally(() => {
        if (quoteRequest.current === request) quoteRequest.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [view, router, detailId, pageKey]);
  const [asset, setAsset] = useState("Stocks");
  const sort = initialSort;
  const page = data.page;
  function navigateList(nextPage: number, nextSort: string) {
    const params = new URLSearchParams({
      view,
      page: String(nextPage),
      sort: nextSort,
    });
    router.push(`/dashboard?${params.toString()}`);
  }

  const holdings = useMemo(() => {
    if (view === "dashboard")
      return data.summaries.flatMap((summary) => {
        const i = data.instruments.find(
          (instrument) => instrument.id === summary.id,
        );
        if (!i) return [];
        const quantity = n(summary.quantity);
        const cost = n(summary.cost);
        const value = currentHoldingValue(
          quantity.toString(),
          i.price,
          i.market_date,
          summary.latest,
        );
        return [
          {
            i,
            lots: [],
            quantity,
            cost,
            value,
            profit: value?.minus(cost) ?? null,
            latest: summary.latest,
          },
        ];
      });
    return data.instruments
      .map((i) => {
        const lots = data.transactions
          .filter((t) => t.instrument_id === i.id && t.type === "BUY")
          .map((t) => ({ ...t, ...remainingLot(t) }))
          .filter((t) => t.remaining.gt(0));
        const quantity = lots.reduce((a, t) => a.plus(t.remaining), n("0"));
        const cost = lots.reduce((a, t) => a.plus(t.cost), n("0"));
        const latestTrade = data.transactions
          .filter((t) => t.instrument_id === i.id)
          .reduce(
            (latest, t) =>
              t.transaction_date > latest ? t.transaction_date : latest,
            "",
          );
        const value = currentHoldingValue(
          quantity.toString(),
          i.price,
          i.market_date,
          latestTrade,
        );
        return {
          i,
          lots,
          quantity,
          cost,
          value,
          profit: value?.minus(cost) ?? null,
          latest: lots.reduce(
            (latest, l) =>
              l.transaction_date > latest ? l.transaction_date : latest,
            "",
          ),
        };
      })
      .filter((h) => h.quantity.gt(0));
  }, [data, view]);
  const sortedHoldings = useMemo(
    () =>
      [...holdings].sort((a, b) =>
        sort === "value"
          ? (b.value ?? n("-1")).cmp(a.value ?? n("-1"))
          : b.latest.localeCompare(a.latest),
      ),
    [holdings, sort],
  );
  const orderedTransactions = data.transactions;
  const details = detailId
    ? holdings.find((h) => h.i.id === detailId)
    : undefined;
  const items = view === "transactions" ? orderedTransactions : sortedHoldings;
  if (view === "portfolio" && detailId)
    return details ? (
      <InstrumentDetails
        key={`${details.i.id}:${asOf}`}
        holding={details}
        data={data}
        marketStatus={quoteStatus}
        asOf={asOf}
      />
    ) : (
      <div className="sample-page">
        <Link className="text-link" href="/dashboard?view=portfolio">
          ← Back to portfolio
        </Link>
        <h1>Investment not found</h1>
        <p>This investment is not available in your portfolio.</p>
      </div>
    );
  const currentPage = page;
  const visibleHoldings = sortedHoldings;
  const quoteDates = [
    ...new Set(
      visibleHoldings.flatMap((h) =>
        h.i.price !== null && h.i.market_date ? [h.i.market_date] : [],
      ),
    ),
  ];
  const sharedQuoteDate = quoteDates.length === 1 ? quoteDates[0] : null;
  return (
    <div className="sample-page">
      <header className="sample-heading">
        <div>
          <h1>
            {view === "transactions"
              ? "Transactions"
              : view === "dashboard"
                ? "Dashboard"
                : "Portfolio"}
          </h1>
          <p>
            {view === "transactions"
              ? "Your recorded purchases and sales."
              : "Your investments, based on your recorded transactions."}
          </p>
        </div>
        <button
          className="trade-primary"
          onClick={() => setModal({ type: "BUY" })}
        >
          Record purchase
        </button>
      </header>
      {data.chargesMissing && (
        <p className="ledger-notice">
          Some imported purchase costs exclude brokerage and taxes because those
          charges were not provided.
        </p>
      )}
      <MarketNotice status={view === "transactions" ? "cached" : quoteStatus} />
      {view === "dashboard" ? (
        <DashboardOverview
          holdings={holdings}
          transactions={orderedTransactions}
          instruments={data.instruments}
          history={data.history}
          asOf={asOf}
        />
      ) : (
        <section className="sample-list">
          <div className="sample-list-top">
            <div>
              <h2>
                {view === "transactions" ? "Activity" : "Your investments"}
              </h2>
              <p>
                {view === "transactions"
                  ? "Sales remain in your history."
                  : "Expand a stock to review purchases and record a sale."}
              </p>
              {view === "portfolio" &&
                asset === "Stocks" &&
                quoteDates.length > 0 && (
                  <p>
                    {sharedQuoteDate
                      ? `FYERS prices · ${date(sharedQuoteDate)}`
                      : "FYERS prices · Dates vary by investment"}
                  </p>
                )}
            </div>
            <SortMenu
              value={sort}
              onChange={(value) => {
                navigateList(1, value);
              }}
            />
          </div>
          {view === "portfolio" && (
            <div className="sample-tabs">
              {["Stocks", "Mutual funds", "Debt & other"].map((t) => (
                <button
                  className={`sample-tab ${asset === t ? "active" : ""}`}
                  aria-pressed={asset === t}
                  key={t}
                  onClick={() => {
                    setAsset(t);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {view === "portfolio" && asset !== "Stocks" ? (
            <div className="sample-empty">
              <h2>{asset} coming later</h2>
              <p>Stock investments are available now.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="sample-empty">
              <h2>
                {view === "transactions"
                  ? "No transactions yet"
                  : "No investments yet"}
              </h2>
              <p>Record a purchase to start your portfolio.</p>
            </div>
          ) : view === "portfolio" ? (
            <div className="sample-holdings">
              <div className="sample-columns" aria-hidden="true">
                <span>Investment</span>
                <span>Quantity / avg. cost</span>
                <span>Current value</span>
                <span>Unrealized P&amp;L</span>
                <span />
              </div>
              {visibleHoldings.map((h) => (
                <div className="holding-entry" key={h.i.id}>
                  <details className="sample-holding">
                    <summary>
                      <span className="sample-company">
                        <span
                          className={`sample-mark ticker-tone-${tickerTone(h.i.trading_symbol)}`}
                        >
                          {h.i.trading_symbol.slice(0, 2)}
                        </span>
                        <span>
                          <strong>{displayCompanyName(h.i.name)}</strong>
                          <small>{h.i.trading_symbol} · NSE</small>
                        </span>
                      </span>
                      <span className="sample-cell">
                        <strong>
                          {h.quantity.toString()}{" "}
                          {h.i.unit === "unit" ? "units" : "shares"}
                        </strong>
                        <small>Avg. {fmt(h.cost.div(h.quantity))}</small>
                      </span>
                      <span className="sample-cell">
                        <strong>{fmt(h.value)}</strong>
                        <small>
                          {h.i.market_date
                            ? `${fmt(n(h.i.price!))} / ${h.i.unit}${sharedQuoteDate ? "" : ` · FYERS ${date(h.i.market_date)}`}`
                            : "No market price"}
                        </small>
                      </span>
                      <span
                        className={`sample-cell ${h.profit === null ? "" : h.profit.isNegative() ? "sample-negative" : "sample-positive"}`}
                      >
                        <strong>{fmt(h.profit)}</strong>
                        <small>
                          {h.profit === null || h.cost.isZero()
                            ? "P&L unavailable"
                            : `${h.profit.div(h.cost).mul(100).toFixed(2)}%`}
                        </small>
                      </span>
                      <ChevronDown
                        className="sample-chevron"
                        size={17}
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="sample-lots">
                      <div className="sample-lot-scroll">
                        <table
                          aria-label={`Purchases for ${h.i.trading_symbol}`}
                        >
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Quantity remaining</th>
                              <th>Buy price</th>
                              <th>Invested</th>
                              <th>Current value</th>
                              <th>Current P&amp;L</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {h.lots.map((l) => (
                              <tr key={l.id}>
                                <td>{date(l.transaction_date)}</td>
                                <td>
                                  {l.remaining.toString()} of{" "}
                                  {n(l.quantity).toString()}
                                </td>
                                <td>{fmt(n(l.unit_price))}</td>
                                <td>{fmt(l.cost)}</td>
                                <td>
                                  {fmt(
                                    h.value === null || h.i.price === null
                                      ? null
                                      : l.remaining.mul(h.i.price),
                                  )}
                                </td>
                                <td
                                  className={
                                    h.value === null || h.i.price === null
                                      ? ""
                                      : l.remaining
                                            .mul(h.i.price)
                                            .minus(l.cost)
                                            .isNegative()
                                        ? "sample-negative"
                                        : "sample-positive"
                                  }
                                >
                                  {h.value === null || h.i.price === null ? (
                                    "Unavailable"
                                  ) : (
                                    <>
                                      <strong>
                                        {fmt(
                                          l.remaining
                                            .mul(h.i.price)
                                            .minus(l.cost),
                                        )}
                                      </strong>
                                      <small>
                                        {l.cost.isZero()
                                          ? "Percentage unavailable"
                                          : `${l.remaining.mul(h.i.price).minus(l.cost).div(l.cost).mul(100).toFixed(2)}%`}
                                      </small>
                                    </>
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setModal({ type: "SELL", lot: l })
                                    }
                                  >
                                    Record sale
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                  <Link
                    className="holding-details-link"
                    href={`/dashboard?view=portfolio&instrument=${h.i.id}`}
                  >
                    View details{" "}
                    <span className="sr-only">for {h.i.trading_symbol}</span>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="sample-transaction-scroll"
              tabIndex={0}
              aria-label="Scrollable transaction table"
            >
              <table className="sample-transactions">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Stock</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Current asset value</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedTransactions.map((t) => {
                    const i = data.instruments.find(
                      (i) => i.id === t.instrument_id,
                    );
                    return (
                      <tr key={t.id}>
                        <td>{date(t.transaction_date)}</td>
                        <td>{i?.trading_symbol || "Unavailable"}</td>
                        <td>{t.type}</td>
                        <td>{n(t.quantity).toString()}</td>
                        <td>{fmt(n(t.unit_price))}</td>
                        <td>
                          {i?.price
                            ? fmt(n(t.quantity).mul(i.price))
                            : "Unavailable"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.total > PER_PAGE && (
            <nav className="page-controls" aria-label="Pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => navigateList(currentPage - 1, sort)}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {Math.ceil(data.total / PER_PAGE)}
              </span>
              <button
                disabled={currentPage * PER_PAGE >= data.total}
                onClick={() => navigateList(currentPage + 1, sort)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}
      {modal && (
        <TradeModal
          key={`${modal.type}-${modal.lot?.id || "new"}`}
          instruments={data.instruments}
          type={modal.type}
          lot={modal.lot}
          close={() => setModal(null)}
        />
      )}
    </div>
  );
}

type Holding = {
  i: Instrument;
  lots: Array<Transaction & { remaining: Decimal; cost: Decimal }>;
  quantity: Decimal;
  cost: Decimal;
  value: Decimal | null;
  profit: Decimal | null;
  latest: string;
};
function MarketNotice({ status }: { status: MarketStatus }) {
  if (status === "current" || status === "cached") return null;
  return (
    <div className="market-notice" role="status">
      {status === "reconnect" ? (
        <>
          Connect FYERS in <Link href="/dashboard?view=settings">Settings</Link>{" "}
          to update market prices. Any saved prices remain dated.
        </>
      ) : status === "throttled" ? (
        "Price updates are temporarily rate limited. Showing saved prices where available."
      ) : (
        "Some prices could not be updated. Showing saved prices where available."
      )}
    </div>
  );
}
function DashboardOverview({
  holdings,
  transactions,
  instruments,
  history,
  asOf,
}: {
  holdings: Holding[];
  transactions: Transaction[];
  instruments: Instrument[];
  history: Data["history"];
  asOf: string;
}) {
  const priced = holdings.filter((h) => h.value !== null);
  const missing = holdings.length - priced.length;
  const totalCost = holdings.reduce((sum, h) => sum.plus(h.cost), n("0"));
  const totalValue = priced.reduce((sum, h) => sum.plus(h.value!), n("0"));
  const sharesValue = priced
    .filter((h) => h.i.unit !== "unit")
    .reduce((sum, h) => sum.plus(h.value!), n("0"));
  const unitsValue = priced
    .filter((h) => h.i.unit === "unit")
    .reduce((sum, h) => sum.plus(h.value!), n("0"));
  const profit =
    missing === 0 && holdings.length ? totalValue.minus(totalCost) : null;
  const top = [...priced].sort((a, b) => b.value!.cmp(a.value!)).slice(0, 5);
  const maximum = top[0]?.value ?? n("0");
  return (
    <>
      <section className="overview-metrics" aria-label="Portfolio summary">
        <div>
          <span>{missing ? "Available value" : "Portfolio value"}</span>
          <strong>{priced.length ? fmt(totalValue) : "Unavailable"}</strong>
          <small>
            {missing
              ? `${missing} investment${missing === 1 ? "" : "s"} without a price`
              : "Latest available FYERS prices"}
          </small>
        </div>
        <div>
          <span>Invested amount</span>
          <strong>{holdings.length ? fmt(totalCost) : "—"}</strong>
          <small>Remaining purchase cost</small>
        </div>
        <div>
          <span>Unrealized P&L</span>
          <strong
            className={
              profit === null
                ? ""
                : profit.isNegative()
                  ? "sample-negative"
                  : "sample-positive"
            }
          >
            {fmt(profit)}
          </strong>
          <small>
            {profit === null || totalCost.isZero()
              ? "Requires a price for every holding"
              : `${profit.div(totalCost).mul(100).toFixed(2)}% of invested amount`}
          </small>
        </div>
      </section>
      <PortfolioHistoryChart history={history} asOf={asOf} />
      <div className="real-dashboard-grid">
        <section className="real-panel">
          <div className="panel-heading">
            <div>
              <h2>Largest investments</h2>
              <p>By latest available value</p>
            </div>
            <Link href="/dashboard?view=portfolio" className="text-link">
              View portfolio
            </Link>
          </div>
          {top.length ? (
            <div className="holding-bars">
              {top.map((h) => (
                <div key={h.i.id}>
                  <div className="bar-heading">
                    <span>{h.i.trading_symbol}</span>
                    <strong>{fmt(h.value)}</strong>
                  </div>
                  <div className="bar-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${maximum.isZero() ? "0" : h.value!.div(maximum).mul(100).toFixed(2)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-message">
              No market values are available yet. Connect FYERS to update
              prices.
            </p>
          )}
          {missing > 0 && (
            <p className="panel-note">
              {missing} investments without prices are not included in this
              chart.
            </p>
          )}
        </section>
        <section className="real-panel recent-activity">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Your latest recorded transactions</p>
            </div>
            <Link href="/dashboard?view=transactions" className="text-link">
              View all
            </Link>
          </div>
          {transactions.length ? (
            <div className="recent-list">
              {transactions.slice(0, 5).map((t) => {
                const instrument = instruments.find(
                  (i) => i.id === t.instrument_id,
                );
                return (
                  <div className="recent-item" key={t.id}>
                    <div>
                      <strong>
                        {instrument
                          ? displayCompanyName(instrument.name)
                          : "Investment"}
                      </strong>
                      <small>
                        {t.type === "BUY" ? "Purchase" : "Sale"} ·{" "}
                        {n(t.quantity).toString()}{" "}
                        {instrument?.unit === "unit" ? "units" : "shares"} ·{" "}
                        {date(t.transaction_date)}
                      </small>
                    </div>
                    <strong>{fmt(n(t.quantity).mul(t.unit_price))}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="panel-message">
              No transactions have been recorded yet.
            </p>
          )}
        </section>
      </div>
      <section className="real-panel allocation-summary">
        <div className="panel-heading">
          <div>
            <h2>Portfolio composition</h2>
            <p>Based on available prices</p>
          </div>
        </div>
        {priced.length > 0 && !totalValue.isZero() ? (
          <>
            <div className="composition-bar" aria-hidden="true">
              <span
                style={{
                  width: `${sharesValue.div(totalValue).mul(100).toFixed(2)}%`,
                }}
              />
              <span
                style={{
                  width: `${unitsValue.div(totalValue).mul(100).toFixed(2)}%`,
                }}
              />
            </div>
            <div className="composition-legend">
              <div>
                <span>
                  <i className="composition-dot shares" />
                  Shares
                </span>
                <strong>{fmt(sharesValue)}</strong>
                <small>
                  {sharesValue.div(totalValue).mul(100).toFixed(1)}%
                </small>
              </div>
              <div>
                <span>
                  <i className="composition-dot units" />
                  Listed units
                </span>
                <strong>{fmt(unitsValue)}</strong>
                <small>{unitsValue.div(totalValue).mul(100).toFixed(1)}%</small>
              </div>
            </div>
            {missing > 0 && (
              <p className="panel-note">
                Investments without prices are excluded from this chart.
              </p>
            )}
          </>
        ) : (
          <p className="panel-message">
            Composition will appear when market prices are available.
          </p>
        )}
      </section>
    </>
  );
}
const historyPeriods = ["7D", "30D", "90D", "6M", "365D"] as const;
const periodLabels: Record<string, string> = {
  "7D": "7 days",
  "30D": "30 days",
  "90D": "90 days",
  "6M": "6 months",
  "365D": "365 days",
};
function InstrumentDetails({
  holding,
  data,
  marketStatus,
  asOf,
}: {
  holding: Holding;
  data: Data;
  marketStatus: MarketStatus;
  asOf: string;
}) {
  const router = useRouter();
  const baselines = useMemo(
    () =>
      historyPeriods.map((period) => ({
        period,
        data: data.baselines.find(
          (b) => b.instrument_id === holding.i.id && b.period === period,
        ),
      })),
    [data.baselines, holding.i.id],
  );
  const [pendingPeriods] = useState(() =>
    pendingHistoricalPeriods(
      historyPeriods,
      data.baselines,
      holding.i.id,
      asOf,
    ),
  );
  const [historyState, setHistoryState] = useState<
    "loading" | "done" | "partial" | "reconnect"
  >(() => (pendingPeriods.length ? "loading" : "done"));
  useEffect(() => {
    if (!pendingPeriods.length) return;
    let cancelled = false;
    const wait = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 2200));
    async function load() {
      setHistoryState("loading");
      let partial = false;
      for (let index = 0; index < pendingPeriods.length; index++) {
        if (cancelled) return;
        let result = await refreshHistoricalPrice(
          holding.i.id,
          pendingPeriods[index],
        );
        for (
          let retry = 0;
          result === "throttled" && retry < 3 && !cancelled;
          retry++
        ) {
          await wait();
          if (!cancelled)
            result = await refreshHistoricalPrice(
              holding.i.id,
              pendingPeriods[index],
            );
        }
        if (cancelled) return;
        if (result === "reconnect") {
          setHistoryState("reconnect");
          router.refresh();
          return;
        }
        if (result === "updated" && index < pendingPeriods.length - 1)
          await wait();
        if (result === "unavailable" || result === "throttled") partial = true;
      }
      if (!cancelled) {
        setHistoryState(partial ? "partial" : "done");
        router.refresh();
      }
    }
    void load().catch(() => {
      if (!cancelled) {
        setHistoryState("partial");
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [holding.i.id, pendingPeriods, router]);
  const trades = useMemo(
    () => data.transactions.filter((t) => t.instrument_id === holding.i.id),
    [data.transactions, holding.i.id],
  );
  const priceDate = holding.i.market_date;
  const investmentXirr = useMemo(() => {
    if (
      !priceDate ||
      holding.value === null ||
      !trades.every((t) => t.transaction_date <= priceDate)
    )
      return null;
    const flows = trades.map((t) => ({
      date: t.transaction_date,
      amount: (t.type === "BUY"
        ? n(t.quantity).mul(t.unit_price).plus(t.fees).plus(t.taxes).negated()
        : n(t.quantity).mul(t.unit_price).minus(t.fees).minus(t.taxes)
      ).toString(),
    }));
    return xirr([
      ...flows,
      { date: priceDate, amount: holding.value.toString() },
    ]);
  }, [trades, priceDate, holding.value]);
  const chartPoints = [...baselines].reverse().map(({ period, data: b }) => {
    const quantity = b?.market_date ? quantityAt(trades, b.market_date) : null;
    return {
      label: periodLabels[period],
      date: b?.market_date ?? null,
      quantity,
      value: quantity !== null && b?.price ? quantity.mul(b.price) : null,
    };
  });
  const latestQuantity = priceDate ? quantityAt(trades, priceDate) : null;
  chartPoints.push({
    label: "Latest",
    date: priceDate,
    quantity: latestQuantity,
    value:
      latestQuantity !== null && holding.i.price !== null
        ? latestQuantity.mul(holding.i.price)
        : null,
  });
  const chartMax = chartPoints.reduce(
    (max, point) => (point.value ? Decimal.max(max, point.value) : max),
    n("0"),
  );
  return (
    <div className="sample-page detail-page">
      <Link href="/dashboard?view=portfolio" className="detail-back">
        ← Portfolio
      </Link>
      <header className="sample-heading detail-header">
        <div>
          <h1>{displayCompanyName(holding.i.name)}</h1>
          <p>{holding.i.trading_symbol} · NSE</p>
        </div>
        <div className="detail-current">
          <span>Latest available price</span>
          <strong>
            {holding.i.price === null ? "Unavailable" : fmt(n(holding.i.price))}
          </strong>
          <small>
            {holding.i.market_date
              ? `FYERS date: ${date(holding.i.market_date)}`
              : "No quote available"}
          </small>
        </div>
      </header>
      <MarketNotice status={marketStatus} />
      {data.transactions.some(
        (t) => t.instrument_id === holding.i.id && t.charges_missing,
      ) && (
        <p className="ledger-notice">
          Purchase costs exclude brokerage and taxes that were not provided.
        </p>
      )}
      <section className="overview-metrics" aria-label="Investment summary">
        <div>
          <span>Quantity</span>
          <strong>
            {holding.quantity.toString()}{" "}
            {holding.i.unit === "unit" ? "units" : "shares"}
          </strong>
          <small>{holding.lots.length} open purchases</small>
        </div>
        <div>
          <span>Invested amount</span>
          <strong>{fmt(holding.cost)}</strong>
          <small>Average {fmt(holding.cost.div(holding.quantity))}</small>
        </div>
        <div>
          <span>Current value</span>
          <strong>{fmt(holding.value)}</strong>
          <small>
            {holding.value === null
              ? "Price unavailable for latest trade"
              : "Latest available price"}
          </small>
        </div>
        <div>
          <span>Unrealized P&L</span>
          <strong
            className={
              holding.profit === null
                ? ""
                : holding.profit.isNegative()
                  ? "sample-negative"
                  : "sample-positive"
            }
          >
            {fmt(holding.profit)}
          </strong>
          <small>
            {holding.profit === null || holding.cost.isZero()
              ? "Price unavailable"
              : `${holding.profit.div(holding.cost).mul(100).toFixed(2)}% of invested amount`}
          </small>
        </div>
      </section>
      <section className="real-panel detail-history">
        <div className="panel-heading">
          <div>
            <h2>Investment value over time</h2>
            <p>Value at each available historical close</p>
          </div>
          <span className="history-status" role="status">
            {historyState === "loading"
              ? "Updating…"
              : historyState === "reconnect"
                ? "Connect FYERS"
                : historyState === "partial"
                  ? "Some prices unavailable"
                  : "Up to date"}
          </span>
        </div>
        <p className="panel-note">
          Values use the quantity held on each price date, shown in brackets.
          Purchases and sales change the value shown, so this chart is not a
          cash-flow-adjusted return. Corporate-action adjustments have not been
          verified.
        </p>
        <div
          className="performance-wrap"
          aria-busy={historyState === "loading"}
        >
          <div className="history-bars">
            {chartPoints.map((point) => (
              <div className="history-row" key={point.label}>
                <span>{point.label}</span>
                <div className="history-bar-track" aria-hidden="true">
                  {point.value && (
                    <span
                      style={{
                        width: `${chartMax.isZero() ? "0" : point.value.div(chartMax).mul(100).toFixed(2)}%`,
                      }}
                    />
                  )}
                </div>
                <strong>
                  {fmt(point.value)}
                  {point.value !== null && point.quantity !== null && (
                    <>
                      {" "}
                      <span className="history-quantity">
                        ({point.quantity.toString()})
                      </span>
                    </>
                  )}
                </strong>
                <small>{point.date ? date(point.date) : "No close"}</small>
              </div>
            ))}
          </div>
          {historyState === "loading" && (
            <div className="performance-loading" role="status">
              <LoaderCircle size={24} aria-hidden="true" />
              <span>Loading historical prices…</span>
            </div>
          )}
        </div>
      </section>
      <section className="real-panel detail-transactions">
        <div className="panel-heading">
          <div>
            <h2>Purchases</h2>
            <p>Current P&amp;L and annualized return for each purchase</p>
          </div>
          <div className="return-summary">
            <span>Investment XIRR</span>
            <strong
              className={
                investmentXirr
                  ? investmentXirr.isNegative()
                    ? "sample-negative"
                    : "sample-positive"
                  : ""
              }
            >
              {investmentXirr ? `${investmentXirr.toFixed(2)}%` : "Unavailable"}
            </strong>
          </div>
        </div>
        <p className="panel-note">
          XIRR uses recorded purchases, sale proceeds and the latest available
          value. CAGR uses each purchase’s remaining cost and shares; it
          excludes realized sales. Returns omit charges not supplied. XIRR is
          unavailable when cash flows have multiple sign changes or a reliable
          result cannot be found.
        </p>
        <p className="scroll-hint">Scroll sideways to see all columns.</p>
        <div
          className="sample-transaction-scroll"
          tabIndex={0}
          aria-label="Scrollable purchase table"
        >
          <table className="sample-transactions purchase-return-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Amount</th>
                <th>Current P&amp;L</th>
                <th>CAGR</th>
              </tr>
            </thead>
            <tbody>
              {trades
                .filter((t) => t.type === "BUY")
                .map((t) => {
                  const lot = remainingLot(t);
                  const value =
                    holding.i.price !== null &&
                    priceDate !== null &&
                    priceDate >= t.transaction_date &&
                    lot.remaining.gt(0)
                      ? lot.remaining.mul(holding.i.price)
                      : null;
                  const current = value !== null ? value.minus(lot.cost) : null;
                  const cagr =
                    value !== null && priceDate
                      ? annualizedReturn(
                          lot.cost.toString(),
                          value.toString(),
                          t.transaction_date,
                          priceDate,
                        )
                      : null;
                  return (
                    <tr key={t.id}>
                      <td>{date(t.transaction_date)}</td>
                      <td>
                        {n(t.quantity).toString()}
                        {lot.remaining.lt(t.quantity) && (
                          <small>{lot.remaining.toString()} held</small>
                        )}
                      </td>
                      <td>{fmt(n(t.unit_price))}</td>
                      <td>{fmt(n(t.quantity).mul(t.unit_price))}</td>
                      <td
                        className={
                          current
                            ? current.isNegative()
                              ? "sample-negative"
                              : "sample-positive"
                            : ""
                        }
                      >
                        {current !== null && !lot.cost.isZero() ? (
                          <>
                            <strong>{fmt(current)}</strong>
                            <small>
                              {current.div(lot.cost).mul(100).toFixed(2)}%
                            </small>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className={
                          cagr
                            ? cagr.isNegative()
                              ? "sample-negative"
                              : "sample-positive"
                            : ""
                        }
                      >
                        {cagr ? `${cagr.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="panel-note performance-note">
          A dash means there are no shares remaining, a price or cost is
          unavailable, or there is not enough time to calculate an annualized
          return.
        </p>
      </section>
    </div>
  );
}
