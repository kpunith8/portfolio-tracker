# Portfolio Tracker

A personal investment tracker for recording purchases and sales and understanding portfolio performance. Each user's portfolio is intended to be independent. The current application is an early Next.js landing page; its example portfolio figures are illustrative.

## Getting started

Install a Node.js version supported by the Next.js version in `package-lock.json`, then run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```sh
npm run dev        # Start the development server
npm run build      # Create a production build
npm run start      # Serve a production build
npm run lint       # Run ESLint
npm run typecheck  # Check TypeScript types
```

## Project layout

- `src/app/` — App Router layout, landing page, and global styles.
- `docs/technical-specification.md` — proposed architecture, data model, and calculation rules.
- `tasks/plan.md` — product scope and implementation plan.
- `tasks/todo.md` — incremental delivery checklist.

## Planned direction

The app is intended to support manually entered and CSV-imported investments, on-demand Kite ticker prices and history, manually valued assets, and a sold-investments view to assist with Indian tax preparation. Kinde authentication, Kite integration, Prisma, and PostgreSQL are planned; they are **not yet configured or installed**. Kite authentication and market-data permissions are separate from app authentication. Tax reporting will require careful review against the applicable assessment year's rules and the user's records.

The planned deployment target is Vercel with managed PostgreSQL, while keeping application logic portable. No environment variables are required for the current landing page. Never commit credentials or local environment files.
