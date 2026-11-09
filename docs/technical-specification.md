# Technical specification

This document describes the current architecture and the invariants needed to evolve it. [README](../README.md) covers setup and operational limitations; [the product plan](plan.md) describes planned work. Planned capabilities are not implied to be implemented here.

## Architecture and ownership

- Next.js App Router renders authenticated dashboard views; React components handle interaction, and server actions and route handlers orchestrate reads, writes and provider calls.
- Kinde identifies the user; server-side authorization derives the subject from the session and scopes portfolio, transaction and market-data queries to that owner. Application scoping is not database row-level security.
- Neon PostgreSQL stores portfolio-owned instruments, transactions, FIFO sale allocations, price observations, historical baselines, daily closes and coverage. Versioned SQL migrations enforce ownership and ledger constraints.
- FYERS is a server-side market-data provider, independent of the ledger and Kinde login. Only the configured owner can use its encrypted, user-bound, HTTP-only session cookie; do not assume cross-user access or data-sharing rights.
- Domain helpers calculate holdings, prices, dates, returns and history independently of UI and provider transport. Server workflows use focused data-access functions and parameterized SQL; keep authorization and provider concerns at the boundary.

## Ledger and calculations

- User-entered transactions are authoritative. Database trade operations serialize per portfolio, validate ownership and quantities, allocate sales FIFO and reject oversells and backdated trades before later sales; they do not replay later allocations.
- Purchase deletion is confirmed, permanent and disallowed when a sale exists on or after that purchase date. Preserve the purchase and sale records underlying allocations; never silently rewrite history.
- Use decimal arithmetic for money and quantities. Remaining cost is the cost of unsold lots; current value is remaining quantity times an applicable price; unrealized P/L is value less remaining cost. Missing or pre-trade quotes must not produce invented values.
- Purchase CAGR uses remaining shares, cost, valuation date and elapsed time. Investment XIRR uses recorded dated cash flows and current value; return unavailable for invalid, ambiguous or unsupported solutions.
- Dashboard history reconstructs quantities from the ledger at available daily closes. Investment-detail history values holdings at selected dated prices. Both show investment value, including the effects of trades, rather than a cash-flow-adjusted return.
- Distinguish financial P/L from taxable gain. Charges are not supported in the current trade workflow, and imported records with unknown charges must disclose the omission. Do not present figures as filing-ready.

## Data freshness and provider flow

1. The server reads user-scoped holdings and dated cached observations; the browser can show cached values while requesting an on-demand refresh.
2. FYERS HTTP requests run server-side with `no-store`, shared PostgreSQL rate coordination, bounded batches and dated fallback. Preserve the two-second reservation, 4,000-per-India-day budget and 429 cooldown.
3. Neon keeps one current quote per ticker/portfolio, up to seven baseline rows and separate daily closes with coverage and a sync lease. Refresh stale quotes after five minutes and reuse successful baselines checked on the current Asia/Kolkata date. Never overwrite saved daily closes; preserve dated values on failure.
4. Backfill missing history in bounded ranges. Treat `no_data` and missing weekdays as retryable unavailable coverage, not prices; use BSE fallback only for an unambiguous exact ISIN match, record the source and disclose it. Show gaps and corporate-action adjustment uncertainty.
5. The dashboard's 60-second full-ledger cache uses a user-specific key/tag. A successful in-app trade expires that tag and revalidates the dashboard; never cache cookies or unscoped user results. Portfolio lists and ticker details use scoped direct reads.

Storage is budgeted at 1 GB. User transactions and manual valuation history must not be discarded to make room for derived market data.

## Live Market

The owner's browser requests an on-demand stream from a server route; a worker connects to the FYERS Data Socket and forwards validated updates through server-sent events. A process-local worker can serve multiple listeners but cannot coordinate separate server instances. The client disconnects on hide or unmount, keeps recent ticks in view memory and falls back to dated quotes; streaming values and previous closes are not persisted in the quote cache.

Vercel production requests rotate before the function deadline and the client uses bounded retries; development and preview do not automatically rotate or retry failures. Preserve cancellation cleanup and visible failure states, and validate live behavior and production rotation during market hours. Current-holdings 1D movement requires suitable same-date previous closes; it is not a personal cash-flow-adjusted return.

## Evolving the application

- Purchase CSV import uses the downloaded template, resolves symbols against the shared FYERS catalog, and commits each batch atomically with an owner-scoped retry key and CSV provenance. A changed payload requires a new key; uncertain saves should be retried without editing. The catalog is refreshed manually and can be stale. The import currently accepts up to 1,000 rows, whole-share quantities, and no charges.
- Edits/voids and sale replay, manual-asset sales and withdrawals, sold-lot reporting and tax reporting remain planned; consult the product plan before implementing them.
- Import should validate a preview without writes, prevent duplicate submissions, and commit atomically while preserving provenance and ownership. Escape formula-triggering cells on export.
- Financial-year and tax rules must be versioned and verified against current primary sources. FIFO for tax may require a demat-specific pool; unsupported classifications, STT, grandfathering and loss adjustments require review. Raw reporting-period totals are not final ITR entries.
- For manual assets, use user-supplied dated valuations and compatible cash flows; do not estimate interest or claim current values without evidence.
- Do not add broker synchronization, order execution, household aggregation or expanded provider sharing without an explicit requirement and appropriate authorization.

## Manual mutual funds and debt

- Owner-scoped manual instruments group purchases by asset type and case-insensitive name. Fund purchases retain fractional units, purchase NAV and optional expense ratio; new debt purchases use Sukanya Yojane, PPF or FD and retain invested amounts without units. Purchases with the same name appear together in an expandable row; existing other debt names remain visible. CSV purchase batches use the existing owner-scoped retry ledger and commit atomically.
- User-entered NAVs are dated observations; fund values and XIRR require a NAV at least as recent as every purchase. Expense ratios are informational and are not subtracted from NAV-based returns. New dated debt interest credits reference their purchase; older group-level credits remain unallocated. Deletion voids eligible purchases and is rejected when linked or unallocated interest could be orphaned. Dated interest credits are retained separately; recorded debt balance sums entered principal and interest, without estimating a current balance. Debt XIRR treats recorded purchases as contributions and uses that balance on the latest recorded entry date as the terminal value.
- Transactions filter stock, mutual fund and debt purchases and stock sales; debt interest credits remain in investment details; dashboard totals and history remain stock-only and disclose that limitation. Manual assets do not yet support withdrawals, sales or corrections; eligible debt purchases can be voided.
