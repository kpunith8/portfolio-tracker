# Portfolio Tracker — product plan

The app tracks an individual's investments using user-owned transactions and FYERS market data. Each Kinde login has an independent portfolio; FYERS does not synchronize broker holdings or place orders. [README](../README.md) describes current capabilities and setup; the [technical specification](technical-specification.md) records architecture and data invariants.

## Current capabilities

- Manual stock purchases, FIFO sales and guarded purchase deletion; portfolio and transaction views use user-scoped records and server-side pagination.
- Owner-only FYERS quotes, selected historical baselines, daily dashboard history and an on-demand Live Market stream, with dated fallback and incomplete-data disclosures.
- Purchase-level CAGR and investment XIRR for supported inputs. Value charts reflect changing holdings, not cash-flow-adjusted returns.
- Existing seeded ETFs appear under Stocks; missing brokerage and taxes on imported purchases are disclosed.
- Manual mutual fund purchases, CSV import and dated NAVs, plus debt purchases and dated interest credits. Transactions can be filtered by asset type; dashboard totals remain stock-only.
- Manual stock purchase entry and CSV review use a shared FYERS symbol catalog; CSV purchases are saved atomically with retry protection and CSV provenance.

## Remaining work

### Ledger and asset coverage

- Add edits, voids, income and charges, duplicate-submission protection and atomic replay of subsequent sale allocations; reject corrections that create oversells.
- Test FIFO across partial sales, multiple lots, backdated changes and concurrent requests; verify ownership isolation and calculation fixtures.
- Extend manual asset workflows with withdrawals, sales, corrections and deletion, and add dated valuations for gold and other assets. Do not estimate interest or invent valuations; show stale and missing dates.
- Expand investment details and supported performance calculations only when the required cash flows and valuation history exist; keep market movement, investment P/L and time-weighted returns distinct.

### Import and export

- Extend purchase CSV preview with versioned templates and detection of possible duplicates against existing ledger entries.
- Expand import support beyond purchases and exercise concurrent imports and catalog refreshes.
- Provide useful exports with formula-triggering cells escaped. A one-off seed is not a general import workflow.

### Sold investments and tax reporting

- Extend sale allocations with the source dates, quantities, prices, separately classified charges and review data needed for a paginated Sold view; maintain the ledger as the source of truth.
- Add a financial-year report with dated lots, proceeds, costs and supported gains or losses; reconcile totals against transactions and allow export.
- Version classifications and reporting periods by assessment year and verify current primary sources before implementation. The [AY 2026–27 notified form](https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-04/Notification%20No.48_2026.pdf) has five capital-gain accrual periods; do not assume later forms are identical.
- Capture STT, eligible charges and any required grandfathering inputs separately. Demat-specific FIFO may require a tax-lot pool; flag unverified pools and unsupported cases for review, without introducing a full broker-account model.
- Distinguish financial P/L, taxable gain and raw reporting-period totals from final ITR entries after loss adjustments. This is preparation support, not a tax liability calculation or a filing-ready return; verify examples against broker records and applicable guidance.

### FYERS, history and reliability

- Verify provider entitlements, costs, retention and sharing rights, rate limits, history depth and corporate-action adjustment behavior before expanding access or making stronger accuracy claims.
- Reconcile adjusted historical prices with recorded quantities and previously cached closes. Transactions are authoritative; never automatically reapply splits or bonuses to the user's recorded holdings.
- Preserve daily history for sold positions and show incomplete coverage when a held ticker lacks a usable close; do not substitute purchase cost or present partial sums as complete. Current quotes must be dated and distinguishable from completed daily closes.
- Safely audit and repair older coverage that may have been marked complete despite gaps. The chart uses observed dates and can connect across a day missing all prices; a reliable exchange calendar is needed to distinguish holidays from missing data.
- Exercise refresh recovery for expired sessions, 429 responses, partial data, interruptions, duplicate requests and concurrent instances; measure storage against the 1 GB budget using an isolated dataset.
- Verify the owner-scoped Live Market stream, 1D calculations, production rotation, token renewal and after-hours behavior. Process-local sharing does not coordinate multiple instances; determine whether coordination is needed before adding it.
- Add corporate-action metadata only when a reliable, permitted source is established; announcements must not automatically mutate holdings or imply dividend cash flows.

### Experience and operations

- Verify responsive layouts, keyboard access, contrast, reduced motion, chart alternatives, and loading, empty, stale and reconnect states.
- Verify two-user isolation, backups and restoration, isolated deployment environments and controlled migrations; add integration and browser coverage for financial and provider failure paths.
- Decide whether additional users can connect FYERS under its terms, and what manual-asset fields and retention policies are needed. Do not assume that Kinde login grants FYERS access or permission to share prices.

## Product direction

The dashboard should explain portfolio value and coverage; investment details should distinguish a user's cash flows from market price movement. Settings may eventually offer data import/export and account deletion. Keep assets and tax preparation understandable, use dated source data, and mark unavailable or unsupported outcomes explicitly.
