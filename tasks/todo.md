# Delivery checklist — personal tracker

Each item is a small independently verifiable slice. Refer to the [plan](plan.md) and [technical specification](../docs/technical-specification.md).

## Feasibility

- [ ] Verify Kite subscription, authenticated session, history ranges, price adjustment, rate limits and market-data rights. Test quote and daily candles for a few supported tickers; document cost and limitations.

## Foundation

- [ ] Bootstrap Next.js, TypeScript, Prisma Client, Prisma Migrate, PostgreSQL and lucide-react. Verify migrations, local development and production build.
- [ ] Add Kinde sign-in and user-scoped queries. Verify two users cannot see or mutate each other's data.
- [ ] Create five core tables and database constraints; verify migration and tenant ownership tests.

## Investments

- [ ] Add stock and manual asset entry with validated buy transactions. Verify persistence and asset ownership.
- [ ] Add sales, income, edits and audited void behavior; verify chronological oversell protection and concurrent writes.
- [ ] Implement FIFO, value and P/L with decimal arithmetic; test partial sales, fees and zero or missing prices.
- [ ] Add manual dated valuations for mutual funds, gold, EPF, fixed deposits and other assets. Verify stale and missing valuation states.

## Kite and performance

- [ ] Implement separate server-side Kite connection and expiry/reconnect. Confirm no credentials are sent to clients.
- [ ] Sync instrument catalog safely and search by ticker/exchange. Verify refresh preserves existing transaction links.
- [ ] Fetch batched current quotes and historical daily candles on demand with bounded cache and rate control. Test missing quotes, expiry, 429 and prior-close fallback.
- [ ] Calculate per-lot CAGR, XIRR, price change and cash-flow-aware period P/L. Verify independent fixtures and unavailable cases.
- [ ] Build investment detail chart and all requested ranges, with actual baseline dates and transaction breakdown. Test missing history and manual valuations.

## User experience and import

- [ ] Build tabbed investments and responsive dashboard with clear price timestamps and coverage. Verify user totals reconcile with holdings.
- [ ] Download CSV template and preview validation without writes. Test malformed rows, unsupported tickers and duplicates.
- [ ] Commit imports atomically and idempotently. Test rollback, duplicate references and concurrent sales.
- [ ] Verify mobile, keyboard, contrast, reduced motion, chart alternatives and empty/error states.

## Deployment

- [ ] Configure isolated Vercel environments and managed Postgres, migration execution, pooled connections, secrets and backup/restore.
- [ ] Run unit, integration and end-to-end tests, including authorization isolation, calculation fixtures and Kite failure handling; document known limitations.


## Sold transactions and tax reporting — incremental slices

- [ ] **S1: Sale allocation schema.** Add persisted sale-to-buy lot projection, charge fields, tax pool and constraints. Verify migration, ownership and decimal precision. Depends on ledger schema.
- [ ] **S2: Atomic sell workflow.** Lock, FIFO-match, store sale and allocations, and reduce holdings in one transaction. Verify partial sales, multiple lots, concurrent sells and rollback. Depends on S1.
- [ ] **S3: Corrections and replay.** Rebuild later allocations when backdated trades change; reject invalid future balances. Verify edit, void, deterministic replay and reload. Depends on S2.
- [ ] **S4: Sold view.** Create paginated chronological tab with per-lot dates, prices, quantity, investment P/L and valid CAGR/XIRR. Verify lot totals and unavailable states. Depends on S2.
- [ ] **S5: Tax input and review flags.** Capture STT and separately classified charges, ISIN, tax-lot pool and grandfathering inputs; identify unsupported cases. Verify FIFO pool isolation and no STT tax deduction. Depends on S3.
- [ ] **S6: FY and five accrual periods.** Version period definitions; group dated sale rows and raw gains/losses. Test every inclusive boundary and FY rollover; label unnotified years provisional. Depends on S4.
- [ ] **S7: Tax classification.** Implement supported listed-equity rules for an explicitly researched assessment year with validated fixtures; show review-required for unknown cases and separate tax gain from financial P/L. Depends on S5.
- [ ] **S8: Annual report and export.** Show annual and period totals, source lots, missing data and reconciliation guidance; export CSV, without claiming final ITR figures or tax payable. Verify totals reconcile and user isolation. Depends on S6 and S7.
- [ ] **S9: Filing validation.** Compare representative reports against independently calculated examples, broker tax P&L and notified form; document limits and review with a qualified Indian tax professional before relying on calculations. Depends on S8.
