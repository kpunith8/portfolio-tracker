DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '010_history_exchange_fallback') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '009_history_coverage_status') THEN RAISE EXCEPTION 'Migration 009 required'; END IF;
  ALTER TABLE daily_closing_prices ADD COLUMN provider_symbol text;
  CREATE TABLE daily_history_alternate_coverage (
    portfolio_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    provider_symbol text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL CHECK (end_date >= start_date),
    status text NOT NULL CHECK (status IN ('COMPLETE', 'UNAVAILABLE')),
    checked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (portfolio_id,instrument_id,provider_symbol,start_date,end_date),
    FOREIGN KEY (portfolio_id,instrument_id) REFERENCES instruments(portfolio_id,id) ON DELETE RESTRICT
  );
  INSERT INTO schema_migrations(version) VALUES ('010_history_exchange_fallback');
END
$migration$;
