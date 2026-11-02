# Personal Portfolio Tracker — Product Plan

Updated 2 November 2026. This plan replaces the earlier household and brokerage-account design. Each Kinde login has its own independent portfolio. Multiple credentials mean multiple isolated user portfolios; there is no family aggregation, invitation or shared account.

## Product scope

Build a premium, responsive Next.js application for recording an individual's investments and viewing performance. Users manually add completed purchases and sales or import them from a CSV template. The app uses Kite for market data by ticker, not to retrieve brokerage holdings or place orders. It fetches prices when the app is opened or a view is refreshed, subject to caching, Kite authentication and rate limits. If today's price is unavailable, show the most recent available prior close, labeled with its date; never present stale data as live.

Navigation: Dashboard, Investments, Transactions and Settings. Investments has Stocks, Mutual Funds, Gold, and Debt & Other tabs. The latter includes EPF, fixed deposits and other debt, with manually entered values and cash flows. Mutual funds and physical gold also support manual valuation; automatic NAV or gold price sources are future additions. Listed ETFs may use Kite where supported.

## Experience

- Dashboard: total value, invested cost, unrealized profit/loss, realized gain where available, allocation, recent activity, and a portfolio value/P&L chart when sufficient history exists. Label incomplete valuations and freshness. Show useful empty states and an Add investment action.
- Investments: searchable asset tabs with name, units, average buy price, earliest buy date, invested cost, latest value and unrealized P/L percentage. Show manual valuation date for assets without automatic prices. Allow filtering and sorting.
- Details: price and personal P/L history, 7, 15, 30, 60, 90 days, 6 months, 1 year and since investment; purchases and sales in chronological order; remaining cost, realized/unrealized P/L, per-lot CAGR and investment-level XIRR where calculable. Clearly distinguish market price movement from the user's cash-flow-adjusted return. Show actual observation dates and unavailable reasons.
- Transactions: add, edit or void executed buys, sells, income and fees. Validate quantities and dates; keep a single user's history separate from every other user.
- Settings: Kinde identity, Kite connection and reconnect status, CSV download/import, data export and account deletion. A single Kite application may be used with an authorized Kite session; exact credential setup and rights must be verified before implementation. Each user's portfolio is independent of brokerage accounts.
- Use accessible controls, keyboard navigation, chart alternatives, responsive layouts, reduced-motion support and understated animation.

## Market data and calculations

Kite's [Node SDK](https://github.com/zerodha/kiteconnectjs) runs on the server. Kinde application login and [Kite authorization](https://kite.trade/docs/connect/v3/user/) are separate; Kite access tokens ordinarily expire the following morning. An expired session must prompt reconnect, and cached prices remain labeled. Do not promise daily automatic refresh. Batch requests and respect [Kite rate limits](https://kite.trade/docs/connect/v3/exceptions/). Refresh Kite's [instrument catalog](https://kite.trade/docs/connect/v3/market-quotes/) periodically instead of treating the initial dump as permanent; use exchange and trading symbol for lookup rather than assuming token stability. Maintain a small shared cache of price observations subject to Kite's data-use terms. No WebSocket is needed.

Use daily candles for historical chart and calendar-based ranges, and an LTP quote when available. Choose the most recent available close on or before the target date for baselines; show its date. Fetch missing historical windows when a position is opened, cache results, and do not claim availability beyond provider coverage. Verify how Kite handles corporate actions and historical price adjustments before combining series; show an explicit limitation when uncertain.

For stocks, remaining cost follows FIFO per investment; current value is remaining units times latest price, and unrealized P/L is current value minus remaining cost. Sales include fees and allocated costs; income remains separate. XIRR uses dated buys, sales, income, fees and current value; report unavailable if no valid solution. Single-purchase CAGR uses initial cost, terminal value and elapsed days; do not use a single-purchase CAGR formula for multiple contributions. Price change is distinct from investor return. Calculate period profit accounting for cash flows; show time-weighted return only when sufficient prices exist for flow dates. Missing history, new positions, non-trading days and stale manual valuations must not generate invented numbers. Use decimal arithmetic and store dates consistently in Asia/Kolkata for market boundaries.

For EPF, fixed deposits and other manual assets, user supplies current value and its as-of date, plus transaction cash flows as available. Calculate gains and XIRR only from provided data; do not estimate accrued interest or pretend the manual valuation is current. Historical charts show only supported dated values, with gaps labeled. The same fallback applies to manual mutual funds and physical gold.

## CSV import

Offer a versioned downloadable UTF-8 CSV with a header, example rows and instructions. One row per event: asset type, transaction type, date, exchange and ticker for listed assets or name and unit for manual assets, quantity, unit price, fees/taxes, currency and optional external reference. Conditional amount fields cover income and fees. ISO dates, decimal values and INR by default. Preview and validate every row, flag unknown tickers and duplicates, and allow correction before an explicit atomic import. Store import provenance on transactions; use a user-provided reference for duplicate detection when present. No data changes on preview.

## Technical direction and scope

Use Next.js App Router, TypeScript, Kinde, Prisma ORM and managed PostgreSQL on Vercel, with lucide-react for icons; isolate Kite behind a server-side adapter. Five core tables: `users`, `instruments`, `transactions`, `price_observations`, and `sale_allocations` for sold purchase lots. Manual valuations are price observations linked to the relevant user; market observations are provider data and may only be shared under appropriate Kite terms. Derived holdings and returns are computed from transactions and observations. Start with on-demand fetch and caching, not a job system, brokerage-account model or portfolio snapshots. Design interfaces so an external worker or separate price provider can be added later if usage warrants it. See [technical specification](../docs/technical-specification.md) for ownership, lifecycle, integrity and performance details.

## Implementation sequence

1. Verify Kite credentials, historical entitlement, data-sharing rights, rate limits and corporate-action behavior using a small authorized sample.
2. Bootstrap Next.js, Prisma, Postgres and Kinde; enforce per-user isolation.
3. Add manual investments and transactions, then compute positions and FIFO sales.
4. Connect Kite and sync searchable stock instruments; fetch cached quote/history on demand and handle expiry.
5. Build holdings, detail charts and financial calculations, then dashboard aggregates.
6. Add downloadable CSV and validated atomic import.
7. Complete manual mutual fund, gold, debt and other asset workflows; test accessibility, security, deployment and recovery.

## Open decisions

- Whether all app users will use the same Kite application credentials or supply their own; either way, a valid authorized session and licensing must be established. Do not assume Kinde login grants Kite access.
- Historical data entitlement, API costs, adjustment behavior and rights to share cached price observations need verification with Kite before release.
- Which fields are required for manual EPF, fixed deposits and gold beyond dated contributions and valuations; begin with generic entries and add optional metadata later.
- Expected historical depth, cache freshness and data-retention budgets remain to be set after a Kite proof of concept.

## Sold investments and Indian tax reporting

A sale creates a SELL transaction and one or more persisted `sale_allocations` in the same database transaction. Each allocation records the matched buy and sell dates, quantities, prices, charges, realized investment P/L, and derived CAGR/XIRR when meaningful. A sale spanning multiple purchases produces multiple lot rows. It reduces the remaining holding, never deletes purchase history. Sale records are visible immediately and on reload under Transactions → Sold, ordered by sale date with pagination, FY filter and expandable lot breakdown. Edits or voids replay subsequent sales and update allocations atomically; users see an explanation if their correction would create an oversell.

Add a Tax report view with financial-year selector (1 April–31 March), assessment year, yearly gross proceeds, costs, realized gains/losses and classifications where supported. Group sales using the relevant assessment year's notified ITR capital-gain accrual periods, not ordinary calendar quarters. The AY 2026–27 notified form uses 1 April–15 June, 16 June–15 September, 16 September–15 December, 16 December–15 March, and 16–31 March. These are five reporting periods, not four tax quarters. Display raw positive and negative gains separately, with classification, and never label them as the final values to enter after loss adjustments. [Notified ITR form](https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-04/Notification%20No.48_2026.pdf).

For applicable taxpayers, advance-tax instalments have cumulative deadlines of 15 June, 15 September, 15 December and 15 March; their payment amounts and capital-gain exceptions depend on the taxpayer's full circumstances. The app is a filing preparation aid, not an automatic tax liability calculator or ITR submission system. It should offer an export of dated lot details and annual/period totals with clear coverage and verification warnings. Tax treatment, rates, loss setoff, STT, grandfathering and form fields depend on asset, date and assessment year; unsupported cases must be marked for review, not guessed. Demat FIFO legally applies within the relevant demat account, so ask for an optional tax-lot pool identifier if the same ticker is held in multiple demat accounts; without it, flag tax FIFO as unverified. Do not introduce a full brokerage-account model. [Income Tax Department on FIFO and STT](https://www.incometaxindia.gov.in/en/sale-of-shares).
