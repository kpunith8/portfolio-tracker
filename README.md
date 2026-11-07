# Portfolio Tracker

A personal investment tracker built with Next.js, Kinde, Neon PostgreSQL and FYERS. It records user-owned stock purchases and FIFO sales, shows holdings and transactions, and displays dated market prices and portfolio history. FYERS supplies market data; it does not synchronize broker holdings or place orders.

## Setup

Use a Node.js version supported by the installed Next.js release. Create a private `.env.local` with the variables below, configure the corresponding provider applications, then run `npm ci` and `npm run dev`. Open [localhost:3000](http://localhost:3000). Never commit credentials or tokens.

### Kinde

Create a Kinde backend web application and set:

- `KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_ISSUER_URL`: application credentials and issuer.
- `KINDE_SITE_URL`, `KINDE_POST_LOGOUT_REDIRECT_URL`: `http://localhost:3000` locally.
- `KINDE_POST_LOGIN_REDIRECT_URL`: `http://localhost:3000/dashboard` locally.

Allow `http://localhost:3000/api/auth/kinde_callback` as a callback and `http://localhost:3000` as a logout URL in Kinde. Configure matching HTTPS URLs for production. See the [Kinde Next.js SDK documentation](https://docs.kinde.com/developer-tools/sdks/backend/nextjs-sdk/).

### Neon

Set `DATABASE_URL` to a private Neon PostgreSQL connection string. Use separate databases or branches for development, preview and production. Run versioned migrations explicitly and in order against the intended database: `npm run db:migrate:001` through `npm run db:migrate:010`. Migration 001 predates the migration ledger and fails if its table already exists; inspect existing schema and back up data before migrating. Never run migrations automatically at startup or build time.

The server uses the Neon serverless driver and application-level user scoping, not database row-level security; restrict database credentials and assess additional isolation before broad multi-user use. The database storage budget is 1 GB, including indexes and user data.

### FYERS

The configured Kinde owner can connect an individual FYERS app with Market Data permission in **Settings**. Set these server-only variables:

- `FYERS_APP_ID` and `FYERS_SECRET_ID`: FYERS application credentials.
- `FYERS_REDIRECT_URI`: the exact registered callback, for example `http://localhost:3000/api/fyers/callback` if accepted by FYERS; use HTTPS in production.
- `FYERS_OWNER_KINDE_ID`: the owner's Kinde user ID; only this user can connect and use FYERS market data.
- `FYERS_SESSION_SECRET`: a unique random secret of at least 32 characters; generate one with `openssl rand -hex 32`.

Restart the server after changing variables, sign in as the owner and select **Connect FYERS**. FYERS and Kinde sessions are separate; FYERS tokens expire daily at 6:30 a.m. and may expire earlier. Reconnect in Settings when required. The encrypted, HTTP-only cookie is bound to the Kinde user; tokens are not stored in the database. Confirm provider entitlements and data-use rights before extending access to other users.

## Usage and limitations

- Record stock purchases and FIFO sales; holdings and transaction lists use stored transactions, with server-side sorting and 20-row pagination. ETFs from the existing import appear under Stocks.
- Purchase deletion is permanent and requires confirmation; it is blocked when a sale exists on or after the purchase date. Oversells and trades dated before a later sale are rejected because sale-allocation replay is not implemented.
- The dashboard plots reconstructed holdings at available daily closes; investment details show dated value history, purchase-level CAGR and investment XIRR when supported. Purchases and sales affect value charts, so they are not return charts; XIRR is unavailable for ambiguous or unsupported cash flows.
- Missing or outdated prices are labeled or shown as unavailable; historical coverage can be incomplete and FYERS corporate-action adjustments may not match recorded quantities or older cached prices.
- Brokerage, taxes, edits, duplicate-submission protection, general CSV import, tax reports, mutual funds and debt workflows remain incomplete. Existing seeded purchases with unknown brokerage or taxes disclose the omission; figures are not filing-ready.
- The owner's **Live Market** view streams up to 100 symbols and falls back to dated quotes; 1D movement uses current holdings and previous close, not cash-flow-adjusted return. Missing required prices or previous closes make affected totals unavailable.

## Freshness and operations

- The dashboard's full ledger is cached per authenticated user for 60 seconds; in-app trades immediately invalidate that user's cache, while out-of-band changes may remain stale until revalidation. Portfolio, transaction and detail pages use direct scoped queries.
- Neon stores one current FYERS quote per ticker and portfolio; stale or missing quotes trigger a background refresh after five minutes, in batches of up to 50. Failure retains the dated quote, and the FYERS-reported date does not guarantee the time of the last exchange trade.
- Ticker details use five baseline periods (7, 30 and 90 days, six months and one year), reusing successful checks from the current India date; up to seven baseline rows are permitted, including legacy periods.
- Dashboard daily closes and completed coverage are stored separately. Background backfill requests bounded ranges under a lease; missing coverage, partial data and unavailable dates can leave gaps. `no_data` is retried after 24 hours; historical closes are not overwritten. An unambiguous exact ISIN match can provide labeled BSE fallback for missing NSE history. Public holidays may be retried because there is no exchange holiday calendar, and older coverage has not been automatically repaired.
- FYERS HTTP requests use `no-store`; a shared database limiter reserves one slot per two seconds, caps the app at 4,000 requests per India day and pauses for at least 60 seconds after a 429. No application-managed portfolio data is persisted in browser storage.
- Live Market uses an on-demand server worker and a transient stream; sharing is process-local, so separate server instances can compete for sockets. In Vercel production, streams rotate after at most 270 seconds and failures retry with backoff; local development and previews do not automatically rotate or retry failures. Vercel system environment variables must be exposed for production detection. Verify production streaming and rotation during market hours after deployment.

See the [technical specification](docs/technical-specification.md) for architecture and data invariants, and [product plan](docs/plan.md) for remaining work.

## Development commands

| Command                                                                                 | Purpose                                                                          |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev` / `npm run build` / `npm run start`                                       | Develop, build, or serve the production build                                    |
| `npm run lint` / `npm run format:check` / `npm run typecheck`                           | Check lint, formatting and types                                                 |
| `npm run test:unit` / `npm run test:server`                                             | Run domain and server tests (server tests require Node.js 22.15+)                |
| `npm run test:db-schema` / `npm run test:db-ledger` / `npm run test:db-delete-purchase` | Run database tests against an isolated development database                      |
| `npm run test:e2e`                                                                      | Run Playwright tests; browser tests and CI authentication are not yet configured |

ESLint enforces blank lines around functions, types, exports and statement groups while keeping related variable declarations together; `npm run lint:fix` applies the spacing rules. Staged source files are linted and formatted by Git hooks; GitHub Actions checks lint, formatting, types and build. Keep documentation and task status current when behavior or setup changes.
