"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Decimal from "decimal.js";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import {
  manualFundMetrics,
  debtRecordedXirr,
  type ManualAssetType,
} from "../../domain/manual-assets";
import { annualizedReturn } from "../../domain/returns";
import {
  saveManualObservation,
  saveDebtInterest,
  deleteDebtPurchase,
} from "../../app/dashboard/manual-asset-actions";

export type ManualAssetData = {
  assets: {
    id: string;
    asset_type: ManualAssetType;
    name: string;
    expense_ratio: string | null;
  }[];
  entries: {
    id: string;
    instrument_id: string;
    entry_type: "PURCHASE" | "INTEREST";
    date: string;
    quantity: string | null;
    amount: string;
    source: string;
    purchase_id?: string | null;
  }[];
  navs: { instrument_id: string; date: string; price: string }[];
};

export const money = (value: Decimal | null) => {
  if (value === null) return "Unavailable";

  const [whole, fraction] = value.abs().toFixed(2).split(".");
  const grouped =
    whole.length > 3
      ? `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`
      : whole;

  return `${value.isNegative() ? "−" : ""}₹${grouped}.${fraction}`;
};

const percent = (value: Decimal | null) =>
  value === null ? "Unavailable" : `${value.toFixed(2)}%`;

function ObservationForm({
  id,
  kind,
  close,
  onPendingChange,
}: {
  id: string;
  kind: "NAV" | "INTEREST";
  close: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const request = useRef<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="trade-form manual-observation"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        onPendingChange?.(true);
        setError("");
        request.current ||= crypto.randomUUID();
        try {
          const result =
            kind === "INTEREST"
              ? await saveDebtInterest(id, date, amount, request.current)
              : await saveManualObservation(
                  id,
                  kind,
                  date,
                  amount,
                  request.current,
                );

          if (result.success) {
            router.refresh();
            close();
          } else setError(result.error || "Could not save.");
        } catch {
          setError(
            "Could not confirm the save. Retry without changing the entry.",
          );
        } finally {
          setPending(false);
          onPendingChange?.(false);
        }
      }}
    >
      <label>
        {kind === "NAV" ? "NAV per unit" : "Interest credited"}
        <input
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            request.current = null;
            setAmount(e.target.value);
          }}
        />
      </label>
      <label>
        {kind === "NAV" ? "NAV date" : "Credit date"}
        <input
          required
          type="date"
          value={date}
          onChange={(e) => {
            request.current = null;
            setDate(e.target.value);
          }}
        />
      </label>
      {error && (
        <p className="trade-error" role="alert">
          {error}
        </p>
      )}
      <div className="trade-buttons">
        <button type="button" disabled={pending} onClick={close}>
          Cancel
        </button>
        <button type="submit" disabled={pending || !date || !amount.trim()}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function InterestDialog({ id, close }: { id: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="trade-dialog"
      aria-labelledby="interest-dialog-title"
      onClose={close}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <div className="trade-dialog-header">
        <h2 id="interest-dialog-title">Record interest credit</h2>
        <button
          type="button"
          aria-label="Close"
          disabled={pending}
          onClick={close}
        >
          ×
        </button>
      </div>
      <ObservationForm
        id={id}
        kind="INTEREST"
        close={close}
        onPendingChange={setPending}
      />
    </dialog>
  );
}

export function ManualAssetsUnavailable({ type }: { type: ManualAssetType }) {
  const fund = type === "MUTUAL_FUND";

  return (
    <div className="sample-empty" role="status">
      <h2>
        {fund ? "Mutual funds unavailable" : "Debt investments unavailable"}
      </h2>
      <p>Check the database connection and migration status.</p>
    </div>
  );
}

export function ManualAssets({
  data,
  type,
  detailId,
}: {
  data: ManualAssetData;
  type: ManualAssetType;
  detailId?: string;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const assets = data.assets.filter((a) => a.asset_type === type);
  const fund = type === "MUTUAL_FUND";
  const asset = assets.find((a) => a.id === detailId);

  const getEntries = (id: string) =>
    data.entries.filter((e) => e.instrument_id === id);

  const getNav = (id: string) =>
    data.navs.find((n) => n.instrument_id === id) || null;

  const metrics = (id: string) =>
    manualFundMetrics(
      getEntries(id)
        .filter((e) => e.entry_type === "PURCHASE")
        .map((e) => ({ date: e.date, quantity: e.quantity!, price: e.amount })),
      getNav(id),
    );

  if (asset) {
    const entries = getEntries(asset.id);
    const nav = getNav(asset.id);
    const m = fund ? metrics(asset.id) : null;
    const latest = entries.reduce(
      (day, e) => (e.date > day ? e.date : day),
      "",
    );
    const debtXirr = fund ? null : debtRecordedXirr(entries);

    return (
      <div className="manual-details">
        <Link
          className="detail-back"
          href={`/dashboard?view=portfolio&tab=${fund ? "mutual" : "debt"}`}
        >
          ← Portfolio
        </Link>
        <header className="sample-heading">
          <div>
            <h1>{asset.name}</h1>
            <p>{fund ? "Mutual fund" : "Debt & other"}</p>
          </div>
        </header>
        {fund && m && (
          <section className="overview-metrics" aria-label="Investment summary">
            <div>
              <span>Units</span>
              <strong>{m.quantity.toString()}</strong>
            </div>
            <div>
              <span>Invested</span>
              <strong>{money(m.cost)}</strong>
            </div>
            <div>
              <span>Latest value</span>
              <strong>{money(m.value)}</strong>
              <small>{nav ? `NAV ${nav.date}` : "No NAV recorded"}</small>
            </div>
            <div>
              <span>Investment XIRR</span>
              <strong>{percent(m.xirr)}</strong>
            </div>
          </section>
        )}
        {!fund && (
          <section className="overview-metrics" aria-label="Investment summary">
            <div>
              <span>Investment XIRR</span>
              <strong>{percent(debtXirr)}</strong>
              <small>
                {latest
                  ? `Based on recorded balance as of ${latest}`
                  : "No recorded balance"}
              </small>
            </div>
          </section>
        )}
        <section className="real-panel detail-transactions">
          <div className="panel-heading">
            <div>
              <h2>{fund ? "Purchases" : "Investment history"}</h2>
              <p>
                {fund
                  ? "Returns use recorded purchases and the latest dated NAV. NAV already reflects fund expenses; the expense ratio is not deducted again."
                  : "Amounts and interest credits recorded by you."}
              </p>
            </div>
          </div>
          <div className="sample-transaction-scroll">
            <table className="sample-transactions">
              <thead>
                <tr>
                  {(fund
                    ? [
                        "Date",
                        "Units",
                        "Purchase NAV",
                        "Invested",
                        "Current P&L",
                        "CAGR",
                      ]
                    : ["Date", "Type", "Amount"]
                  ).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const cost = fund
                    ? new Decimal(e.quantity!).mul(e.amount)
                    : new Decimal(e.amount);
                  const value =
                    fund && nav && nav.date >= e.date
                      ? new Decimal(e.quantity!).mul(nav.price)
                      : null;
                  const cagr =
                    value && nav
                      ? annualizedReturn(
                          cost.toString(),
                          value.toString(),
                          e.date,
                          nav.date,
                        )
                      : null;

                  return (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      {fund ? (
                        <>
                          <td>{e.quantity}</td>
                          <td>{money(new Decimal(e.amount))}</td>
                          <td>{money(cost)}</td>
                          <td>{money(value?.minus(cost) ?? null)}</td>
                          <td>{percent(cagr)}</td>
                        </>
                      ) : (
                        <>
                          <td>
                            {e.entry_type === "INTEREST"
                              ? "Interest"
                              : "Purchase"}
                          </td>
                          <td>{money(cost)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {fund && (
          <section className="real-panel">
            <h2>Recorded NAVs</h2>
            <ul>
              {data.navs
                .filter((n) => n.instrument_id === asset.id)
                .map((n) => (
                  <li key={n.date}>
                    {n.date} · {money(new Decimal(n.price))} per unit
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  if (!assets.length)
    return (
      <div className="sample-empty">
        <h2>No {fund ? "mutual funds" : "debt investments"} yet</h2>
        <p>Record a purchase to start tracking them.</p>
      </div>
    );

  return (
    <div className="sample-holdings">
      <div className="sample-columns" aria-hidden="true">
        <span>Investment</span>
        <span>{fund ? "Units / invested" : "Invested amount"}</span>
        <span>{fund ? "Current value" : "Interest credited"}</span>
        <span>{fund ? "Unrealized P&L" : null}</span>
        <span />
      </div>
      {assets.map((a) => {
        const entries = getEntries(a.id);
        const m = fund ? metrics(a.id) : null;
        const principal = entries
          .filter((e) => e.entry_type === "PURCHASE")
          .reduce((s, e) => s.plus(e.amount), new Decimal(0));
        const interest = entries
          .filter((e) => e.entry_type === "INTEREST")
          .reduce((s, e) => s.plus(e.amount), new Decimal(0));
        const nav = getNav(a.id);

        return (
          <div className="holding-entry" key={a.id}>
            <details className="sample-holding">
              <summary>
                <span className="sample-company">
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {fund
                        ? `Expense ratio: ${a.expense_ratio === null ? "Not provided" : `${a.expense_ratio}%`}`
                        : null}
                    </small>
                  </span>
                </span>
                <span className="sample-cell">
                  <strong>
                    {fund
                      ? `${m!.quantity.toString()} units`
                      : money(principal)}
                  </strong>
                  <small>{fund ? `Invested ${money(m!.cost)}` : null}</small>
                </span>
                <span className="sample-cell">
                  <strong>{fund ? money(m!.value) : money(interest)}</strong>
                  <small>
                    {fund
                      ? nav
                        ? `NAV ${nav.date}`
                        : "No NAV recorded"
                      : principal.isZero()
                        ? "Percentage unavailable"
                        : `${interest.div(principal).mul(100).toFixed(2)}%`}
                  </small>
                </span>
                <span className="sample-cell">
                  <strong>
                    {fund
                      ? money(m!.value?.minus(m!.cost) ?? null)
                      : money(principal.plus(interest))}
                  </strong>
                  <small>{fund ? "Unrealized P&L" : null}</small>
                </span>
                <ChevronDown
                  className="sample-chevron"
                  size={17}
                  aria-hidden="true"
                />
              </summary>
              <div className="sample-lots">
                {fund && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setEdit(edit === a.id ? null : a.id)}
                  >
                    Record NAV
                  </button>
                )}
                {fund && edit === a.id && (
                  <ObservationForm
                    id={a.id}
                    kind={fund ? "NAV" : "INTEREST"}
                    close={() => setEdit(null)}
                  />
                )}
                {fund ? (
                  <p>
                    {entries.filter((e) => e.entry_type === "PURCHASE").length}{" "}
                    purchases
                  </p>
                ) : (
                  <div className="sample-lot-scroll">
                    <table aria-label={`Investments in ${a.name}`}>
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Invested amount</th>
                          <th scope="col">Interest credited</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries
                          .filter((entry) => entry.entry_type === "PURCHASE")
                          .map((entry) => {
                            const credits = entries.filter(
                              (credit) =>
                                credit.entry_type === "INTEREST" &&
                                credit.purchase_id === entry.id,
                            );
                            const total = credits.reduce(
                              (sum, credit) => sum.plus(credit.amount),
                              new Decimal(0),
                            );

                            return (
                              <Fragment key={entry.id}>
                                <tr>
                                  <td>{entry.date}</td>
                                  <td>{money(new Decimal(entry.amount))}</td>
                                  <td>{money(total)}</td>
                                  <td>
                                    <div className="purchase-actions">
                                      <button
                                        type="button"
                                        aria-label={`Record interest for ${a.name} purchase on ${entry.date}`}
                                        onClick={() =>
                                          setEdit(
                                            edit === entry.id ? null : entry.id,
                                          )
                                        }
                                      >
                                        <Pencil size={17} aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={deleting}
                                        className="delete-purchase"
                                        aria-label={`Delete ${a.name} purchase on ${entry.date}`}
                                        onClick={async () => {
                                          if (
                                            !window.confirm(
                                              `Delete the ${a.name} purchase dated ${entry.date}?`,
                                            )
                                          )
                                            return;
                                          setDeleting(true);
                                          setDeleteError("");
                                          try {
                                            const result =
                                              await deleteDebtPurchase(
                                                entry.id,
                                              );

                                            if (result.success)
                                              router.refresh();
                                            else
                                              setDeleteError(
                                                result.error ||
                                                  "Could not delete purchase.",
                                              );
                                          } catch {
                                            setDeleteError(
                                              "Could not delete purchase.",
                                            );
                                          } finally {
                                            setDeleting(false);
                                          }
                                        }}
                                      >
                                        <Trash2 size={17} aria-hidden="true" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                    {edit &&
                      entries.some(
                        (e) => e.entry_type === "PURCHASE" && e.id === edit,
                      ) && (
                        <InterestDialog id={edit} close={() => setEdit(null)} />
                      )}
                    {deleteError && (
                      <p className="trade-error" role="alert">
                        {deleteError}
                      </p>
                    )}
                    {entries.some(
                      (e) => e.entry_type === "INTEREST" && !e.purchase_id,
                    ) && (
                      <p>
                        Earlier interest credits are included in the group total
                        and are not assigned to an individual purchase.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </details>
            <Link
              className="holding-details-link"
              href={`/dashboard?view=portfolio&manual=${a.id}`}
            >
              View details <span className="sr-only">for {a.name}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
