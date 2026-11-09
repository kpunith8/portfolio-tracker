# Repository guidance

This is a Next.js App Router, React and TypeScript personal portfolio tracker using Kinde, Neon PostgreSQL and FYERS. Each Kinde user owns an independent portfolio; FYERS supplies market data, not broker holdings or order execution.

## Working in this repository

- Install with `npm ci` and run with `npm run dev`; see [README](README.md) for setup, commands and operations.
- Read the relevant sections of the [technical specification](docs/technical-specification.md) when working on architecture, financial data or provider integrations; consult [the plan](docs/plan.md) when changing product scope.
- Validate inputs and authorize every user-scoped read and mutation on the server; keep secrets and local environment files out of Git and do not use production user data for mutation tests.
- Use decimal arithmetic for financial amounts and quantities; preserve transaction history, source dates, stale/missing-data states and the 1 GB database budget. Never invent prices, returns or tax classifications.
- User-entered trades are authoritative; preserve FIFO allocations, reject oversells and do not silently replay later sales.
- Derive ownership from the authenticated server session; never cache cookies or unscoped user results.
- Preserve atomic CSV imports and owner-scoped retry keys; a changed payload requires a new key.
- Distinguish investment P/L from taxable gain; verify current primary sources and test date boundaries and FIFO before changing Indian tax logic.
- Keep interfaces responsive and keyboard accessible, label icon-only controls, respect reduced motion and clearly label example data; use `lucide-react` for icons.
- Run `npm test` after changes, plus lint, format, typecheck and build when relevant; before committing, run the affected Playwright component or integration spec rather than the entire browser suite. CI runs all suites on pull requests.
- Keep browser tests focused on page loads, meaningful actions, sorting and important edge cases, not exhaustive label or minor presentation checks. Use small local fixtures and mocked database/FYERS boundaries; never connect integration tests to real services.
- Review affected documentation for every behavior, setup, dependency or workflow change; record reproducible limitations without secrets and update task status only when acceptance criteria are met.

## Refactoring and architecture

- Review the whole repository for refactoring requests unless explicitly limited; tagged files are examples. Fix related duplication when safe and document broader opportunities outside the task.
- Use focused server-only queries with parameterized SQL and user authorization.
- Preserve cache identity and invalidation, provider rate coordination and transaction atomicity.
