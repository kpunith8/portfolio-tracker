"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { parseCsvRecords } from "../../domain/purchase-csv";
import {
  debtInvestmentNames,
  type ManualAssetType,
  type ManualPurchase,
} from "../../domain/manual-assets";
import { saveManualAssets } from "../../app/dashboard/manual-asset-actions";

const blank = (): ManualPurchase => ({
  name: "",
  date: "",
  quantity: "",
  price: "",
  expenseRatio: "",
});

const headers = ["name", "date", "quantity", "price", "expense_ratio"];

export function ManualAssetEntry({
  type,
  close,
  onPendingChange,
}: {
  type: ManualAssetType;
  close: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [method, setMethod] = useState<"manual" | "csv">("manual");
  const [row, setRow] = useState(blank);
  const [rows, setRows] = useState<ManualPurchase[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const request = useRef<string | null>(null);
  const router = useRouter();
  const investmentMenu = useRef<HTMLDetailsElement>(null);
  const fund = type === "MUTUAL_FUND";

  const update = (changes: Partial<ManualPurchase>) => {
    request.current = null;
    setRow((previous) => ({ ...previous, ...changes }));
  };

  async function save(entries: ManualPurchase[], source: "MANUAL" | "CSV") {
    setPending(true);
    onPendingChange(true);
    setError("");
    request.current ||= crypto.randomUUID();
    try {
      const result = await saveManualAssets(
        type,
        entries,
        request.current,
        source,
      );

      if (result.success) {
        router.refresh();
        close();
      } else setError(result.error || "Could not save entries.");
    } catch {
      setError(
        "Could not confirm the save. Retry without changing the entries.",
      );
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }

  async function read(file?: File) {
    if (!file) return;
    request.current = null;
    setRows([]);
    setPage(0);
    setError("");
    if (file.size > 2_000_000) {
      setError("The CSV must be smaller than 2 MB.");

      return;
    }

    const parsed = parseCsvRecords(await file.text());
    const records = parsed.records;

    if (
      !records ||
      records[0]?.join(",") !== headers.join(",") ||
      records.length < 2 ||
      records.length > 1001 ||
      records.slice(1).some((r) => r.length !== headers.length)
    ) {
      setError(parsed.error || "Use the template and provide 1 to 1,000 rows.");

      return;
    }

    setRows(
      records.slice(1).map(([name, date, quantity, price, expenseRatio]) => ({
        name: name.trim(),
        date: date.trim(),
        quantity: quantity.trim(),
        price: price.trim(),
        expenseRatio: expenseRatio.trim(),
      })),
    );
  }

  return (
    <fieldset className="purchase-entry-fieldset" disabled={pending}>
      <div className="purchase-tabs" role="tablist" aria-label="Entry method">
        <button
          type="button"
          role="tab"
          aria-selected={method === "manual"}
          onClick={() => {
            setMethod("manual");
            request.current = null;
            setError("");
          }}
        >
          Manual entry
        </button>
        {fund && (
          <button
            type="button"
            role="tab"
            aria-selected={method === "csv"}
            onClick={() => {
              setMethod("csv");
              request.current = null;
              setError("");
            }}
          >
            Import .csv
          </button>
        )}
      </div>
      {method === "manual" ? (
        <form
          className="trade-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save([row], "MANUAL");
          }}
        >
          <div className="manual-name-label">
            <span>{fund ? "Fund name" : "Investment name"}</span>
            {fund ? (
              <input
                required
                maxLength={200}
                aria-label="Fund name"
                value={row.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            ) : (
              <details
                className="investment-select"
                ref={investmentMenu}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    investmentMenu.current?.removeAttribute("open");
                    investmentMenu.current?.querySelector("summary")?.focus();
                  }
                }}
              >
                <summary aria-label="Investment name">
                  {row.name || "Select an investment"}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div className="investment-select-options">
                  {debtInvestmentNames.map((name) => (
                    <button
                      type="button"
                      key={name}
                      aria-pressed={row.name === name}
                      onClick={() => {
                        update({ name });
                        investmentMenu.current?.removeAttribute("open");
                        investmentMenu.current
                          ?.querySelector("summary")
                          ?.focus();
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
          {fund && (
            <label>
              Units
              <input
                required
                inputMode="decimal"
                value={row.quantity}
                onChange={(e) => update({ quantity: e.target.value })}
              />
            </label>
          )}
          <label>
            {fund ? "Purchase NAV per unit" : "Invested amount"}
            <input
              required
              inputMode="decimal"
              value={row.price}
              onChange={(e) => update({ price: e.target.value })}
            />
          </label>
          <label>
            Purchase date
            <input
              required
              type="date"
              value={row.date}
              onChange={(e) => update({ date: e.target.value })}
            />
          </label>
          {fund && (
            <label>
              Expense ratio (%)
              <input
                inputMode="decimal"
                value={row.expenseRatio}
                onChange={(e) => update({ expenseRatio: e.target.value })}
              />
              <small>
                Optional. Enter the fund’s stated annual expense ratio.
              </small>
            </label>
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
              disabled={
                !row.name.trim() ||
                !row.date ||
                !row.price.trim() ||
                (fund && !row.quantity.trim())
              }
            >
              {pending ? "Saving…" : "Save purchase"}
            </button>
          </div>
        </form>
      ) : (
        <div className="trade-form">
          <p className="trade-note">
            Enter fund name, purchase date, units, purchase NAV and optional
            expense ratio. Dates use YYYY-MM-DD.
          </p>
          <a
            download="mutual-fund-purchases.csv"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(headers.join(",") + "\r\n")}`}
          >
            Download CSV template
          </a>
          <label>
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                void read(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {rows.length > 0 && (
            <>
              <div className="purchase-table-scroll">
                <table className="purchase-table">
                  <thead>
                    <tr>
                      {[
                        "Fund",
                        "Date",
                        "Units",
                        "Purchase NAV",
                        "Expense ratio",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                      <th>
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(page * 6, page * 6 + 6).map((r, offset) => {
                      const i = page * 6 + offset;

                      return (
                        <tr key={i}>
                          {(
                            [
                              "name",
                              "date",
                              "quantity",
                              "price",
                              "expenseRatio",
                            ] as const
                          ).map((key) => (
                            <td key={key}>
                              <input
                                aria-label={`${key} for row ${i + 1}`}
                                value={r[key]}
                                onChange={(e) => {
                                  request.current = null;
                                  setRows((previous) =>
                                    previous.map((item, index) =>
                                      index === i
                                        ? { ...item, [key]: e.target.value }
                                        : item,
                                    ),
                                  );
                                }}
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              type="button"
                              aria-label={`Remove row ${i + 1}`}
                              onClick={() => {
                                request.current = null;
                                setRows((previous) =>
                                  previous.filter((_, index) => index !== i),
                                );
                                setPage((current) =>
                                  Math.min(
                                    current,
                                    Math.max(
                                      0,
                                      Math.ceil((rows.length - 1) / 6) - 1,
                                    ),
                                  ),
                                );
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="purchase-pagination">
                <span>
                  {rows.length} purchases · Page {page + 1} of{" "}
                  {Math.ceil(rows.length / 6)}
                </span>
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={(page + 1) * 6 >= rows.length}
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
              type="button"
              disabled={
                !rows.length ||
                rows.some(
                  (row) =>
                    !row.name.trim() ||
                    !row.date ||
                    !row.quantity.trim() ||
                    !row.price.trim(),
                )
              }
              onClick={() => void save(rows, "CSV")}
            >
              {pending ? "Saving…" : `Add ${rows.length || ""} purchases`}
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
