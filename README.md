# Portfolio Tracker

A personal investment tracker for recording purchases and sales and understanding portfolio performance. Each user's portfolio is intended to be independent. The current application includes a Next.js landing page, basic Kinde authentication, and a protected dashboard using illustrative data.

## Getting started

Install a Node.js version supported by the Next.js version in `package-lock.json`, then run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Kinde authentication

Create a Kinde backend web application. Create `.env.local` with `KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_ISSUER_URL`, `KINDE_SITE_URL`, `KINDE_POST_LOGOUT_REDIRECT_URL`, and `KINDE_POST_LOGIN_REDIRECT_URL`; keep the file private. For local development, use `http://localhost:3000` as the site and logout URL and `http://localhost:3000/dashboard` as the post-login URL. In Kinde, add `http://localhost:3000/api/auth/kinde_callback` to the allowed callback URLs and `http://localhost:3000` to the allowed logout redirect URLs. Configure the corresponding production URLs when deploying. Sign in or register from the landing page to reach the protected `/dashboard`. The dashboard displays sample data, not your investments. Kinde credentials and allowed URLs must match the local origin.

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
- `src/data/dashboard.json` — illustrative dashboard data; it is not connected to Kite or a database.
- `.github/workflows/ci.yml` — lint, formatting, type, and build checks; future Playwright job.
- `docs/technical-specification.md` — proposed architecture, data model, and calculation rules.
- `tasks/plan.md` — product scope and implementation plan.
- `tasks/todo.md` — incremental delivery checklist.

## Planned direction

The app is intended to support manually entered and CSV-imported investments, on-demand Kite ticker prices and history, manually valued assets, and a sold-investments view to assist with Indian tax preparation. Kinde authentication and a sample dashboard are scaffolded; Portfolio, Transactions, Tax report, and Settings are placeholders. Kite integration, Prisma, and PostgreSQL are planned; they are **not yet configured or installed**. Kite authentication and market-data permissions are separate from app authentication. Tax reporting will require careful review against the applicable assessment year's rules and the user's records.

The planned deployment target is Vercel with managed PostgreSQL, while keeping application logic portable. Never commit credentials or local environment files.

## Continuous integration and browser tests

GitHub Actions runs lint, formatting, TypeScript, and production build checks. Playwright is configured for Chromium, but its CI job remains disabled until browser tests and test authentication are added. To run future tests locally, install the browser once with `npx playwright install chromium`, add tests under `tests/e2e/`, and run `npm run test:e2e`. The CI build uses non-production Kinde placeholder values when repository secrets are absent.

## Keeping documentation current

When changing a feature, setup, behavior, architecture, or development workflow, update the relevant documentation in the same change. Record reproducible gotchas and limitations without secrets. Use `AGENTS.md` for contributor guidance, this README for current setup and implemented behavior, and `docs/technical-specification.md` / `tasks/` for architecture and delivery status. The pull request template prompts this review; it does not automatically determine whether documentation is accurate.
