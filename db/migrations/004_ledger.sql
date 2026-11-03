DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '004_ledger') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '003_compact_market_cache') THEN RAISE EXCEPTION 'Migration 003 required'; END IF;
  ALTER TABLE ticker_period_baselines DROP CONSTRAINT ticker_period_baselines_compact_period_check;
  ALTER TABLE ticker_period_baselines ADD CONSTRAINT ticker_period_baselines_period_check CHECK (period IN ('7D','15D','30D','60D','90D','6M','365D'));
  INSERT INTO schema_migrations(version) VALUES ('004_ledger');
END
$migration$;
