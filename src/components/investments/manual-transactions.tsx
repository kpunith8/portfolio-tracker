"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import {
  PORTFOLIO_PAGE_SIZE,
  portfolioPageCount,
} from "../../domain/pagination";
import { formatRecordedDate } from "../../domain/market-date-utils";
import { type ManualAssetType } from "../../domain/manual-assets";
import { TableHeader, TableScroll } from "../ui/table";
import { type ManualAssetData, money } from "./manual-assets";

export function ManualTransactions({
  data,
  type,
}: {
  data: ManualAssetData;
  type: ManualAssetType;
}) {
  const [page, setPage] = useState(1);
  const assets = new Map(
    data.assets
      .filter((asset) => asset.asset_type === type)
      .map((asset) => [asset.id, asset]),
  );
  const entries = data.entries.filter(
    (entry) =>
      assets.has(entry.instrument_id) && entry.entry_type === "PURCHASE",
  );
  const fund = type === "MUTUAL_FUND";
  const pages = portfolioPageCount(entries.length);
  const currentPage = Math.min(page, pages);

  if (!entries.length)
    return (
      <div className="sample-empty">
        <h2>No {fund ? "mutual fund" : "debt"} transactions yet</h2>
        <p>Record a purchase to get started.</p>
      </div>
    );

  return (
    <>
      <TableScroll
        className="sample-transaction-scroll"
        label="Scrollable transaction table"
      >
        <table className="sample-transactions">
          <TableHeader
            columns={
              fund
                ? [
                    "Date",
                    "Mutual fund",
                    "Type",
                    "Units",
                    "Purchase NAV",
                    "Invested amount",
                  ]
                : ["Date", "Investment", "Type", "Amount"]
            }
          />
          <tbody>
            {entries
              .slice(
                (currentPage - 1) * PORTFOLIO_PAGE_SIZE,
                currentPage * PORTFOLIO_PAGE_SIZE,
              )
              .map((entry) => (
                <tr key={entry.id}>
                  <td>{formatRecordedDate(entry.date)}</td>
                  <td>{assets.get(entry.instrument_id)?.name}</td>
                  <td>
                    {entry.entry_type === "INTEREST"
                      ? "Interest credit"
                      : "Purchase"}
                  </td>
                  {fund && (
                    <>
                      <td>{entry.quantity ?? "Unavailable"}</td>
                      <td>{money(new Decimal(entry.amount))}</td>
                    </>
                  )}
                  <td>
                    {money(
                      fund && entry.quantity
                        ? new Decimal(entry.amount).mul(entry.quantity)
                        : new Decimal(entry.amount),
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableScroll>
      {pages > 1 && (
        <nav className="page-controls" aria-label="Pagination">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {pages}
          </span>
          <button
            type="button"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
