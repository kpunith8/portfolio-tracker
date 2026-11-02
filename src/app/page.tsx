import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, CircleDollarSign, Layers3, ListFilter } from "lucide-react";

export default function Home() {
  return (
    <main>
      <header className="nav wrap">
        <a className="brand" href="#top" aria-label="Portfolio Tracker home"><span className="brand-icon"><ChartNoAxesCombined size={19} /></span> portfolio<span className="brand-light">tracker</span></a>
        <a className="nav-link" href="#overview">Explore the overview <ArrowDownRight size={16} aria-hidden="true" /></a>
      </header>
      <section className="hero wrap" id="top">
        <div className="hero-copy">
          <p className="kicker"><span /> A little more clarity, every day</p>
          <h1>Your investments,<br /><em>in perspective.</em></h1>
          <p className="intro">A thoughtful space to keep track of what you own, understand how it’s doing, and see the bigger picture.</p>
          <a className="primary" href="#overview">Explore the overview <ArrowUpRight size={18} aria-hidden="true" /></a>
          <p className="hero-note">Built for a clearer relationship with your money.</p>
        </div>
        <div className="preview" aria-label="Illustration of a portfolio overview">
          <div className="preview-top"><span>Portfolio overview</span><span className="preview-tag">Illustrative preview</span></div>
          <div className="preview-main"><div><p>Total portfolio value</p><strong>₹ 12,48,500</strong><span className="growth">↗ 12.4% <small>all time</small></span></div><span className="chart-icon"><ChartNoAxesCombined size={22} /></span></div>
          <div className="chart" aria-hidden="true"><svg viewBox="0 0 500 170" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b7d8c4" stopOpacity=".65"/><stop offset="1" stopColor="#b7d8c4" stopOpacity="0"/></linearGradient></defs><path d="M0 145 C45 139 55 118 90 125 S140 93 175 102 S220 75 260 85 S300 50 345 62 S405 21 440 34 S475 15 500 10 L500 170 L0 170Z" fill="url(#fill)"/><path d="M0 145 C45 139 55 118 90 125 S140 93 175 102 S220 75 260 85 S300 50 345 62 S405 21 440 34 S475 15 500 10" fill="none" stroke="#4e8068" strokeWidth="2.5"/></svg></div>
          <div className="chart-labels"><span>Past</span><span>Today</span></div>
          <div className="preview-bottom"><div><span>Invested</span><strong>₹ 11,10,000</strong></div><div><span>Overall return</span><strong className="green">+ ₹ 1,38,500</strong></div></div>
          <p className="sample-note">Example figures shown for illustration.</p>
        </div>
      </section>
      <section className="overview" id="overview"><div className="wrap overview-inner"><div className="section-heading"><p>A more complete picture</p><h2>Everything in its place.</h2><span>Less digging through statements. More understanding what your investments are doing.</span></div><div className="features"><article><span className="feature-icon"><Layers3 size={20} /></span><h3>See it together</h3><p>Keep stocks, funds, gold, and other investments in one considered view.</p></article><article><span className="feature-icon"><ChartNoAxesCombined size={20} /></span><h3>Follow the journey</h3><p>Understand performance over time, from individual purchases to your whole portfolio.</p></article><article><span className="feature-icon"><ListFilter size={20} /></span><h3>Stay organized</h3><p>Keep a clear record of purchases and sales, ready whenever you need it.</p></article></div></div></section>
      <footer className="wrap footer"><div className="brand"><span className="brand-icon"><CircleDollarSign size={19} /></span> portfoliotracker</div><span>A little more clarity, every day.</span></footer>
    </main>
  );
}
