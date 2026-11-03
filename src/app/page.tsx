import {
  LoginLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/components";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleDollarSign,
  Layers3,
  ListFilter,
} from "lucide-react";

export default function Home() {
  return (
    <main>
      <header className="nav wrap">
        <a className="brand" href="#top" aria-label="Portfolio Tracker home">
          <span className="brand-icon">
            <ChartNoAxesCombined size={19} />
          </span>{" "}
          portfolio<span className="brand-light">tracker</span>
        </a>
        <nav className="landing-nav" aria-label="Main navigation">
          <a className="nav-link" href="#overview">
            Explore the overview <ArrowDownRight size={16} aria-hidden="true" />
          </a>
          <LoginLink postLoginRedirectURL="/dashboard">Sign in</LoginLink>
          <RegisterLink postLoginRedirectURL="/dashboard">Sign up</RegisterLink>
        </nav>
      </header>
      <section className="hero wrap" id="top">
        <div className="hero-copy">
          <p className="kicker">
            <span /> A little more clarity, every day
          </p>
          <h1>
            Your investments,
            <br />
            <em>in perspective.</em>
          </h1>
          <p className="intro">
            A thoughtful space to keep track of what you own, understand how
            it’s doing, and see the bigger picture.
          </p>
          <a className="primary" href="#overview">
            Explore the overview <ArrowUpRight size={18} aria-hidden="true" />
          </a>
          <p className="hero-note">
            Built for a clearer relationship with your money.
          </p>
        </div>
        <div className="preview" aria-label="Portfolio features">
          <div className="preview-top">
            <span>Portfolio overview</span>
          </div>
          <div className="preview-main">
            <div>
              <p>Your portfolio</p>
              <strong>Your investments, in one place</strong>
            </div>
            <span className="chart-icon">
              <ChartNoAxesCombined size={22} />
            </span>
          </div>
          <div className="preview-bottom">
            <div>
              <span>Record</span>
              <strong>Purchases and sales</strong>
            </div>
            <div>
              <span>Review</span>
              <strong>Your transaction history</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="overview" id="overview">
        <div className="wrap overview-inner">
          <div className="section-heading">
            <p>A more complete picture</p>
            <h2>Everything in its place.</h2>
            <span>
              Less digging through statements. More understanding what your
              investments are doing.
            </span>
          </div>
          <div className="features">
            <article>
              <span className="feature-icon">
                <Layers3 size={20} />
              </span>
              <h3>See it together</h3>
              <p>
                Keep stocks, funds, gold, and other investments in one
                considered view.
              </p>
            </article>
            <article>
              <span className="feature-icon">
                <ChartNoAxesCombined size={20} />
              </span>
              <h3>Follow the journey</h3>
              <p>
                Understand performance over time, from individual purchases to
                your whole portfolio.
              </p>
            </article>
            <article>
              <span className="feature-icon">
                <ListFilter size={20} />
              </span>
              <h3>Stay organized</h3>
              <p>
                Keep a clear record of purchases and sales, ready whenever you
                need it.
              </p>
            </article>
          </div>
        </div>
      </section>
      <footer className="wrap footer">
        <div className="brand">
          <span className="brand-icon">
            <CircleDollarSign size={19} />
          </span>{" "}
          portfoliotracker
        </div>
        <span>A little more clarity, every day.</span>
      </footer>
    </main>
  );
}
