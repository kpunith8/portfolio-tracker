"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  parsePurchaseCsv,
  purchaseCsvTemplate,
  type PurchaseCsvRow,
} from "../../domain/purchase-csv";
import {
  resolvePurchaseSymbols,
  savePurchases,
  searchSymbols,
  type PurchaseRow,
  type SymbolOption,
} from "../../app/dashboard/purchase-actions";

type Row = PurchaseCsvRow & { fyersSymbol: string; id: string };

function SymbolSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (text: string, selected?: SymbolOption) => void;
  label: string;
}) {
  const [options, setOptions] = useState<SymbolOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || value.trim().length < 2) return;

    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      searchSymbols(value)
        .then((result) => {
          if (current) setOptions(result);
        })
        .catch(() => {
          if (current) setOptions([]);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 150);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value, open]);

  return (
    <div
      className="symbol-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <input
        aria-label={label}
        value={value}
        onChange={(e) => {
          setOpen(true);
          setOptions([]);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        placeholder="Search ticker or company"
      />
      {open && value.trim().length >= 2 && (
        <div className="symbol-results" aria-label="Symbol results">
          {options.map((option) => (
            <button
              type="button"
              key={option.fyersSymbol}
              onClick={() => {
                onChange(option.symbol, option);
                setOpen(false);
                setOptions([]);
              }}
            >
              <strong>
                {option.symbol} · {option.exchange} {option.series}
              </strong>
              <span>{option.name}</span>
            </button>
          ))}
          {!options.length && (
            <span>{loading ? "Searching…" : "Type to search symbols"}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function PurchaseEntry({
  close,
  onPendingChange,
}: {
  close: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [manual, setManual] = useState<Row>({
    id: "manual",
    symbol: "",
    exchange: "",
    fyersSymbol: "",
    quantity: "",
    price: "",
    date: "",
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requestIds = useRef<{ CSV: string | null; MANUAL: string | null }>({
    CSV: null,
    MANUAL: null,
  });
  const router = useRouter();

  const updatePending = (value: boolean) => {
    setPending(value);
    onPendingChange(value);
  };

  const duplicateCount =
    rows.length -
    new Set(
      rows.map((row) =>
        [
          row.symbol.toUpperCase(),
          row.exchange.toUpperCase(),
          row.quantity,
          row.price,
          row.date,
        ].join("|"),
      ),
    ).size;

  const edit = (id: string, changes: Partial<Row>) => {
    requestIds.current.CSV = null;
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    requestIds.current.CSV = null;
    if (file.size > 2_000_000) {
      setError("The CSV must be smaller than 2 MB.");

      return;
    }

    const parsed = parsePurchaseCsv(await file.text());

    if (parsed.error || !parsed.rows?.length || parsed.rows.length > 1000) {
      setError(parsed.error || "Choose a CSV with 1 to 1,000 rows.");

      return;
    }

    updatePending(true);
    try {
      const resolved = await resolvePurchaseSymbols(parsed.rows);

      setRows(
        parsed.rows.map((row, index) => ({
          ...row,
          id: crypto.randomUUID(),
          fyersSymbol: resolved[index]?.fyersSymbol || "",
        })),
      );
      setPage(0);
    } catch {
      setError("Could not validate symbols. Please try again.");
    } finally {
      updatePending(false);
    }
  };

  const save = async (entries: Row[], source: "CSV" | "MANUAL") => {
    if (entries.some((row) => !row.fyersSymbol)) {
      setError(
        `Choose a matching symbol for: ${entries
          .filter((r) => !r.fyersSymbol)
          .map((r) => r.symbol || "blank ticker")
          .join(", ")}.`,
      );

      return;
    }

    setError("");
    updatePending(true);
    requestIds.current[source] ||= crypto.randomUUID();
    try {
      const result = await savePurchases(
        entries.map((row): PurchaseRow => ({
          symbol: row.symbol,
          exchange: row.exchange,
          quantity: row.quantity,
          price: row.price,
          date: row.date,
          fyersSymbol: row.fyersSymbol,
        })),
        requestIds.current[source],
        source,
      );

      if (result.success) {
        router.refresh();
        close();
      } else setError(result.error || "Could not save purchases.");
    } catch {
      setError("Could not save purchases. Retry to check the result safely.");
    } finally {
      updatePending(false);
    }
  };

  const selectManual = (text: string, selected?: SymbolOption) => {
    requestIds.current.MANUAL = null;
    setManual((row) => ({
      ...row,
      symbol: text,
      exchange: selected?.exchange || "",
      fyersSymbol: selected?.fyersSymbol || "",
    }));
  };

  return (
    <fieldset className="purchase-entry-fieldset" disabled={pending}>
      <div
        className="purchase-tabs"
        role="tablist"
        aria-label="Purchase entry method"
      >
        <button
          role="tab"
          aria-selected={tab === "manual"}
          onClick={() => {
            setTab("manual");
            setError("");
          }}
        >
          Manual entry
        </button>
        <button
          role="tab"
          aria-selected={tab === "csv"}
          onClick={() => {
            setTab("csv");
            setError("");
          }}
        >
          Import .csv
        </button>
      </div>
      {tab === "manual" ? (
        <form
          className="trade-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save([manual], "MANUAL");
          }}
        >
          <label>
            Stock
            <SymbolSearch
              label="Stock ticker or company"
              value={manual.symbol}
              onChange={selectManual}
            />
            <small>
              Choose the ticker symbol from your broker, not the company name.{" "}
              {manual.fyersSymbol && `Selected: ${manual.fyersSymbol}`}
            </small>
          </label>
          {(
            [
              ["quantity", "Quantity", "numeric"],
              ["price", "Purchase price per share", "decimal"],
              ["date", "Purchase date", "text"],
            ] as const
          ).map(([key, label, mode]) => (
            <label key={key}>
              {label}
              <input
                required
                type={key === "date" ? "date" : "text"}
                inputMode={mode}
                value={manual[key]}
                onChange={(e) => {
                  requestIds.current.MANUAL = null;
                  setManual({ ...manual, [key]: e.target.value });
                }}
              />
            </label>
          ))}
          <p className="trade-note">
            Brokerage, charges and taxes are not captured yet. Do not use these
            figures for tax filing.
          </p>
          {error && (
            <p className="trade-error" role="alert">
              {error}
            </p>
          )}
          <div className="trade-buttons">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit" disabled={pending || !manual.fyersSymbol}>
              {pending ? "Saving…" : "Save purchase"}
            </button>
          </div>
        </form>
      ) : (
        <div className="trade-form">
          <p className="trade-note">
            Use the ticker symbol from your broker, not the company name. Enter
            NSE or BSE as the exchange; use YYYY-MM-DD for dates. Brokerage and
            taxes are not captured.
          </p>
          <a
            download="purchase-template.csv"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(purchaseCsvTemplate)}`}
          >
            Download CSV template
          </a>
          <label>
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {duplicateCount > 0 && (
            <p className="trade-error" role="status">
              {duplicateCount} possible duplicate{" "}
              {duplicateCount === 1 ? "row" : "rows"}. Review before saving.
            </p>
          )}
          {rows.length > 0 && (
            <>
              <div className="purchase-table-scroll">
                <table className="purchase-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Exchange</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Date</th>
                      <th>
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(page * 10, page * 10 + 10).map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <SymbolSearch
                            label={`Ticker for row ${page * 10 + index + 1}`}
                            value={row.symbol}
                            onChange={(text, selected) =>
                              edit(row.id, {
                                symbol: text,
                                exchange: selected?.exchange || row.exchange,
                                fyersSymbol: selected?.fyersSymbol || "",
                              })
                            }
                          />
                          {!row.fyersSymbol && (
                            <small className="trade-error">
                              Select a matching symbol
                            </small>
                          )}
                        </td>
                        <td>{row.exchange}</td>
                        {(["quantity", "price", "date"] as const).map((key) => (
                          <td key={key}>
                            <input
                              aria-label={`${key} for row ${page * 10 + index + 1}`}
                              type={key === "date" ? "date" : "text"}
                              value={row[key]}
                              onChange={(e) =>
                                edit(row.id, { [key]: e.target.value })
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            aria-label={`Remove row ${page * 10 + index + 1}`}
                            onClick={() => {
                              requestIds.current.CSV = null;
                              setRows((previous) =>
                                previous.filter((r) => r.id !== row.id),
                              );
                              setPage((current) =>
                                Math.min(
                                  current,
                                  Math.max(
                                    0,
                                    Math.ceil((rows.length - 1) / 10) - 1,
                                  ),
                                ),
                              );
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="purchase-pagination">
                <span>
                  {rows.length} purchases · Page {page + 1} of{" "}
                  {Math.ceil(rows.length / 10)}
                </span>
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <button
                  disabled={(page + 1) * 10 >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
          {error && (
            <p className="trade-error" role="alert">
              {error}
            </p>
          )}
          <div className="trade-buttons">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !rows.length}
              onClick={() => void save(rows, "CSV")}
            >
              {pending ? "Working…" : `Add ${rows.length || ""} purchases`}
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
