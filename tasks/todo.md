# Delivery checklist — personal tracker

Each item is a small independently verifiable slice. Refer to the [plan](plan.md) and [technical specification](../docs/technical-specification.md).

Daily portfolio history is wired up; see [delivery notes and remaining verification](daily-portfolio-history-plan.md). Corporate-action reconciliation and comprehensive provider-failure testing remain pending.

Purchase deletion is implemented with a confirmation and a guard against subsequent sales; apply migration 008 to enable it. Editing and sale-allocation replay remain pending.

## Feasibility

- [ ] Verify FYERS subscription, authenticated session, history ranges, price adjustment, rate limits and market-data rights. Test quote and daily candles for a few supported tickers; document cost and limitations. A single-owner live quote batch and selected historical closes were verified; corporate-action handling, provider rights and broader entitlement tests remain pending.

## Foundation

- [ ] Complete database foundation and migration workflow. The Neon driver and first portfolio identity migration are in place; a migration history system, isolated environments, and broader verification remain pending.
- [ ] Add Kinde sign-in and user-scoped queries. Basic sign-in and a protected dashboard are scaffolded; user-scoped persistence is pending. Verify two users cannot see or mutate each other's data.
- [ ] Complete ledger schema and service rules. Migration 002 adds instruments, transactions, observations, period baselines and sale allocations with composite ownership foreign keys; transactional oversell protection, FIFO semantics and two-user authorization tests remain pending.

## Investments

- [ ] Add stock and manual asset entry with validated buy transactions. Manual stock entry is implemented; manual assets and end-to-end ownership verification remain pending.
- [ ] Add sales, income, edits and audited void behavior. FIFO sales reject oversells and backdated entries before later sales; income, edits, voids, idempotency and concurrent integration tests remain pending.
- [ ] Implement FIFO, value and P/L with decimal arithmetic; test partial sales, fees and zero or missing prices.
- [ ] Add manual dated valuations for mutual funds, gold, EPF, fixed deposits and other assets. Verify stale and missing valuation states.

## FYERS and performance

- [ ] Implement separate server-side FYERS connection and expiry/reconnect. Confirm no credentials are sent to clients.
- [ ] Sync instrument catalog safely and search by ticker/exchange. Verify refresh preserves existing transaction links.
- [ ] Complete provider failure and concurrency verification. Batched quotes, five short historical windows, shared rate slots, cache fallback and prior-close selection are implemented; unit and live happy-path checks pass, while simulated expiry, 429, partial-response and concurrent-instance integration tests remain pending.
- [ ] Calculate per-lot CAGR, XIRR, price change and cash-flow-aware period P/L. Purchase-level CAGR and investment XIRR are implemented for supported inputs; broader cash-flow scenarios and validation remain pending.
- [ ] Build investment detail chart and all requested ranges, with actual baseline dates and transaction breakdown. Five dated investment-value points and current value are implemented; manual valuations and broader history remain pending.

## User experience and import

- [ ] Build tabbed investments and responsive dashboard with clear price timestamps and coverage. Basic stock ledger views support buys and FIFO sales, dated quotes and five baseline closes. The dashboard charts available daily closes and a same-day latest quote; server-side pagination is implemented; full historical coverage remains pending. Verify user totals reconcile with holdings.
- [ ] Download CSV template and preview validation without writes. Test malformed rows, unsupported tickers and duplicates.
- [ ] Commit imports atomically and idempotently. A one-off purchase seed used guarded atomic writes and was checked for repeat duplicates; a general import workflow, rollback and concurrent-sales testing remain pending.
- [ ] Verify mobile, keyboard, contrast, reduced motion, chart alternatives and empty/error states.

## Deployment

- [ ] Configure isolated Vercel environments and managed Postgres, migration execution, pooled connections, secrets and backup/restore.
- [ ] Run unit, integration and end-to-end tests, including authorization isolation, calculation fixtures and FYERS failure handling; document known limitations.


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

- [ ] Complete Live Market: the unpaginated sortable snapshot view is implemented; verify the owner-scoped FYERS Data Socket and 1D calculations during an open market, token renewal, deployed worker packaging and after-hours behavior; cross-instance coordination and persistence of previous closes remain pending.
