# Personal Portfolio Tracker — Technical Specification

Status: revised proposal, 3 November 2026. This supersedes the previous household design. Related: [product plan](../tasks/plan.md) and [delivery checklist](../tasks/todo.md).

## 1. Scope and decisions

Each Kinde login owns one independent investment portfolio. A user manually records executed purchases, sales and other cash flows, or imports them from CSV. FYERS is a market-data provider: given a supported exchange and ticker, retrieve the latest price and daily historical prices. Do not fetch brokerage holdings, place orders, model broker accounts or use WebSockets. EPF, fixed deposits and other debt are manually valued. Mutual funds and physical gold start with manual valuations; listed ETFs can use FYERS where supported.

Other logins are isolated, not members of a shared household. Initial deployment is Vercel with managed Postgres; domain logic, persistence and market-data adapters must be portable to another host. Compute holdings rather than persist redundant positions, and keep the 1 GB storage constraint in mind. This favors simplicity for a personal portfolio; scale-driven caches, workers and audit tables can be introduced later when supported by evidence.

## 2. Architecture

```mermaid
flowchart LR
  Browser -->|HTTPS| Next[Next.js App Router]
  Next --> Kinde[Kinde authentication]
  Next --> Services[Portfolio services]
  Services --> Calc[Pure calculations]
  Services --> Repo[Database repositories]
  Repo --> DB[(Neon PostgreSQL)]
  Services --> Adapter[Market data adapter]
  Adapter --> FYERS[FYERS API]
```

Use TypeScript strict mode, Next.js App Router and Node runtime, the Neon serverless driver with PostgreSQL, lucide-react for icons, Kinde SDK, FYERS Node.js integration, Zod boundary schemas, a decimal arithmetic library, accessible UI primitives and a chart library. Keep route handlers and server actions thin. Services perform authorization and coordinate transactions, a pure domain module calculates returns, and repository/provider adapters isolate PostgreSQL and FYERS. Use parameterized Neon serverless queries and versioned SQL migrations. The initial migration is run explicitly, not on application startup; adopt migration history tracking before adding further migrations. Pin compatible dependency versions during implementation rather than embedding stale version assumptions. Use lucide-react consistently for interface icons with accessible labels where needed.

Suggested directories: `src/app` routes, `src/features` screens and application services, `src/domain` calculation functions, `src/server/db` database repositories, `src/server/market-data` adapters, `db/migrations` versioned SQL, and `tests` for unit, integration and end-to-end verification. No domain module depends on Next.js or SDK response types.

## 3. Portfolio data model

Migration 002 implements `instruments`, `investment_transactions`, `price_observations`, `ticker_period_baselines` and `sale_allocations` in addition to `portfolios` and the migration ledger. Instruments and every observation are portfolio-scoped until sharing rights are established. Composite foreign keys prevent cross-portfolio instrument, price and transaction references. The schema is a foundation, not an implemented ledger: service-level chronological oversell prevention, FIFO replay, validated writes, ownership authorization and tax semantics are still required. The conceptual sections below describe planned fields; they do not assert all fields are present.

The storage budget is 1 GB. Migration 003 limits `ticker_period_baselines` to one row per portfolio, ticker and period: `7D`, `15D`, `30D`, `60D`, `90D`, `6M`, and `365D` (at most seven rows per ticker). Each record contains its as-of date, target date, actual market date, decimal close, adjustment basis, status and check time; a successful refresh replaces that period's prior row. An available price must have an actual market date on or before the target. Keep manual valuations and user transactions; they are authoritative and must not be deleted by cache cleanup. FYERS daily candles must not be persisted to `price_observations`; the partial unique index permits at most one FYERS quote per portfolio and ticker. Existing observations predating migration 003 are retained rather than silently deleted. Application services must upsert the current quote rather than insert a row each day.

The owner-scoped details refresh is implemented. On opening details, calculate five target dates in Asia/Kolkata: calendar days for 7/30/90/365 and calendar-month subtraction for 6M. Existing 15D and 60D cache rows are preserved but not refreshed or displayed. If a baseline was already checked for the same as-of date, reuse it; otherwise make at most one request for each missing or stale period, with a short bounded date window ending on the target. Select the most recent actual close on or before the target, never invent one, and save only that close, not all candles returned. Weekends and market holidays can require an earlier session. If a window has no data, mark coverage unavailable or use a bounded retry rather than guessing. On provider error preserve any prior successful row and show its as-of date and stale status. A shared database slot limits requests across instances; concurrent requests are throttled rather than fully deduplicated. Conditional upserts prevent older-started responses from overwriting newer ones. FYERS responses may contain incomplete current-session candles; historical baseline selection must use completed data. Sharing across users remains subject to provider terms.

The investment details chart values shares held at each selected close using dated purchases and sales; cash flows change the charted value, so it is not a cash-flow-adjusted return. Dates and unavailable data are shown, and the latest quote is a separate point. Unverified corporate actions can affect the results. The purchase table shows current unrealized P/L and per-lot CAGR for remaining shares and allocated remaining cost. Investment XIRR uses dated purchase costs, net sale proceeds and the current terminal value, using decimal arithmetic and a bounded root search; missing or stale valuations, zero elapsed time, multiple cash-flow sign changes and unsupported roots are unavailable. Missing recorded fees and taxes are disclosed. These are investment measures, not taxable gains.

The dashboard portfolio history chart uses the recorded cost basis at the selected range start and transaction dates, including original purchase charges and persisted cost allocations for sales. Historical values are estimated from remaining purchase costs, not past market values; missing or inconsistent sale allocations produce gaps. The latest point uses cached FYERS quotes if their dates are at least as recent as the corresponding last trade, falling back to remaining cost otherwise. The chart clearly labels estimates, varying quote dates, transaction effects, and illustrative interpolation. It makes no additional historical API requests or database rows. Cache the dashboard’s authenticated full-ledger query under a per-user key with a 60-second revalidation interval and expire it immediately after in-app writes; list pages query their server-side page directly; market quotes and baselines remain independently refreshed. Out-of-band database changes may remain stale until revalidation completes. Historical price-based returns remain unavailable without further market data.

On dashboard load, derive positions from active transactions and FIFO sale allocations, fetch stale quotes in batches of at most 50 FYERS symbols, and display dated prices. FYERS Standard currently documents 5 requests/second, 50/minute and 5,000/day across Data APIs; use shared distributed coordination, bounded backoff and cache rather than relying on process-local throttling. Batched quote refresh and the five selected-close refresh are implemented for the configured FYERS owner; broader failure and concurrency verification remains pending. For a buy lot, profit uses remaining quantity and allocated remaining cost including fees; a sale must not leave the full original buy quantity in the lot. Portfolio return is aggregate profit divided by aggregate remaining cost only when coverage is sufficient and cost is nonzero. Show gain/loss with text and sign as well as color. Missing or inconsistent prices make affected values unavailable. This is unrealized investment P/L, not taxable gain.

### Conceptual model


Identifiers are UUIDs, timestamps UTC `timestamptz`, financial dates Postgres `date`. Money and prices use `numeric(24,8)` and quantities `numeric(28,10)`; use decimal arithmetic end-to-end and serialize decimals as strings. Currency INR initially. Use foreign keys, database checks and indexed access; enforce constraints in versioned SQL migrations.

### `Portfolio`

The first migration creates `portfolios`: UUID `id`, unique `kinde_subject`, and created/updated timestamps. One Kinde identity owns one portfolio. Server-side repository queries derive the subject from the authenticated session; application-level scoping is not database row-level security. Remaining tables and ownership relationships are planned.

### `Instrument`

`id`, `ownerUserId` nullable, `assetType` (STOCK, MUTUAL_FUND, GOLD, DEBT_OTHER), `name`, `exchange` nullable, `tradingSymbol` nullable, `providerToken` nullable, `isin` nullable, `unit` (share, unit, gram or account), `currency`, `isActive`, `lastSyncedAt`, and optional JSON metadata (e.g. maturity date, purity). The implemented `instruments` table is always portfolio-owned; shared catalog entries remain a possible future design. Use a partial unique index on `(exchange, tradingSymbol)` for active shared listings, and an index on `ownerUserId`. Stable internal IDs anchor transactions; provider token is a refreshable mapping, not the primary key. Sync updates or marks unavailable; never delete instruments referenced by transactions. Preserve mapping changes where necessary, and flag ambiguous symbol changes for manual resolution. Access to custom instruments requires matching ownership.

### `Transaction`

`id`, `userId`, `instrumentId`, `type` (BUY, SELL, INCOME, FEE, ADJUSTMENT), `date`, `sequence`, `quantity` nullable, `unitPrice` nullable, `amount` nullable, `fees`, `taxes`, `currency`, `externalReference` nullable, `source` (MANUAL or CSV), `notes` nullable, `version`, `voidedAt` nullable, `createdAt`, `updatedAt`. All amounts have nonnegative magnitudes; type defines direction. BUY/SELL require positive quantity and nonnegative price; income/fee requires amount. Adjustment semantics must explicitly define unit and cost impact; unsupported corporate actions are flagged. Order same-day events by `(date, sequence, id)`. Add index `(userId, instrumentId, date, sequence, id)` and partial unique `(userId, externalReference)` for active non-null references. A manual asset can be referenced only by its owner; enforce through scoped service checks and, where feasible, database constraints. Edits use optimistic `version`; void rather than hard-delete. In this lean v1, version and timestamps do not provide a full revision audit trail; add an audit table if immutable history becomes a requirement.

### `PriceObservation`

`id`, `instrumentId`, nullable `userId`, `source` (FYERS or MANUAL), `observedAt`, `marketDate`, `interval` (QUOTE or DAY or MANUAL), `price`, optional OHLC fields, `adjustmentBasis`, `retrievedAt`. Implemented FYERS observations are always portfolio-scoped; sharing is a future option only if provider terms permit it. Manual valuations must have `userId` and apply only to their owner. Index `(instrumentId, userId, marketDate)` and use uniqueness/upsert rules for source, scope, instrument, interval and observation date; implement separate partial unique indexes for null and non-null user scope. A manual valuation stores the value per unit and unit explicitly; account-like EPF/FD can use quantity 1 and a total account value, provided contributions and redemptions use compatible units. Confirm the precise manual-entry representation in UI and fixtures before implementation. Historical daily prices are close values; quote timestamps and manual effective dates remain distinct.

Illustrative future transaction schema (not an installed model or complete security model):

```prisma
model Transaction {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @db.Uuid
  instrumentId String   @db.Uuid
  type         String
  date         DateTime @db.Date
  sequence     Int
  quantity     Decimal? @db.Decimal(28, 10)
  unitPrice    Decimal? @db.Decimal(24, 8)
  amount       Decimal? @db.Decimal(24, 8)
  fees         Decimal  @default(0) @db.Decimal(24, 8)
  taxes        Decimal  @default(0) @db.Decimal(24, 8)
  version      Int      @default(1)
  voidedAt     DateTime? @db.Timestamptz(6)
  @@index([userId, instrumentId, date, sequence, id])
}
```

The actual schema must add relationships, ownership checks, event validation, references and indexes described above. Avoid cascade deletion of shared instruments. Account deletion removes user-owned rows and user-scoped observations; shared catalog and authorized shared market prices remain independent of individual portfolios.

## 4. Security and FYERS session

A local proof of concept now connects one configured Kinde owner to an individual FYERS app and displays a raw HINDALCO quote. It uses an encrypted HTTP-only browser cookie, not persistent storage; the broader per-user session design below remains planned. FYERS individual apps are restricted to their creator; multi-user access and provider rights require a separate design.

Kinde and FYERS sessions are separate. Kinde verifies the app user; FYERS [authentication](https://fyers.in/api-docs/v3/api/authentication/individual-app/best-practices/) provides a token for permitted market API calls, even though holdings are not fetched. Tokens expire daily at 6:30 a.m. and may be invalidated earlier. Credential ownership is an open decision: for a personal deployment, configure the app key/secret server-side and obtain an explicitly authorized session; determine whether multiple independent app logins can use it under FYERS's terms. Never silently use one user's FYERS session or market data for another unless authorization and provider terms permit it.

Store an encrypted token and expiry on an appropriately user-scoped record for per-user sessions, or in a server-side secret store if a single-owner deployment is chosen; do not add a separate broker table now. Encrypt with a managed key, bind login callback to a short-lived single-use state and authenticated user, avoid passwords/TOTP storage and redact credentials from logs. Clear token on disconnect. When expired, show last cached data with timestamps and prompt reconnect. Each server action and route verifies session and user ownership, including custom instruments, transactions, CSV and manual prices. Treat server actions as public endpoints per [Next.js guidance](https://nextjs.org/docs/app/guides/authentication). Never authorize using a user ID supplied by the browser.

## 5. Market-data flow

1. User adds or finds a ticker using the synced FYERS instrument master. Refresh the [FYERS symbol master](https://fyers.in/api-docs/v3/getting-started/guides/work-with-historical-market-data) periodically; verify provider symbol mappings and preserve stable internal instrument IDs.
2. On dashboard or details request, load user transactions and cached observations. Return usable cached data quickly; fetch stale/missing quotes and necessary daily history on demand within bounded server execution. Update UI with results; do not require a background worker or WebSocket.
3. Batch quote requests where supported, use conservative bounded concurrency and backoff on 429. FYERS documents [Standard data limits](https://support.fyers.in/portal/en/kb/articles/what-are-the-fyers-api-rate-limits-for-standard-and-prime-plans) of 5 requests/second, 50/minute and 5,000/day; verify current limits and their scope before implementation. In a serverless deployment, per-instance memory is not a global limiter: coordinate across instances using a Postgres transaction/locking mechanism or a managed distributed limiter, with no assumption that a local throttle suffices. Do not keep a database lock open across network calls. If unable to obtain a rate slot quickly, return cache and a retryable state.
4. Upsert only the latest quote and five active baseline values idempotently; do not persist daily FYERS series. Query missing bounded windows and show partial coverage when data is unavailable. Quote falls back to most recent available daily close, clearly dated. If history or token is unavailable, retain prior cache and show unavailable/stale status. No fake prices or interpolation.
5. FYERS Standard currently documents five years of daily history and at most 366 days per request; fetch required windows in bounded chunks and expose missing coverage. Confirm entitlements and current limits before implementation. [Historical API](https://fyers.in/api-docs/v3/api/market-data/historical-data). Verify corporate-action adjustment behavior and historical entitlement with FYERS before production. Split or symbol changes can invalidate return calculations; explicitly report incomplete data when consistency cannot be established.

No automatic freshness is guaranteed while the app is closed. A future scheduled worker can call the same adapter and service if required; Vercel functions should not host a persistent WebSocket.

## 6. Ledger and calculations

Compute holdings from active transactions ordered by date/sequence. FIFO cost allocation is calculated per user and instrument; persist sale-to-buy allocations as described below. Buy fees are included in cost; sale fees and taxes reduce proceeds. Remaining cost = sum of unsold lot costs; value = quantity × applicable price; unrealized P/L = value − remaining cost. Realized P/L = net sale proceeds less allocated cost. Income is shown separately. Use database transactions and a per-user/instrument transaction-scoped lock to serialize edits and imports. Replay all affected events including later sales before commit; reject oversells, including those caused by backdated edits. On concurrency conflicts retry safely. This lock must work with the chosen connection pool and never span a provider call.

Single-lot CAGR = `(endingValue / startingCost)^(365 / elapsedDays) - 1` when inputs and dates are valid. XIRR uses negative purchase cash flows and fees, positive sale proceeds and income, plus current holding value on valuation date. Collapse same-day cash flows; flag invalid, nonconvergent or ambiguous multiple-root cases. Never average XIRRs across assets. Value manual assets only at user-entered as-of values; income and contributions must be entered to compute a meaningful XIRR.

For 7/15/30/60/90 days use calendar days, and for six months/one year calendar arithmetic, in Asia/Kolkata. Baseline is the most recent available observation on or before the target date; return actual dates. Display market price movement separately from personal gain. Personal P/L for a period = ending value − starting value − net contributions + distributions, where net contributions include buys and fees less net sale proceeds. A time-weighted percentage requires valuations at flow boundaries; if insufficient, return unavailable, not a misleading approximation. On dates before first investment use the first transaction date and label the shortened period. Portfolio value charts reconstruct quantities at each point from ledger and price history; mark incomplete when any material position has no price. For manual assets, no values before first observation and no claim of live valuation; label carried-forward values with their as-of date and omit or flag gaps according to the chart's coverage policy.

## 7. Minimal server interfaces

Use server actions for mutations and server-side reads where appropriate; route handlers only where useful for client refresh, CSV download or FYERS callback. All endpoints/actions require authenticated user except the state-verified callback. This is a logical interface, not a mandate to create a route for each line:

- `searchInstruments(query, assetType)` and `listInvestments(assetType)`.
- `getDashboard(range)` and `getInvestmentDetail(instrumentId, range)`: return dated price, P/L, calculation method and coverage; no cross-user data.
- `saveTransaction(input, expectedVersion?)`, `voidTransaction(id, expectedVersion)` and `saveManualValuation(input)`.
- `previewCsv(file)` and `commitCsv(normalizedRows, idempotencyKey)`, plus CSV template download.
- `connectFYERS`, callback and `disconnectFYERS`.

Use Zod validation at boundaries; decimal strings and ISO dates in responses. Error shape `{code, message, fieldErrors?}` with consistent 401, 403/404, 409, 422, 429 and provider-unavailable semantics. Cursor pagination for potentially large lists. All queries are user-scoped server-side.

## 8. CSV without extra tables

A one-off seed of user-provided purchases used portfolio-owned FYERS-verified instruments and transaction source references, with unknown brokerage and tax charges identified in transaction notes. This is not the general import workflow below. The current schema stores numeric zero for missing charges; the UI must disclose the omission and must not treat those amounts as filing-ready. Listed ETFs are currently stored as STOCK instruments with unit `unit` pending a dedicated asset view.

Provide a versioned UTF-8 template with `asset_type,transaction_type,transaction_date,exchange,symbol,asset_name,unit,quantity,unit_price,amount,fees,taxes,currency,external_reference,notes`. Fields are conditional: listed stocks need exchange/symbol; manual assets need name/unit; buys/sells need quantity and price; income/fees need amount. Preview parses, validates and resolves instruments without database writes; display row errors and likely duplicates. Limit bytes and rows. On confirmation, submit normalized rows with an idempotency key. Without an import-batch table, enforce idempotency by storing an import key and source row number on each transaction, with unique `(userId, importKey, sourceRowNumber)`; store a hash of the normalized batch and reject reuse of a key with different contents. For an all-or-nothing import, check the existing rows and batch hash in the same database transaction, serialize requests for that user's import key, lock affected instrument positions in deterministic order, revalidate chronology, and insert all or none. Retrying the same key returns the existing outcome. An external reference also gets a scoped unique constraint. A separate import table is a future option if durable previews, partial commits or richer history become necessary. Escape formula-triggering cells on CSV export.

## 9. UX, operations and verification

The portfolio and transactions views use stored stock transactions. Migration 005 serializes trades by portfolio and applies FIFO; it rejects oversells and backdated insertions preceding a later sale instead of replaying later allocations. Fees, edit/void, idempotency, full concurrency tests and tax reporting remain pending. FYERS quotes and selected historical closes are wired up for the configured owner; full historical portfolio charts remain unsupported. Portfolio and transaction pagination and sorting run on the server with 20 rows per page. Ticker details load only that ticker’s transactions; dashboard history is calculated from the full server-side ledger and sent as compact chart points. Cached quotes render first and refresh asynchronously after hydration. Mutual funds and debt remain empty states.

Dashboard and tabbed investments show values, cost, P/L and freshness; detail shows individual transactions, chart, requested ranges, CAGR/XIRR and calculation explanations. Debt & Other holds manual EPF, FD and debt entries. Provide responsive layout, keyboard interaction, text alternatives, reduced motion and explicit no-data, stale, loading and reconnect states. Display a manual valuation's date prominently.

Deploy on Vercel with a Marketplace Postgres provider, isolated production/preview databases, Kinde and FYERS credentials, pooled application connections and direct migration connection as needed. Run reviewed versioned migrations as a controlled deployment step; use versioned expand/contract migrations. Use a secrets manager, backups and restoration drills; log request IDs and error categories, not tokens or transaction payloads. Keep all business logic provider-independent for migration off Vercel.

Test unit fixtures for FIFO partial sales, fees, XIRR edge cases, cash-flow-adjusted periods and calendar boundaries. Integration tests cover two-user isolation, custom instrument access, concurrent oversells, import rollback/idempotency, manual valuation scope, token expiry and 429 behavior. E2E covers sign-in, manual purchase, CSV import, ticker lookup, detail periods and stale data. Validate charts and returns against independently calculated fixtures and exercise accessible mobile flows. Test backup restoration and provider error recovery before release.

## 10. Open decisions

- FYERS key/session arrangement for multiple independent Kinde users, price-sharing rights, costs and historical-data entitlement.
- Corporate-action and symbol-change behavior in the selected FYERS data series.
- Exact representation of EPF and fixed deposit contributions versus a whole-account valuation; support correct XIRR without treating deposits as extra account units.
- Cache TTL, historical depth, import limits and refresh behavior after a small-scale provider proof of concept.
- Whether fuller transaction revision history is required; the lean model only retains current version, timestamps and void status.


## 11. Sold lots and tax reporting extension

### Persistence and transaction contract

Extend the existing minimal `sale_allocations` table with the planned fields: `id`, `userId`, `instrumentId`, `saleTransactionId`, `buyTransactionId`, `quantity`, `buyDate`, `saleDate`, `buyUnitPrice`, `saleUnitPrice`, allocated acquisition charges and sale charges (itemized where relevant), `investmentCost`, `netProceeds`, `realizedInvestmentPnl`, optional `taxCost`, `taxableGain`, `taxClassification`, `reviewStatus`, `calculationVersion`, `createdAt`, `updatedAt`. Monetary values use the same decimal precision as the ledger. Buy and sell foreign keys reference user-owned active events; unique `(saleTransactionId,buyTransactionId)`; index `(userId,saleDate,id)` and `(userId,instrumentId,saleDate)`. Persist these as a rebuildable projection of the canonical BUY/SELL ledger, with a version, not an independent source of truth. CAGR/XIRR are calculated from matched lot cash flows and returned in the view (optionally cached with calculation version), unavailable for zero-day/invalid inputs; they are investment metrics, not tax figures. If dividends or other cash flows are not reliably attributable to a sold lot, label lot XIRR as excluding them and expose that limitation. Financial P/L and taxable gain are separate values.

For a sell: authorize user, lock affected user/instrument/tax-pool key, replay buys and sells in chronological order, reject oversell, insert SELL and allocation rows, update or recompute affected later allocations, and commit atomically. Readers see either the old or new complete state; refresh/invalidate holdings and Sold view after commit and retrieve on reload. Multiple purchases matched to one sale yield multiple allocation rows. Corrections to backdated buys/sells and voids trigger a complete replay from the affected point in the same transaction for bounded personal data; reject corrections that invalidate a later sale. Test concurrent sells, retries, pagination and deterministic ordering. Add an optional `taxLotPool` string to transactions (default UNKNOWN); FIFO for tax is per demat account, and a shared unknown pool cannot guarantee legal matching across multiple demat accounts. Require an explicit pool for tax-ready classification; portfolio-level aggregate can remain broker-independent. Confirm whether the user actually holds a ticker in multiple demat accounts. [Statutory FIFO provision](https://www.incometaxindia.gov.in/w/section-45-55).

### Tax data and classification

Capture separate acquisition and sale brokerage, other eligible charges, and STT rather than a single opaque fee; STT is not deductible for capital-gains computation. Store trade/contract dates, ISIN, instrument type, exchange, transaction reference, STT applicability, acquisition and disposal quantities and dates, and optional 31 January 2018 FMV and source for potentially grandfathered 112A assets. Treat grandfathering, transfers, splits, bonus issues, inherited assets, non-resident rules and incomplete cost histories as review-required unless explicitly implemented and verified. Source values come from user records, not FYERS. Do not silently classify a trade merely from ticker: STT applicability and asset eligibility must be supplied/confirmed. Use assessment-year-versioned rules and effective dates for holding period, classification, grandfathering and tax-category mapping, with test fixtures and citations. Never reuse one year's ITR form mapping for another without checking the notified form. Where inputs/rules are missing, set tax values and classification to unavailable/review required; do not output an authoritative filing amount. Annual tax cost and gains can differ from financial P/L. See [Income Tax Department guidance](https://www.incometaxindia.gov.in/en/sale-of-shares).

### Reporting contract

A financial year runs 1 April–31 March and is followed by its assessment year. The notified AY 2026–27 form has five Schedule CG accrual windows: 1 Apr–15 Jun; 16 Jun–15 Sep; 16 Sep–15 Dec; 16 Dec–15 Mar; 16 Mar–31 Mar (inclusive). Map by actual sale date in local Indian calendar; store dates, not hard-coded quarter numbers. Boundary-test both days around every cutoff, leap years and FY change. Use a configurable, versioned reporting definition. [Notified form](https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-04/Notification%20No.48_2026.pdf). For FY 2026–27 / AY 2027–28, do not assume the future form is identical: show provisional grouping pending its notification.

Sold view offers FY selection, grouped chronological sales, expandable matched lots, totals and cursor pagination. Annual report includes proceeds, financial and supported tax costs/gains, STCG/LTCG category when verified, losses, review counts, actual dates and per-period breakdown, with CSV export. Schedule CG accrual lines may require values after current-year and brought-forward loss adjustments, and other information outside this app; raw period totals are NOT a substitute for those entries. Support explicit reconciliation with broker tax P&L, contract notes and applicable ITR instructions; label report as preparation data rather than filing-ready until those adjustments are modeled. Do not claim this produces final tax, advance-tax liability, ITR form choice or a ready-to-file return; additional income, losses, exemptions, credits and taxpayer status affect them. The ITR-2 manual describes [Schedule CG and 112A](https://www.incometax.gov.in/iec/foportal/help/FileITR-2Online), and its [AY 2026–27 FAQ](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/itr-2/itr-2-faqs?mobile-app=1) confirms forms can change annually.
