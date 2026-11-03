# Portfolio Tracker

A personal investment tracker for recording purchases and sales and understanding portfolio performance. Each user's portfolio is intended to be independent. The current application includes a Next.js landing page, basic Kinde authentication, and a protected stock portfolio with manual purchase and sale entry.

## Getting started

Install a Node.js version supported by the Next.js version in `package-lock.json`, then run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Kinde authentication

Create a Kinde backend web application. Create `.env.local` with `KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_ISSUER_URL`, `KINDE_SITE_URL`, `KINDE_POST_LOGOUT_REDIRECT_URL`, and `KINDE_POST_LOGIN_REDIRECT_URL`; keep the file private. For local development, use `http://localhost:3000` as the site and logout URL and `http://localhost:3000/dashboard` as the post-login URL. In Kinde, add `http://localhost:3000/api/auth/kinde_callback` to the allowed callback URLs and `http://localhost:3000` to the allowed logout redirect URLs. Configure the corresponding production URLs when deploying. Sign in or register from the landing page to reach the protected `/dashboard`. The portfolio displays user-scoped stored transactions and, when FYERS is connected, the latest available dated prices. Kinde credentials and allowed URLs must match the local origin.

See the [Kinde App Router starter](https://github.com/kinde-starter-kits/kinde-nextjs-app-router-starter-kit) and [SDK documentation](https://docs.kinde.com/developer-tools/sdks/backend/nextjs-sdk/) for setup and configuration.

## Commands

```sh
npm run dev        # Start the development server
npm run build      # Create a production build
npm run start      # Serve a production build
npm run lint       # Run ESLint
npm run format     # Format source files
npm run format:check # Check source formatting
npm run typecheck  # Check TypeScript types
npm run test:e2e   # Run Playwright tests once they are added
```

ESLint and Prettier run on staged source files before each commit. GitHub Actions checks both on pushes and pull requests. Install dependencies with `npm ci` to set up the Git hook.

## Project layout

- `src/app/` — App Router pages, Kinde routes, and styles.
- `src/components/dashboard/` — dashboard components, including the Recharts performance chart.
- `src/server/portfolio/` and `src/components/investments/` — user-scoped ledger reads and portfolio views.
- `.github/workflows/ci.yml` — lint, formatting, type, and build checks; future Playwright job.
- `docs/technical-specification.md` — proposed architecture, data model, and calculation rules.
- `tasks/plan.md` — product scope and implementation plan.
- `tasks/todo.md` — incremental delivery checklist.

## Planned direction

The app supports manual NSE stock purchases and FIFO sales for a Kinde user with a portfolio. Holdings and the transaction list use stored entries. Dashboard and portfolio views render cached prices first, then refresh FYERS quotes in the background when the owner is connected; investment details fetch five dated baseline closes on demand. The dashboard chart shows remaining purchase cost on historical transaction dates as an estimate and uses the latest available FYERS quotes for its final point, falling back to cost when a quote is missing or predates the latest trade. The curve is illustrative and does not represent historical market values or investment returns. Dashboard history and summary transaction reads are cached per authenticated user with a 60-second revalidation interval and invalidated immediately by in-app trades; out-of-band changes may remain stale until revalidation completes. The details chart values the shares held at each selected historical close, so purchases and sales affect the chart; per-purchase CAGR uses remaining shares and investment XIRR uses recorded dated cash flows and the latest quote. XIRR is unavailable for multiple cash-flow sign changes or unsupported roots. Current holding values and P/L show unavailable when a quote is missing or predates the latest trade; quote refresh continues across batches of up to 50 symbols; portfolio and transaction sorting and 20-item pagination run on the server; ticker details load only that ticker’s transactions. The dashboard reads the full ledger on the server for its history chart, but sends only summaries and chart points to the browser. Tax report, CSV import, mutual funds, and debt remain planned. Sales preserve their purchase and sale records; the expanded view hides fully sold lots. Trades preceding a later sale are rejected until replay is implemented. Brokerage, taxes, transaction editing and duplicate submission protection are not supported yet; do not rely on the figures for tax filing.

The planned deployment target is Vercel with managed PostgreSQL, while keeping application logic portable. Never commit credentials or local environment files.

## Caching and freshness

The application currently uses two different caches, both scoped to the authenticated portfolio. Transactions are authoritative user data; cached copies and market prices are derived data.

- **Dashboard ledger — Next.js Data Cache.** The dashboard’s full transaction query uses `unstable_cache` in `src/server/portfolio/ledger.ts`. The authenticated Kinde subject is passed into the cached function and the cache key/tag includes a hash of that subject, preventing one user’s cached result from being reused for another. The revalidation interval is 60 seconds, not a promise that data refreshes exactly every minute: a later request may receive a stale result while revalidation occurs. A successful in-app trade calls `updateTag` for that user and `revalidatePath` so the next read sees the write. Database edits made outside the app do not invalidate the tag and may stay stale until revalidation completes. The portfolio and transaction list pages query their 20-item pages directly; ticker details query that ticker’s transactions directly. The dashboard still reads the full ledger on the server to build its summaries and estimated chart, sending only the resulting summaries and chart points to the browser. Cache persistence and sharing depend on the Next.js deployment environment; this code does not configure Redis or another shared cache service.
- **Latest FYERS quotes — Neon PostgreSQL.** Parsed prices, FYERS-reported dates and retrieval times are stored in portfolio-owned `price_observations` rows, with one current FYERS quote per ticker and portfolio. The dashboard and portfolio first show the stored values, then request a background refresh for held tickers whose quotes are missing or at least five minutes old. Five minutes is a freshness threshold for attempting an update, not an expiry: a cached quote remains in the database and can be shown with its date when FYERS is unavailable or the session has expired. At most 50 stale symbols are sent in one quote request; if more are stale, a later refresh is needed for the rest. The displayed FYERS date is provider-reported and does not guarantee the time of the last exchange trade.
- **Historical closes — Neon PostgreSQL.** `ticker_period_baselines` keeps one replaceable close per portfolio, ticker and period, including the requested and actual market dates. Ticker details currently use 7, 30 and 90 days, six months and 365 days. An available baseline already checked for the current Asia/Kolkata date is reused; otherwise the app attempts to refresh that period when details open. A successful refresh replaces the row; a failed refresh leaves the prior dated value in place. The schema permits seven periods, so earlier 15- and 60-day rows may still exist, but the UI no longer refreshes them. The current refresh flow does not persist full daily candle series; older observations that predate the compact-cache migration are preserved. This keeps new storage aligned with the 1 GB database budget.

FYERS HTTP requests use `cache: "no-store"`; the market-data cache described above is the parsed data stored in Neon, not an HTTP response cache. The shared `fyers_rate_limits` table coordinates requests by FYERS app across server instances: one reserved slot every two seconds, an app-side limit of 4,000 requests per India calendar day, and a pause of at least 60 seconds after HTTP 429. This table is rate-limit state, not a price cache. A refresh can be throttled or fail, so neither the five-minute threshold nor same-day baseline reuse guarantees fresh data. Browser component memoization and in-flight request deduplication are temporary UI optimizations; there is no application-managed persistent browser cache for portfolio data. Next.js may also keep navigation data in its framework-managed client router cache.

The FYERS session token is stored in an encrypted, HTTP-only, user-bound cookie; it is not a database cache entry. Only the configured owner can use that session. Preserve user scoping, trade-triggered invalidation, dated stale fallbacks and the storage limit when changing cache behavior. See `src/server/portfolio/ledger.ts`, `src/server/market-data/fyers.ts`, `src/server/market-data/history.ts`, and `src/app/dashboard/trade-actions.ts` for the implementation.

## Continuous integration and browser tests

GitHub Actions runs lint, formatting, TypeScript, and production build checks. Playwright is configured for Chromium, but its CI job remains disabled until browser tests and test authentication are added. To run future tests locally, install the browser once with `npx playwright install chromium`, add tests under `tests/e2e/`, and run `npm run test:e2e`. The CI build uses non-production Kinde placeholder values when repository secrets are absent.

## Keeping documentation current

When changing a feature, setup, behavior, architecture, or development workflow, update the relevant documentation in the same change. Record reproducible gotchas and limitations without secrets. Use `AGENTS.md` for contributor guidance, this README for current setup and implemented behavior, and `docs/technical-specification.md` / `tasks/` for architecture and delivery status. The pull request template prompts this review; it does not automatically determine whether documentation is accurate.

## FYERS quote proof of concept

The Settings screen provides the individual FYERS connection flow for the configured owner. The portfolio uses this connection to refresh batched quotes and selected historical closes. The FYERS app must have Market Data permission. Configure these server-only values in `.env.local`:

- `FYERS_APP_ID` and `FYERS_SECRET_ID`: the individual FYERS app credentials.
- `FYERS_REDIRECT_URI`: the exact redirect URI registered with FYERS, for example `http://localhost:3000/api/fyers/callback` for local use, if FYERS accepts it.
- `FYERS_OWNER_KINDE_ID`: the Kinde user ID of the app owner, available in the Kinde user administration screen. Only this user can connect and view the quote.
- `FYERS_SESSION_SECRET`: a unique random secret of at least 32 characters, used to encrypt the short-lived browser session cookie. Generate it locally with `openssl rand -hex 32` and keep it private.

Restart the development server after changing environment values. Sign in as the configured owner and select **Connect FYERS** in Settings; complete FYERS login and consent there. FYERS tokens expire daily at 6:30 a.m.; reconnect when the quote becomes unavailable. FYERS access is separate from the portfolio ledger. The cookie is encrypted, HTTP-only and bound to the Kinde user; the token is not stored in the database. Parsed quotes and selected historical closes are stored in the user’s Neon portfolio cache. This initial setup is intended for a personal deployment; confirm provider rights and use a production HTTPS redirect before deployment. Never commit credentials or tokens.

## Neon database foundation

Set `DATABASE_URL` to a Neon Postgres connection string in `.env.local` and use separate development, preview, and production databases or branches. Keep connection strings private and configure them in the hosting environment as server-only variables. The server uses `@neondatabase/serverless`; no database credentials are sent to the browser.

The first versioned SQL migration creates one `portfolios` row per Kinde subject, with unique ownership. On a new, intended database, run `npm run db:migrate:001` once. This is an explicit schema change: check the target database first, back up existing data as appropriate, and do not run it during application startup or builds. The migration deliberately fails if the table already exists; inspect the existing schema before making changes. Migration 001 predates the migration ledger; later migrations record their versions in `schema_migrations`.

After migration 001, a signed-in user can create a portfolio identity on the dashboard. Later migrations add instruments, transactions and the market-data cache described below. A missing connection or migration is shown as unavailable. User-specific reads and creation derive the owner from the authenticated Kinde session. This application-level ownership check is not database row-level security; use restricted database credentials and add further isolation controls before broad multi-user use.

Migration 002 adds portfolio-owned instruments, transactions, observations, six-period baselines and sale allocations. Run `npm run db:migrate:002` against the intended database after migration 001; it uses a database advisory lock and records its version in `schema_migrations`. Migration 001 predates that ledger and is not automatically recorded. `npm run test:db-schema` tests ownership foreign keys and checks with temporary rows in an atomic database block; run it on an isolated development database. Investment entry and the FYERS market-data cache use these tables after the subsequent migrations.

Migration 003 changes the market-data cache to at most six replaceable period baseline rows and one FYERS quote per portfolio and ticker. It does not delete existing observations or manual valuations. Run `npm run db:migrate:003` after migration 002; check the target database first. Daily FYERS series are not to be stored. After migration 004 the schema permits seven periods; the app refreshes five on demand (7, 30, 90, 6 months and 365 days), leaving any existing 15- and 60-day cache rows untouched; the database constraints alone do not call FYERS. Storage is budgeted at 1 GB; monitor total database use, including indexes and user data.


Migration 004 adds the 15-day period; migration 005 installs the atomic trade function. Apply `npm run db:migrate:004` followed by `npm run db:migrate:005` on a database with migrations 001–003 already applied. `npm run test:db-ledger` runs temporary transactional tests; use an isolated development database. The trade function serializes per portfolio, validates ownership, rejects oversells, and allocates sales FIFO. The lot-specific sale form rejects a newer lot while an older lot remains open. Backdated inserts before a later sale require replay and are currently rejected. Edit/void, idempotency, charges and general CSV import are incomplete.

## Interface styles

The landing page and portfolio screens share a muted green palette, readable secondary text, and visible keyboard-focus states. Form fields and the portfolio sort selector use the same bordered control treatment; the sort menu supports keyboard navigation, visible focus and assistive-technology labels. Keep text contrast and mobile dialog actions in mind when extending these screens.

A one-off purchase seed can contain exchange-traded funds alongside stocks; they appear in the Stocks tab until a dedicated ETF view exists. For imported purchases that did not provide brokerage or taxes, the transaction source note records that those charges are missing, and portfolio costs exclude them. This one-off seed does not implement the planned general CSV import workflow.

Migration 006 adds a shared FYERS rate-limit record and whole-share guard for new stock trades. Apply it with `npm run db:migrate:006` after migration 005. The server batches at most 50 stale quotes, considers a cached quote stale after five minutes, and permits a shared request slot every two seconds with a 4,000-request daily cap; 429 responses pause requests for at least one minute. Only the configured owner’s FYERS session is used. Investment details request short windows for 7, 30, 90, six months and 365 days, retaining only one dated close per period. The UI displays the FYERS-reported quote date; these are not a guarantee of exchange trade time. If the session expires or data is unavailable, cached values remain dated and missing values stay unavailable. A full historical market-value chart is not supported by five sparse baselines; the dashboard’s portfolio-history chart uses purchase-cost estimates and latest available quotes. Corporate-action adjustment behavior remains unverified.
