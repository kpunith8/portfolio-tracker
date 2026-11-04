DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '009_history_coverage_status') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '007_daily_price_history') THEN RAISE EXCEPTION 'Migration 007 required'; END IF;
  ALTER TABLE daily_history_coverage ADD COLUMN status text NOT NULL DEFAULT 'COMPLETE' CHECK (status IN ('COMPLETE', 'UNAVAILABLE'));
  INSERT INTO schema_migrations(version) VALUES ('009_history_coverage_status');
END
$migration$;
