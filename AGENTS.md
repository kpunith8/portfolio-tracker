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

## Interface conventions

Before adding or changing UI, inspect the closest existing flow and reuse its components, styles and interaction patterns. Check desktop and mobile, keyboard and focus behavior, empty and error states, and the rendered result. Do not introduce a visually different version of an existing control just because the browser provides a default.

- **Tables:** Start with `src/components/ui/table.tsx` and the table and scrolling styles in `src/app/dashboard/dashboard.css`; inspect the closest portfolio or transaction table for column alignment, spacing, numeric formatting and responsive overflow. Keep table headings semantic and scroll regions keyboard accessible. Use distinct styling only when the task calls for it.
- **Expandable rows:** Follow the portfolio and tax report disclosure patterns: a keyboard-operable `details`/`summary`, a visible “View details” cue where appropriate, and a `lucide-react` chevron that reflects expansion. Preserve focus visibility and reduced-motion preferences; do not substitute plus/minus markers for the established cue.
- **Dropdowns:** For a styled in-app choice menu, follow `investment-select` in `src/components/investments/manual-asset-entry.tsx` and its CSS instead of relying on the browser's unstyled option popup. Display the selected value, label the control, provide keyboard access and visible focus, mark the selected option, close on selection and Escape, restore focus, and handle long lists and dismissal. Reuse or extract a shared component when practical. Use native controls when platform behavior or accessibility makes them a better fit, with an explicit reason.
- **Dialogs and buttons:** Reuse `trade-dialog`, `trade-buttons`, `trade-primary` and existing field patterns where applicable; match button size, spacing and primary/secondary hierarchy. Verify that menus are not clipped by the dialog.
- **Print and export:** Design the output for the medium, preserve the data and disclosures, and verify the selected scope and page layout rather than printing expanded interactive controls.
