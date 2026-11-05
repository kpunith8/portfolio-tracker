# Repository guidance

## Context

This is an early personal portfolio tracker built with Next.js App Router, TypeScript, React, and lucide-react. The landing page, basic Kinde authentication, and authenticated portfolio and transaction views with basic manual stock buys and FIFO sales are implemented; batched FYERS quote and five-period historical refresh are implemented for the configured owner; other dashboard sections remain planned. Read `docs/technical-specification.md`, `tasks/plan.md`, and the relevant items in `tasks/todo.md` before implementing portfolio functionality; these documents describe intended behavior, not functionality that already exists. When requirements change, update the affected documents.

Each authenticated user will have an independent portfolio. Transactions are entered manually or imported; FYERS is used as a market-data provider, not as a source of broker holdings or order execution. Non-market assets such as EPF and fixed deposits use user-provided valuations. Do not introduce household management, broker-account synchronization, or live WebSockets without a requirement.

## Development

- Install dependencies with `npm ci`; run locally with `npm run dev`.
- Verify relevant changes with `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run build`; run `npm run test:unit` and `npm run test:server` when their code is affected. Add focused tests when implementing financial logic, security, or other nontrivial behavior.
- Keep changes incremental and consistent with the existing TypeScript and App Router structure. Add dependencies when a feature needs them, and update the lockfile.
- Use `lucide-react` for icons. Keep interfaces responsive and keyboard accessible, provide accessible names for icon-only controls, and respect reduced-motion preferences. Example data must be clearly labeled.
- Keep secrets and local environment files out of Git. Integrations and database access belong on the server; validate inputs and authorize every user-scoped read and mutation.

## Refactoring and architecture

- Apply DRY, loose coupling, maintainable interfaces, and testability when implementing features and fixing bugs as well as during refactoring. First inspect related code across the repository for existing components, workflows, query functions, and helpers to reuse or improve; a referenced file is context, not an automatic limit on that review.
- Extract genuinely shared behavior into focused, composable components, hooks, or helpers with names that describe their responsibility (for example, price or portfolio utilities). Keep presentation, domain rules, data access, and provider concerns separated where this makes them easier to evolve and test. Prefer extending existing interfaces compatibly; avoid speculative abstractions, forced deduplication, and unnecessary complexity.
- While making a feature or bug fix, address related duplication and coupling where doing so is useful and safe within the task. Preserve existing behavior outside the requested change and keep changes incremental and reviewable; if a broader refactor is unsafe or unrelated, document the opportunity rather than silently expanding scope.
- Treat refactoring requests as repository-wide reviews unless the user explicitly limits their scope; a tagged file is an example, not an automatic boundary. Review related client, server, route, and shared code and apply consistent improvements where useful, preserving behavior.
- Put multi-step server workflows and route handlers above focused, named server-only data-access functions. Keep parameterized SQL and user authorization at the data boundary; keep simple existing functions that already serve as focused queries, and avoid speculative generic query builders or extra wrappers.
- Extract shared logic into narrowly named helpers or React hooks when there is a real shared responsibility. Use React hooks only in React components or hooks; do not use `useMemo` or `useCallback` for ordinary server functions, and add memoization only when it has a demonstrated benefit and correct scope.
- Preserve cache identity, invalidation, provider rate coordination, transaction atomicity, and error behavior when refactoring. Add meaningful tests and verify affected flows; do not use production user data for mutation tests.

## Caching and freshness

- The dashboard’s full-ledger query uses Next.js `unstable_cache` with a 60-second revalidation interval and an authenticated-user-specific key/tag. In-app trade mutations must immediately expire that user’s tag with `updateTag` and revalidate the dashboard; out-of-band database changes can remain stale until revalidation completes. Portfolio/transaction pages and ticker details use scoped direct queries rather than that full-ledger cache. Never put request cookies or a shared, unscoped user result inside the cache.
- FYERS quote and historical caches are portfolio-scoped Neon rows, not cached HTTP responses. Keep at most one current FYERS quote per ticker/portfolio; attempt a background refresh after five minutes but preserve dated cached data on failure. Ticker details reuse successful baselines checked on the current Asia/Kolkata date and covered daily closes where available. The schema permits seven baselines, including legacy 15- and 60-day rows. The dashboard retains daily closes and completed coverage ranges, fetches missing ranges under a lease and the shared rate limiter, and never replaces saved closes. Corporate-action adjustments can make cached prices and user quantities inconsistent; disclose incomplete history. Preserve the 1 GB storage constraint.
- The Live Market tab uses an owner-only on-demand FYERS Data Socket in a server worker, forwarded to the browser as a transient stream. Its process-local sharing does not coordinate separate server instances; keep failures visible and preserve the existing dated quote fallback. Streaming prices and previous closes are not written to the quote cache. Verify live behavior during market hours before claiming it is validated.
- `fyers_rate_limits` is shared request-coordination state, not a data cache. Preserve its two-second reservation, 4,000-per-day app budget and 429 cooldown when changing FYERS requests. Provider HTTP fetches use `no-store`; the browser has only temporary component memoization/in-flight deduplication, not an application-managed persistent portfolio cache. The FYERS token remains in its encrypted, user-bound HTTP-only cookie. See README’s “Caching and freshness” section for limits and recovery context.
- FYERS `no_data` is recorded as unavailable coverage and retried after 24 hours, so it does not block other history ranges or stand in for a price. An NSE symbol can lack earlier history even if the company traded on BSE; the historical fallback uses the FYERS symbol master and an unambiguous exact ISIN match, records the provider symbol, and discloses BSE in the chart. Never silently substitute an unverified symbol or overwrite existing closes.

## Documentation maintenance

- For every feature, behavior, setup, dependency, or workflow change, review `README.md`, this file, `PRODUCT.md`, `docs/technical-specification.md`, and `tasks/` for affected information. Update the relevant files in the same change; do not claim planned functionality is implemented.
- Record discovered reproducible gotchas and limitations where future contributors will find them, including recovery steps when useful. Never record secrets, private user data, transient failures, or unverified assumptions.
- Update task status only when its acceptance criteria are met; use partial progress notes when a slice is incomplete. Use the pull request documentation checklist to make this review visible.

## Financial data

- Database storage is limited to 1 GB. Store at most seven FYERS period baselines and one current quote per ticker and portfolio; daily closing prices are stored separately for portfolio history. Preserve user transactions and manual valuation history.

- Use decimal arithmetic for money and quantities; do not use binary floating-point for accounting. Preserve source dates and clearly identify missing or stale valuations.
- Keep user-entered transactions authoritative. Do not invent prices, holdings, returns, tax classifications, or filing figures. Distinguish investment profit from taxable gain and raw reporting-period totals from final ITR entries.
- Indian tax rules and ITR forms can change by assessment year. Verify applicable primary sources before implementing or updating tax logic; mark unsupported cases for review and test date boundaries and FIFO scenarios.
- Neon PostgreSQL uses the serverless driver; versioned SQL migrations create the portfolio identity and supporting investment tables. Use versioned migrations and retain user-data isolation. Prisma is not installed. Do not assume FYERS entitlement, session availability, or permission to share provider data between users. The FYERS quote proof of concept is restricted to the configured Kinde owner and does not establish multi-user provider access.
