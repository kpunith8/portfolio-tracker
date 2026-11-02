# Repository guidance

## Context

This is an early personal portfolio tracker built with Next.js App Router, TypeScript, React, and lucide-react. The landing page, basic Kinde authentication, and an authenticated dashboard with illustrative JSON data are implemented; investment management and other dashboard sections remain planned. Read `docs/technical-specification.md`, `tasks/plan.md`, and the relevant items in `tasks/todo.md` before implementing portfolio functionality; these documents describe intended behavior, not functionality that already exists. When requirements change, update the affected documents.

Each authenticated user will have an independent portfolio. Transactions are entered manually or imported; Kite is planned as a market-data provider, not as a source of broker holdings or order execution. Non-market assets such as EPF and fixed deposits use user-provided valuations. Do not introduce household management, broker-account synchronization, or live WebSockets without a requirement.

## Development

- Install dependencies with `npm ci`; run locally with `npm run dev`.
- Verify relevant changes with `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run build`. Add focused tests when implementing financial logic, security, or other nontrivial behavior.
- Keep changes incremental and consistent with the existing TypeScript and App Router structure. Add dependencies when a feature needs them, and update the lockfile.
- Use `lucide-react` for icons. Keep interfaces responsive and keyboard accessible, provide accessible names for icon-only controls, and respect reduced-motion preferences. Example data must be clearly labeled.
- Keep secrets and local environment files out of Git. Integrations and database access belong on the server; validate inputs and authorize every user-scoped read and mutation.

## Documentation maintenance

- For every feature, behavior, setup, dependency, or workflow change, review `README.md`, this file, `PRODUCT.md`, `docs/technical-specification.md`, and `tasks/` for affected information. Update the relevant files in the same change; do not claim planned functionality is implemented.
- Record discovered reproducible gotchas and limitations where future contributors will find them, including recovery steps when useful. Never record secrets, private user data, transient failures, or unverified assumptions.
- Update task status only when its acceptance criteria are met; use partial progress notes when a slice is incomplete. Use the pull request documentation checklist to make this review visible.

## Financial data

- Use decimal arithmetic for money and quantities; do not use binary floating-point for accounting. Preserve source dates and clearly identify missing or stale valuations.
- Keep user-entered transactions authoritative. Do not invent prices, holdings, returns, tax classifications, or filing figures. Distinguish investment profit from taxable gain and raw reporting-period totals from final ITR entries.
- Indian tax rules and ITR forms can change by assessment year. Verify applicable primary sources before implementing or updating tax logic; mark unsupported cases for review and test date boundaries and FIFO scenarios.
- Prisma and PostgreSQL are planned, not currently installed. When introduced, use versioned migrations and retain user-data isolation. Do not assume Kite entitlement, session availability, or permission to share provider data between users.
