import { portfolioPage } from "../../domain/pagination";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import {
  ChartNoAxesCombined,
  LayoutDashboard,
  WalletCards,
  ArrowDownLeft,
  FileText,
  Settings,
  LoaderCircle,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LiveViews } from "../../components/investments/live-views";
import { findOwnPortfolio } from "../../server/db/portfolio";
import { currentMarketDay, readPortfolio } from "../../server/portfolio/ledger";
import { createPortfolio } from "./actions";
import { owner, getToken } from "../../server/fyers/session";
import type { MarketStatus } from "../../server/market-data/fyers";
import "./dashboard.css";

const nav = [
  { name: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
  { name: "Portfolio", icon: WalletCards, view: "portfolio" },
  { name: "Transactions", icon: ArrowDownLeft, view: "transactions" },
  { name: "Tax report", icon: FileText, view: "tax" },
  { name: "Settings", icon: Settings, view: "settings" },
];
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    instrument?: string;
    page?: string;
    sort?: string;
    tab?: string;
  }>;
}) {
  const auth = getKindeServerSession();
  if (!(await auth.isAuthenticated()))
    redirect("/api/auth/login?post_login_redirect_url=/dashboard");
  const user = await auth.getUser();
  const params = await searchParams;
  const asOf = currentMarketDay();
  const { page } = portfolioPage(Number(params.page ?? "1"));
  const sort = params.sort === "value" ? "value" : "date";
  const requested = params.view;
  const view = nav.some((n) => n.view === requested) ? requested! : "dashboard";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="app-brand">
          <span className="app-brand-mark">
            <ChartNoAxesCombined size={20} />
          </span>
          <span>
            portfolio<span className="app-brand-light">tracker</span>
          </span>
        </Link>
        <nav className="side-nav" aria-label="Main navigation">
          {nav.map(({ name, icon: Icon, view: key }) => (
            <Link
              key={key}
              className={`side-link ${view === key ? "active" : ""}`}
              href={
                key === "dashboard" ? "/dashboard" : `/dashboard?view=${key}`
              }
              aria-current={view === key ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{name}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar">
              {(user?.given_name || "U").charAt(0)}
            </span>
            <span className="profile-copy">
              <strong>{user?.given_name || "Account"}</strong>
              <small>Personal account</small>
            </span>
            <LogoutLink className="sign-out">Sign out</LogoutLink>
          </div>
        </div>
      </aside>
      <main className="dashboard-main">
        <div className="mobile-session">
          <LogoutLink className="mobile-sign-out">Sign out</LogoutLink>
        </div>
        <Suspense
          fallback={
            <section className="sample-page" aria-busy="true">
              <div className="dashboard-loading-table">
                <div className="performance-loading" role="status">
                  <LoaderCircle size={24} aria-hidden="true" />
                  <span>Loading investments…</span>
                </div>
              </div>
            </section>
          }
        >
          <DashboardContent
            view={view}
            instrument={params.instrument}
            liveMarket={params.tab === "live" && !params.instrument}
            page={page}
            sort={sort}
            asOf={asOf}
          />
        </Suspense>
      </main>
    </div>
  );
}

async function DashboardContent({
  view,
  instrument,
  liveMarket,
  page,
  sort,
  asOf,
}: {
  view: string;
  instrument?: string;
  liveMarket: boolean;
  page: number;
  sort: "date" | "value";
  asOf: string;
}) {
  const ownerId = view === "settings" ? await owner() : null;
  const connected = ownerId ? !!(await getToken(ownerId)) : false;
  let exists = false;
  let available = true;
  let data: Awaited<ReturnType<typeof readPortfolio>> | null = null;
  const marketStatus: MarketStatus = "cached";
  try {
    exists = !!(await findOwnPortfolio());
    if (exists && ["dashboard", "portfolio", "transactions"].includes(view))
      data = await readPortfolio({
        view: view as "dashboard" | "portfolio" | "transactions",
        page,
        sort,
        detailId: instrument,
        liveMarket: view === "portfolio" && liveMarket,
        asOf,
      });
  } catch {
    available = false;
  }
  return (
    <>
      {!available ? (
        <section className="sample-empty">
          <h1>Portfolio unavailable</h1>
          <p>Check the database connection and try again.</p>
        </section>
      ) : !exists ? (
        <section className="sample-empty">
          <h1>Create your portfolio</h1>
          <p>Set up a private portfolio to start recording your investments.</p>
          <form action={createPortfolio}>
            <button type="submit" className="trade-primary">
              Create portfolio
            </button>
          </form>
        </section>
      ) : view === "settings" ? (
        <section className="sample-page">
          <h1>Settings</h1>
          <h2>FYERS connection</h2>
          <p>
            {ownerId
              ? connected
                ? "A FYERS session is stored. It may need reconnecting after expiry."
                : "Connect FYERS to authorize market data."
              : "FYERS is available only to the configured account owner."}
          </p>
          {ownerId && (
            <a className="text-link" href="/api/fyers/connect">
              Connect FYERS
            </a>
          )}
        </section>
      ) : data ? (
        <LiveViews
          data={
            data as unknown as React.ComponentProps<typeof LiveViews>["data"]
          }
          view={view as "portfolio" | "transactions" | "dashboard"}
          detailId={instrument}
          liveMarket={view === "portfolio" && liveMarket}
          marketStatus={marketStatus}
          asOf={asOf}
          initialSort={sort}
        />
      ) : (
        <section className="sample-empty">
          <h1>{nav.find((n) => n.view === view)?.name}</h1>
          <p>This section is coming soon.</p>
        </section>
      )}
    </>
  );
}
