DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '007_daily_price_history') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '006_market_guardrails') THEN RAISE EXCEPTION 'Migration 006 required'; END IF;
  CREATE TABLE daily_closing_prices (
    portfolio_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    market_date date NOT NULL,
    price numeric(24,8) NOT NULL CHECK (price > 0 AND price < 10000000000000000),
    source text NOT NULL DEFAULT 'FYERS' CHECK (source = 'FYERS'),
    adjustment_basis text NOT NULL DEFAULT 'UNKNOWN' CHECK (adjustment_basis IN ('UNKNOWN', 'RAW', 'ADJUSTED')),
    retrieved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (portfolio_id, instrument_id, market_date),
    FOREIGN KEY (portfolio_id, instrument_id) REFERENCES instruments(portfolio_id, id) ON DELETE RESTRICT
  );
  CREATE TABLE daily_history_coverage (
    portfolio_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL CHECK (end_date >= start_date),
    checked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (portfolio_id, instrument_id, start_date, end_date),
    FOREIGN KEY (portfolio_id, instrument_id) REFERENCES instruments(portfolio_id, id) ON DELETE RESTRICT
  );
  CREATE TABLE daily_history_sync_leases (
    portfolio_id uuid PRIMARY KEY REFERENCES portfolios(id) ON DELETE RESTRICT,
    lease_id uuid NOT NULL,
    expires_at timestamptz NOT NULL
  );
  INSERT INTO schema_migrations(version) VALUES ('007_daily_price_history');
END
$migration$;
