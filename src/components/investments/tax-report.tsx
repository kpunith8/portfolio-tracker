"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Decimal from "decimal.js";
import { ChevronDown } from "lucide-react";
import { ReportDetails } from "./report-details";
import { DividendReportLoader } from "./dividend-report";
import { buildTaxReport, type SaleLot } from "../../domain/tax-report";

const periods = [
  "1 Apr – 15 Jun",
  "16 Jun – 15 Sep",
  "16 Sep – 15 Dec",
  "16 Dec – 15 Mar",
  "16 Mar – 31 Mar",
];

const money = (value: string) =>
  `₹${new Decimal(value).toDecimalPlaces(2).toNumber().toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ay = (year: number) => `AY ${year}–${String(year + 1).slice(-2)}`;

const fy = (year: number) => `FY ${year - 1}–${String(year).slice(-2)}`;

const quantity = (value: string) => new Decimal(value).toFixed(2);

export function TaxReport({
  lots,
  incomplete,
  hasMutualFundPurchases,
}: {
  lots: SaleLot[];
  incomplete: boolean;
  hasMutualFundPurchases: boolean;
}) {
  const report = useMemo(() => buildTaxReport(lots), [lots]);
  const [tab, setTab] = useState<"stocks" | "mutual" | "dividends">("stocks");
  const [printYear, setPrintYear] = useState(report[0]?.year ?? 0);
  const dialog = useRef<HTMLDialogElement>(null);
  const yearMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        yearMenu.current &&
        !yearMenu.current.contains(event.target as Node)
      ) {
        yearMenu.current.open = false;
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);

    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const selectedReport = report.find((year) => year.year === printYear);

  return (
    <section className="sample-page tax-report">
      <div className="sample-heading tax-heading">
        <div>
          <h1>Tax Report</h1>
          <p>Review realised gains by assessment year and accrual period.</p>
        </div>
        {tab === "stocks" && (
          <button
            className="trade-primary tax-print-button"
            disabled={!report.length || tab !== "stocks"}
            onClick={() => dialog.current?.showModal()}
          >
            Export Report
          </button>
        )}
      </div>
      <div className="tax-tabs" role="tablist" aria-label="Report type">
        <button
          role="tab"
          aria-selected={tab === "stocks"}
          onClick={() => setTab("stocks")}
        >
          Stocks
        </button>
        <button
          role="tab"
          aria-selected={tab === "mutual"}
          onClick={() => setTab("mutual")}
        >
          Mutual funds
        </button>
        <button
          role="tab"
          aria-selected={tab === "dividends"}
          onClick={() => setTab("dividends")}
        >
          Dividends
        </button>
      </div>
      {tab === "dividends" ? (
        <DividendReportLoader />
      ) : tab === "mutual" ? (
        <>
          <div className="tax-notice">
            <strong>Mutual fund tax treatment varies by fund</strong>
            <p>
              Fund category and acquisition date affect the holding period and
              tax treatment. Certain specified funds are treated as short term
              regardless of holding period. Review the applicable rules and
              reconcile with your fund statement.
            </p>
          </div>
          <div className="tax-empty">
            <h2>
              {hasMutualFundPurchases
                ? "No mutual fund sale records found"
                : "No mutual fund entries found"}
            </h2>
            <p>
              Mutual fund sales and redemptions cannot yet be recorded in this
              app. A tax report requires sale details, purchase-lot allocations
              and fund classification.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="tax-notice">
            <strong>For review, not a filing-ready return</strong>
            <p>
              Amounts are price-based realised P/L before STT, brokerage and
              other charges. Taxable gains can differ due to grandfathering,
              loss adjustments and other rules. FIFO uses this portfolio’s lots;
              verify the demat account pool and reconcile with your broker.
              Periods follow the AY 2026–27 form; verify other years against the
              applicable form.
            </p>
            {incomplete && (
              <p>
                <strong>
                  Some sales have incomplete allocations. Totals exclude the
                  missing quantities and require review.
                </strong>
              </p>
            )}
          </div>
          {!report.length && (
            <div className="tax-empty">
              <h2>No stock sales yet</h2>
              <p>Sales recorded in your portfolio will appear here.</p>
            </div>
          )}
          {report.map((year) => (
            <section
              className="tax-year"
              key={year.year}
              data-print-year={year.year}
            >
              <h2>{ay(year.year)}</h2>
              <p>
                Financial year {year.year - 1}–{String(year.year).slice(-2)}
              </p>
              <div className="tax-periods">
                {year.periods.map((period, index) => (
                  <ReportDetails
                    key={index}
                    summary={
                      <>
                        <span>
                          {periods[index]}{" "}
                          <small>
                            {period.rows.length} lot
                            {period.rows.length === 1 ? "" : "s"}
                          </small>
                        </span>
                        <span>
                          Short term <strong>{money(period.short)}</strong>
                        </span>
                        <span>
                          Long term <strong>{money(period.long)}</strong>
                        </span>
                        <span className="tax-view-details">
                          View details{" "}
                          <ChevronDown size={18} aria-hidden="true" />
                        </span>
                      </>
                    }
                  >
                    {() =>
                      period.rows.length ? (
                        <div className="tax-table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Ticker</th>
                                <th>Sold on</th>
                                <th>Bought on</th>
                                <th>Quantity</th>
                                <th>Buy price</th>
                                <th>Sell price</th>
                                <th>Term</th>
                                <th>Realised P/L</th>
                              </tr>
                            </thead>
                            {Object.entries(
                              Object.groupBy(period.rows, (row) => row.symbol),
                            ).map(([symbol, rows]) => {
                              const group = rows!;
                              const total = group.reduce(
                                (sum, row) => sum.plus(row.gain),
                                new Decimal(0),
                              );

                              return (
                                <tbody key={symbol}>
                                  {group.map((row, i) => (
                                    <tr
                                      key={`${row.sellId}:${row.buyDate}:${i}`}
                                    >
                                      <td>{row.symbol}</td>
                                      <td>{row.sellDate}</td>
                                      <td>{row.buyDate}</td>
                                      <td>{quantity(row.quantity)}</td>
                                      <td>{money(row.buyPrice)}</td>
                                      <td>{money(row.sellPrice)}</td>
                                      <td>
                                        {row.term === "long" ? "Long" : "Short"}
                                      </td>
                                      <td>{money(row.gain)}</td>
                                    </tr>
                                  ))}
                                  <tr className="tax-subtotal">
                                    <th colSpan={7}>{symbol} total</th>
                                    <td>{money(total.toString())}</td>
                                  </tr>
                                </tbody>
                              );
                            })}
                          </table>
                        </div>
                      ) : (
                        <p className="tax-no-sales">No sales in this period.</p>
                      )
                    }
                  </ReportDetails>
                ))}
              </div>
              <div className="tax-total gains-tax-total">
                <strong>Year total</strong>
                <span>
                  Short term <strong>{money(year.short)}</strong>
                </span>
                <span>
                  Long term <strong>{money(year.long)}</strong>
                </span>
              </div>
            </section>
          ))}
        </>
      )}
      {selectedReport && (
        <article className="tax-print-report" aria-hidden="true">
          <header className="tax-print-header">
            <div>
              <h1>Stock gains report</h1>
              <p>
                {ay(selectedReport.year)} · {fy(selectedReport.year)}
              </p>
            </div>
            <span>Portfolio tracker</span>
          </header>
          <section className="tax-print-summary">
            <h2>Realised gains by accrual period</h2>
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Short term</th>
                  <th>Long term</th>
                </tr>
              </thead>
              <tbody>
                {selectedReport.periods.map((period, index) => (
                  <tr key={index}>
                    <td>{periods[index]}</td>
                    <td>{money(period.short)}</td>
                    <td>{money(period.long)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Year total</th>
                  <td>{money(selectedReport.short)}</td>
                  <td>{money(selectedReport.long)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
          <section className="tax-print-details">
            <h2>Sale lot details</h2>
            {selectedReport.periods.map(
              (period, index) =>
                period.rows.length > 0 && (
                  <div className="tax-print-period" key={index}>
                    <h3>{periods[index]}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Ticker</th>
                          <th>Sold on</th>
                          <th>Bought on</th>
                          <th>Qty</th>
                          <th>Buy price</th>
                          <th>Sell price</th>
                          <th>Term</th>
                          <th>Realised P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {period.rows.map((row, i) => (
                          <tr key={`${row.sellId}:${row.buyDate}:${i}`}>
                            <td>{row.symbol}</td>
                            <td>{row.sellDate}</td>
                            <td>{row.buyDate}</td>
                            <td>{quantity(row.quantity)}</td>
                            <td>{money(row.buyPrice)}</td>
                            <td>{money(row.sellPrice)}</td>
                            <td>{row.term === "long" ? "Long" : "Short"}</td>
                            <td>{money(row.gain)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
            )}
          </section>
          <footer className="tax-print-notice">
            <strong>For review, not a filing-ready return</strong>
            <p>
              Price-based realised P/L excludes STT, brokerage and other
              charges. Taxable gains may differ due to grandfathering, loss
              adjustments and other rules. Portfolio FIFO is not verified
              against demat account pools. Periods follow the AY 2026–27 form;
              verify other years against the applicable form.
            </p>
            {incomplete && (
              <p>
                Some sales have incomplete allocations; totals exclude missing
                quantities and require review.
              </p>
            )}
          </footer>
        </article>
      )}
      <dialog
        ref={dialog}
        className="tax-dialog"
        onClose={() => {
          if (yearMenu.current) yearMenu.current.open = false;
        }}
      >
        <form method="dialog">
          <h2>Export tax report</h2>
          <p>
            Select an assessment year, then choose Save as PDF in your browser’s
            print dialog.
          </p>
          <span id="tax-year-label" className="tax-year-label">
            Assessment year
          </span>
          <details
            className="investment-select tax-year-select"
            ref={yearMenu}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.open = false;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && yearMenu.current?.open) {
                event.preventDefault();
                event.stopPropagation();
                yearMenu.current.open = false;
                yearMenu.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-labelledby="tax-year-label tax-year-value">
              <span id="tax-year-value">
                {ay(printYear)} · {fy(printYear)}
              </span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="investment-select-options">
              {report.map((year) => (
                <button
                  type="button"
                  key={year.year}
                  aria-pressed={year.year === printYear}
                  onClick={() => {
                    setPrintYear(year.year);
                    if (yearMenu.current) yearMenu.current.open = false;
                    yearMenu.current?.querySelector("summary")?.focus();
                  }}
                >
                  {ay(year.year)} · {fy(year.year)}
                </button>
              ))}
            </div>
          </details>
          <div className="tax-dialog-actions">
            <div className="trade-buttons">
              <button>Cancel</button>
            </div>
            <button
              type="button"
              className="trade-primary"
              onClick={() => {
                document.body.dataset.taxPrintYear = String(printYear);
                dialog.current?.close();
                window.print();
                delete document.body.dataset.taxPrintYear;
              }}
            >
              Save Report
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
