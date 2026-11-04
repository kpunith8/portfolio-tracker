# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is an individual investor in India who wants to track their own investments. Each login has an independent portfolio. The user supplies investment transactions manually or imports them from a CSV file.

## Product Purpose

Provide a clear view of investments, their value and performance over time, and the records needed to prepare information for Indian income-tax filing. The product should make individual purchases, sales and their effects understandable alongside the overall portfolio.

## Operating Context

Users maintain their own purchase and sale records and may use a downloadable CSV template for bulk entry. FYERS is intended to supply current and historical prices for supported tickers; it is not the source of the user's holdings or orders. Users provide valuations for assets without an appropriate market-data source, including EPF and fixed deposits. Sold transactions should be reviewable by financial year and the applicable ITR capital-gain reporting periods.

## Capabilities and Constraints

- Database storage is budgeted at 1 GB. Historical FYERS data uses at most seven replaceable baseline prices per ticker, with actual dates and stale or missing states.

- Planned asset groups are stocks, mutual funds, gold, and debt and other instruments.
- Planned views include a dashboard, investment details, transaction history, sold investments and settings. Performance measures include profit and loss, CAGR and XIRR where the required information is available.
- FYERS and application authentication are separate; data freshness and unavailable information must be visible. No automatic broker portfolio synchronization or order placement is planned.
- Tax reporting is intended as preparation support using user-provided data, with unsupported cases flagged for review. Applicable forms and rules vary by assessment year.
- The application supports Kinde-scoped manual NSE purchases and FIFO sales backed by Neon. FYERS quotes and five selected historical closes support a dated investment-value chart and purchase-level CAGR, with cash-flow-based investment XIRR and dated cached fallback; the dashboard uses cached daily FYERS closes with background backfill and a latest same-day quote when available; historical coverage and corporate-action adjustments can be incomplete. CSV import and other asset types remain incomplete.
- A one-off purchase seed can include listed ETFs in the Stocks view; missing brokerage and tax charges are disclosed. A general CSV importer remains planned.
- FYERS session arrangements, data-use rights, historical data entitlement and some manual-asset details remain open decisions.

## Evidence on Hand

The existing landing page is in `src/app/`; its portfolio reads stored transactions; FYERS prices and selected historical closes are shown with dates when available. Product requirements and technical decisions are recorded in `tasks/plan.md` and `docs/technical-specification.md`. No customer testimonials, real portfolio figures or usage claims have been supplied for publication.

## Product Principles

- Keep each user's portfolio independent and under their control.
- Make the source and age of prices and valuations clear.
- Explain performance in terms of the user's actual transactions and available data.
- Help users organize tax-preparation information without presenting incomplete calculations as final filing advice.
- Keep recording and reviewing investments straightforward, including for assets that need manual valuations.
