DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '011_symbol_catalog') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '010_history_exchange_fallback') THEN RAISE EXCEPTION 'Migration 010 required'; END IF;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE TABLE fyers_symbol_catalog (
    fyers_symbol text PRIMARY KEY,
    exchange text NOT NULL CHECK (exchange IN ('NSE', 'BSE')),
    trading_symbol text NOT NULL,
    name text NOT NULL,
    isin text,
    series text,
    trade_status integer,
    source_date date,
    refreshed_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX fyers_symbol_catalog_ticker_prefix ON fyers_symbol_catalog (upper(trading_symbol) text_pattern_ops);
  CREATE INDEX fyers_symbol_catalog_name_trgm ON fyers_symbol_catalog USING gin (upper(name) gin_trgm_ops);
  CREATE INDEX fyers_symbol_catalog_symbol_trgm ON fyers_symbol_catalog USING gin (upper(trading_symbol) gin_trgm_ops);
  INSERT INTO schema_migrations(version) VALUES ('011_symbol_catalog');
END
$migration$;
