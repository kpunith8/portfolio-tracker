"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Decimal from "decimal.js";
import { ChevronDown, X } from "lucide-react";
import { displayCompanyName } from "../../domain/company-name";
import {
  dividendReport,
  type DividendRow,
  type DividendImportStatus,
} from "../../domain/dividends";
import {
  getDividendReport,
  previewDividendPdf,
  saveDividendRows,
} from "../../app/dashboard/dividend-actions";

const labels = [
  "1 Apr – 15 Jun",
  "16 Jun – 15 Sep",
  "16 Sep – 15 Dec",
  "16 Dec – 15 Mar",
  "16 Mar – 31 Mar",
];

const money = (value: string) =>
  `₹${new Decimal(value).toDecimalPlaces(2).toNumber().toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const yearLabel = (year: number) =>
  `AY ${year}–${String(year + 1).slice(-2)} · FY ${year - 1}–${String(year).slice(-2)}`;

function DividendTable({
  rows,
  preview = false,
  statuses,
  companyName,
}: {
  rows: DividendRow[];
  preview?: boolean;
  statuses?: DividendImportStatus[];
  companyName?: string;
}) {
  return (
    <div
      className="tax-table-wrap"
      tabIndex={0}
      aria-label={
        companyName ? `Dividend entries for ${companyName}` : "Dividend entries"
      }
    >
      <table>
        <thead>
          <tr>
            {!companyName && <th>Company</th>}
            <th>Ex-date</th>
            <th>Shares</th>
            <th>Dividend</th>
            <th>Total Dividend</th>
            {statuses && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.isin}:${row.exDate}:${i}`}>
              {!companyName && (
                <td>
                  {preview
                    ? displayCompanyName(row.company)
                    : row.symbol || displayCompanyName(row.company)}
                  {!preview && (
                    <small>
                      {row.symbol
                        ? displayCompanyName(row.company)
                        : `${row.isin} · ticker not matched`}
                    </small>
                  )}
                </td>
              )}
              <td>{row.exDate}</td>
              <td>{new Decimal(row.shares).toFixed(2)}</td>
              <td>{money(row.perShare)}</td>
              <td>{money(row.netAmount)}</td>
              {statuses && (
                <td>
                  {statuses[i] === "new"
                    ? "New"
                    : statuses[i] === "duplicate"
                      ? "Imported"
                      : "Conflict"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DividendDetails({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="tax-period"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {open ? children : null}
    </details>
  );
}

export function DividendReportLoader() {
  const [rows, setRows] = useState<DividendRow[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;

    getDividendReport()
      .then((result) => {
        if (!active) return;
        if (result.error || !result.rows)
          setError(
            result.error ||
              "Could not load dividend records. Please try again.",
          );
        else {
          setRows(result.rows);
          setError("");
        }
      })
      .catch(() => {
        if (active)
          setError("Could not load dividend records. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [revision]);

  function retry() {
    setError("");
    setRevision((value) => value + 1);
  }

  if (rows === null)
    return (
      <div className="tax-empty" role="status">
        {error ? (
          <>
            <p>{error}</p>
            <button type="button" className="trade-primary" onClick={retry}>
              Retry
            </button>
          </>
        ) : (
          "Loading dividend records…"
        )}
      </div>
    );

  return (
    <>
      {error && (
        <div className="tax-notice" role="alert">
          <p>{error}</p>
          <button type="button" className="trade-primary" onClick={retry}>
            Retry
          </button>
        </div>
      )}
      <DividendReport rows={rows} onSaved={retry} />
    </>
  );
}

export function DividendReport({
  rows,
  onSaved,
}: {
  rows: DividendRow[];
  onSaved?: () => void;
}) {
  const report = useMemo(() => dividendReport(rows), [rows]);
  const [mode, setMode] = useState<"period" | "company">("period");
  const [preview, setPreview] = useState<DividendRow[] | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [statuses, setStatuses] = useState<DividendImportStatus[]>([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [year, setYear] = useState(report.years[0]?.year ?? 0);
  const dialog = useRef<HTMLDialogElement>(null);
  const importDialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLDetailsElement>(null);
  const selected = report.years.find((item) => item.year === year);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (picker.current && !picker.current.contains(event.target as Node))
        picker.current.open = false;
    }

    document.addEventListener("pointerdown", dismiss);

    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  function previewFile(form: FormData) {
    setMessage("");
    setPreview(null);
    startTransition(async () => {
      const result = await previewDividendPdf(form);

      if (result.error) setMessage(result.error);
      else {
        setPreview(result.rows ?? []);
        setStatuses(result.statuses ?? []);
        setRequestId(crypto.randomUUID());
      }
    });
  }

  function save() {
    if (!preview) return;
    startTransition(async () => {
      const result = await saveDividendRows(preview, requestId);

      if (result.error) setMessage(result.error);
      else {
        setPreview(null);
        importDialog.current?.close();
        onSaved?.();
        setSavedMessage(
          `${result.inserted} new dividend ${result.inserted === 1 ? "entry" : "entries"} saved. Existing matching entries were skipped.`,
        );
      }
    });
  }

  const newCount = statuses.filter((status) => status === "new").length;
  const duplicateCount = statuses.filter(
    (status) => status === "duplicate",
  ).length;
  const conflictCount = statuses.filter(
    (status) => status === "conflict",
  ).length;

  return (
    <section className="dividend-report">
      <div className="dividend-actions">
        <button
          type="button"
          className="dividend-import-button"
          onClick={() => {
            setSavedMessage("");
            importDialog.current?.showModal();
          }}
        >
          Import Dividends
        </button>
        {mode === "period" && (
          <button
            type="button"
            className="trade-primary"
            disabled={!report.years.length}
            onClick={() => {
              setYear(report.years[0]?.year ?? 0);
              dialog.current?.showModal();
            }}
          >
            Export Report
          </button>
        )}
      </div>
      {savedMessage && (
        <p role="status" className="dividend-saved">
          {savedMessage}
        </p>
      )}
      <div className="tax-notice">
        <strong>Ex-date estimate · statement net amounts</strong>
        <p>
          Periods use ex-dates, not payment or receipt dates. The statement does
          not provide tax withheld; reconcile amounts and dates with your bank,
          AIS and tax records before filing. Period labels follow the AY 2026–27
          form; verify other years.
        </p>
      </div>
      <div className="dividend-toolbar">
        <fieldset className="dividend-view">
          <legend>Group dividends by</legend>
          <label>
            <input
              type="radio"
              name="dividend-view"
              checked={mode === "period"}
              onChange={() => setMode("period")}
            />{" "}
            Assessment year
          </label>
          <label>
            <input
              type="radio"
              name="dividend-view"
              checked={mode === "company"}
              onChange={() => setMode("company")}
            />{" "}
            Company
          </label>
        </fieldset>
      </div>
      {!rows.length && (
        <div className="tax-empty">
          <h2>No dividends recorded yet</h2>
          <p>Import a supported dividend statement to begin.</p>
        </div>
      )}
      {mode === "period" ? (
        report.years.map((item) => (
          <section className="tax-year" key={item.year}>
            <h2>{yearLabel(item.year)}</h2>
            <div className="tax-periods">
              {item.periods.map((period, i) => (
                <DividendDetails
                  key={i}
                  summary={
                    <>
                      <span>
                        {labels[i]}
                        <small>
                          {period.rows.length}{" "}
                          {period.rows.length === 1 ? "entry" : "entries"}
                        </small>
                      </span>
                      <span>
                        Total <strong>{money(period.total)}</strong>
                      </span>
                      <span className="tax-view-details">
                        View details{" "}
                        <ChevronDown size={18} aria-hidden="true" />
                      </span>
                    </>
                  }
                >
                  {period.rows.length ? (
                    <DividendTable rows={period.rows} />
                  ) : (
                    <p className="tax-no-sales">No dividends in this period.</p>
                  )}
                </DividendDetails>
              ))}
            </div>
            <div className="tax-total dividend-tax-total">
              <strong>Year total</strong>
              <span>
                Total<strong>{money(item.total)}</strong>
              </span>
            </div>
          </section>
        ))
      ) : (
        <div className="tax-periods dividend-companies">
          {report.companies.map((company) => (
            <DividendDetails
              key={company.isin}
              summary={
                <>
                  <span>
                    {company.symbol || displayCompanyName(company.company)}
                    <small>
                      {company.symbol
                        ? displayCompanyName(company.company)
                        : `${company.isin} · ticker not matched`}
                    </small>
                  </span>
                  <span>
                    Total <strong>{money(company.total)}</strong>
                  </span>
                  <span className="tax-view-details">
                    View details <ChevronDown size={18} aria-hidden="true" />
                  </span>
                </>
              }
            >
              <DividendTable
                rows={company.rows}
                companyName={displayCompanyName(company.company)}
              />
            </DividendDetails>
          ))}
        </div>
      )}
      <dialog
        ref={importDialog}
        className="trade-dialog purchase-dialog dividend-import-dialog"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => {
          importDialog.current?.querySelector("form")?.reset();
          setHasFile(false);
          setPreview(null);
          setStatuses([]);
          setMessage("");
        }}
      >
        <div className="trade-dialog-header">
          <div>
            <h2>Import dividends</h2>
            <p>Upload the dividends PDF report from your broker</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={pending}
            onClick={() => importDialog.current?.close()}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <form
          className="trade-form"
          onSubmit={(event) => {
            event.preventDefault();
            previewFile(new FormData(event.currentTarget));
          }}
        >
          <div className="dividend-file-row">
            <input
              id="dividend-file"
              name="statement"
              aria-label="Dividend statement PDF"
              type="file"
              accept="application/pdf,.pdf"
              required
              disabled={pending}
              onChange={(event) => {
                setHasFile(Boolean(event.currentTarget.files?.length));
                setPreview(null);
                setStatuses([]);
                setMessage("");
              }}
            />
            <button
              className="trade-primary"
              type="submit"
              disabled={pending || !hasFile}
            >
              {pending ? "Verifying..." : "Verify"}
            </button>
          </div>
        </form>
        {message && (
          <p className="trade-error" role="alert">
            {message}
          </p>
        )}
        {preview && (
          <div className="dividend-preview">
            <h3>
              Review {preview.length}{" "}
              {preview.length === 1 ? "entry" : "entries"}
            </h3>
            <p role="status">
              {newCount} new · {duplicateCount} already imported ·{" "}
              {conflictCount} conflicting
            </p>
            {conflictCount > 0 && (
              <p className="trade-error">
                Some entries have the same ISIN and ex-date but different
                values. Review the statement before importing.
              </p>
            )}
            {newCount === 0 && conflictCount === 0 && (
              <p>All entries in this statement are already imported.</p>
            )}
            <DividendTable rows={preview} preview statuses={statuses} />
          </div>
        )}
        <div className="dividend-import-actions">
          <div className="trade-buttons">
            <button
              type="button"
              disabled={pending}
              onClick={() => importDialog.current?.close()}
            >
              Cancel
            </button>
          </div>
          <button
            type="button"
            className="trade-primary"
            onClick={save}
            disabled={
              pending || !preview || newCount === 0 || conflictCount > 0
            }
          >
            Save
          </button>
        </div>
      </dialog>
      {selected && (
        <article className="dividend-print" aria-hidden="true">
          <header className="tax-print-header">
            <div>
              <h1>Dividend report</h1>
              <p>{yearLabel(selected.year)}</p>
            </div>
            <span>Portfolio tracker</span>
          </header>
          <h2>Ex-date period summary</h2>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Statement net amount</th>
              </tr>
            </thead>
            <tbody>
              {selected.periods.map((p, i) => (
                <tr key={i}>
                  <td>{labels[i]}</td>
                  <td>{money(p.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Year total</th>
                <td>{money(selected.total)}</td>
              </tr>
            </tfoot>
          </table>
          <h2>Dividend entries</h2>
          {selected.periods.map(
            (p, i) =>
              p.rows.length > 0 && (
                <section key={i}>
                  <h3>{labels[i]}</h3>
                  <DividendTable rows={p.rows} />
                </section>
              ),
          )}
          <footer className="tax-print-notice">
            <strong>Ex-date estimate · not filing-ready</strong>
            <p>
              Ex-date is not the payment date. Amounts are statement net
              amounts; withholding is unknown. Reconcile with bank, AIS and tax
              records. Periods follow the AY 2026–27 form; verify other years.
            </p>
          </footer>
        </article>
      )}
      <dialog
        ref={dialog}
        className="tax-dialog"
        onClose={() => {
          if (picker.current) picker.current.open = false;
        }}
      >
        <form method="dialog">
          <h2>Export dividend report</h2>
          <p>
            Select an assessment year, then choose Save as PDF in your browser’s
            print dialog.
          </p>
          <span id="dividend-year-label" className="tax-year-label">
            Assessment year
          </span>
          <details
            className="investment-select tax-year-select"
            ref={picker}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                event.currentTarget.open = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && picker.current?.open) {
                e.preventDefault();
                e.stopPropagation();
                picker.current.open = false;
                picker.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-labelledby="dividend-year-label dividend-year-value">
              <span id="dividend-year-value">{yearLabel(year)}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="investment-select-options">
              {report.years.map((item) => (
                <button
                  type="button"
                  key={item.year}
                  aria-pressed={item.year === year}
                  onClick={() => {
                    setYear(item.year);
                    if (picker.current) picker.current.open = false;
                    picker.current?.querySelector("summary")?.focus();
                  }}
                >
                  {yearLabel(item.year)}
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
                document.body.dataset.dividendPrint = "true";
                dialog.current?.close();
                window.print();
                delete document.body.dataset.dividendPrint;
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
