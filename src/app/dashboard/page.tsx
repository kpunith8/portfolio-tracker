import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleHelp,
  FileText,
  LayoutDashboard,
  PieChart,
  Settings,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PerformanceChart } from "../../components/dashboard/performance-chart";
import data from "../../data/dashboard.json";
import "./dashboard.css";

const money = (value: number) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
const nav = [
  { name: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
  { name: "Portfolio", icon: WalletCards, view: "portfolio" },
  { name: "Transactions", icon: ArrowDownLeft, view: "transactions" },
  { name: "Tax report", icon: FileText, view: "tax" },
  { name: "Settings", icon: Settings, view: "settings" },
];
const labels: Record<string, string> = {
  portfolio: "Portfolio",
  transactions: "Transactions",
  tax: "Tax report",
  settings: "Settings",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { isAuthenticated, getUser } = getKindeServerSession();
  if (!(await isAuthenticated()))
    redirect("/api/auth/login?post_login_redirect_url=/dashboard");
  const user = await getUser();
  const name = user?.given_name || "there";
  const selected = (await searchParams).view ?? "dashboard";
  const view = selected in labels ? selected : "dashboard";
  const latest = data.history[data.history.length - 1];
  const gain = latest.value - latest.invested;
  const allocation = ["Stocks", "Mutual funds", "Gold", "Debt & other"].map(
    (type) => ({
      type,
      value: data.holdings
        .filter((h) => h.type === type)
        .reduce((sum, h) => sum + h.value, 0),
    }),
  );
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
        <div className="sidebar-label">Your workspace</div>
        <nav className="side-nav" aria-label="Main navigation">
          {nav.map(({ name: label, icon: Icon, view: key }) => (
            <Link
              key={key}
              href={
                key === "dashboard" ? "/dashboard" : `/dashboard?view=${key}`
              }
              className={view === key ? "side-link active" : "side-link"}
              aria-current={view === key ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <CircleHelp size={17} />
            <span>Your portfolio, your pace.</span>
          </div>
          <div className="profile">
            <span className="avatar">{name.charAt(0).toUpperCase()}</span>
            <span className="profile-copy">
              <strong>{name}</strong>
              <small>Personal account</small>
            </span>
            <LogoutLink className="sign-out">Sign out</LogoutLink>
          </div>
        </div>
      </aside>
      <main className="dashboard-main">
        <div className="topline">
          <span>
            My workspace <span className="breadcrumb">/</span>{" "}
            {view === "dashboard" ? "Dashboard" : labels[view]}
          </span>
          <div className="topline-actions">
            <span className="sample-badge">
              <span /> Sample data
            </span>
            <LogoutLink className="mobile-sign-out">Sign out</LogoutLink>
          </div>
        </div>
        {view !== "dashboard" ? (
          <section className="coming-soon">
            <Link href="/dashboard" className="back-link">
              ← Back to dashboard
            </Link>
            <h1>{labels[view]}</h1>
            <p>
              This section is coming soon. For now, explore the sample
              dashboard.
            </p>
            <Link href="/dashboard" className="dashboard-action">
              Go to dashboard <ArrowRight size={16} />
            </Link>
          </section>
        ) : (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Good to see you, {name}.</h1>
                <p>Here’s a look at how your investments are doing.</p>
              </div>
              <div className="as-of">
                <span>Sample portfolio</span>
                <strong>As of 30 Oct 2026</strong>
              </div>
            </header>
            <section className="summary-strip" aria-label="Portfolio summary">
              <div className="summary-item summary-main">
                <span>Current value</span>
                <strong>{money(latest.value)}</strong>
                <small>Across all investments</small>
              </div>
              <div className="summary-item">
                <span>Invested amount</span>
                <strong>{money(latest.invested)}</strong>
                <small>Remaining cost basis</small>
              </div>
              <div className="summary-item">
                <span>Unrealized gain</span>
                <strong className="positive">+{money(gain)}</strong>
                <small className="positive">
                  +{((gain / latest.invested) * 100).toFixed(2)}% overall
                </small>
              </div>
              <div className="summary-item">
                <span>Portfolio XIRR</span>
                <strong>{data.xirr}%</strong>
                <small>Annualized return</small>
              </div>
            </section>
            <div className="dashboard-grid">
              <section className="panel performance">
                <div className="panel-heading">
                  <div>
                    <h2>Portfolio performance</h2>
                    <p>How your portfolio value has changed</p>
                  </div>
                  <span className="panel-tag">Value over time</span>
                </div>
                <PerformanceChart history={data.history} />
              </section>
              <section className="panel allocation">
                <div className="panel-heading">
                  <div>
                    <h2>Asset allocation</h2>
                    <p>Your portfolio at a glance</p>
                  </div>
                  <PieChart size={18} className="muted-icon" />
                </div>
                <div className="allocation-total">
                  <span>Total value</span>
                  <strong>{money(latest.value)}</strong>
                </div>
                <div className="allocation-bar" aria-hidden="true">
                  {allocation.map((a, i) => (
                    <span
                      key={a.type}
                      className={`asset-${i}`}
                      style={{ width: `${(a.value / latest.value) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="allocation-list">
                  {allocation.map((a, i) => (
                    <div className="allocation-row" key={a.type}>
                      <span>
                        <i className={`asset-dot asset-${i}`} />
                        {a.type}
                      </span>
                      <strong>
                        {((a.value / latest.value) * 100).toFixed(1)}%
                      </strong>
                      <small>{money(a.value)}</small>
                    </div>
                  ))}
                </div>
                <p className="allocation-note">
                  Debt includes a manually entered valuation.
                </p>
              </section>
              <section className="panel holdings">
                <div className="panel-heading">
                  <div>
                    <h2>Top holdings</h2>
                    <p>A closer look at your investments</p>
                  </div>
                  <Link href="/dashboard?view=portfolio" className="text-link">
                    View portfolio <ArrowRight size={15} />
                  </Link>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Investment</th>
                        <th>Type</th>
                        <th>Current value</th>
                        <th>Overall return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.holdings.slice(0, 4).map((h) => (
                        <tr key={h.name}>
                          <td>
                            <div className="holding-name">
                              <span className="holding-icon">
                                {h.name.charAt(0)}
                              </span>
                              <span>
                                <strong>{h.name}</strong>
                                <small>{h.symbol}</small>
                              </span>
                            </div>
                          </td>
                          <td>{h.type}</td>
                          <td className="number">{money(h.value)}</td>
                          <td className="positive number">
                            +{(((h.value - h.cost) / h.cost) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel activity">
                <div className="panel-heading">
                  <div>
                    <h2>Recent activity</h2>
                    <p>Your latest updates</p>
                  </div>
                  <Link
                    href="/dashboard?view=transactions"
                    className="text-link"
                  >
                    View all <ArrowRight size={15} />
                  </Link>
                </div>
                <div className="activity-list">
                  {data.activity.map((a) => (
                    <div className="activity-row" key={a.name + a.date}>
                      <span className="activity-icon">
                        <ArrowDownLeft size={16} />
                      </span>
                      <div>
                        <strong>{a.name}</strong>
                        <small>
                          {a.type} · {a.detail}
                        </small>
                      </div>
                      <div className="activity-amount">
                        <strong>
                          {a.amount < 0 ? "−" : ""}
                          {money(Math.abs(a.amount))}
                        </strong>
                        <small>
                          {new Date(`${a.date}T00:00:00`).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short" },
                          )}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="realized">
                  <span>
                    Realized gain <small>all time</small>
                  </span>
                  <strong className="positive">
                    +{money(data.realizedGain)} <ArrowUpRight size={14} />
                  </strong>
                </div>
              </section>
            </div>
            <p className="dashboard-disclaimer">
              This dashboard contains illustrative data only. Prices and returns
              are not connected to your portfolio.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
