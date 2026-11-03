DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '006_market_guardrails') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '005_record_trade') THEN RAISE EXCEPTION 'Migration 005 required'; END IF;
  CREATE TABLE fyers_rate_limits (
    app_key text PRIMARY KEY,
    next_allowed_at timestamptz NOT NULL,
    market_day date NOT NULL,
    requests integer NOT NULL CHECK (requests >= 0)
  );
  EXECUTE $sql$
    CREATE FUNCTION enforce_stock_whole_quantity() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN
      IF NEW.quantity IS NOT NULL AND NEW.quantity <> trunc(NEW.quantity) AND EXISTS (
        SELECT 1 FROM instruments i WHERE i.id=NEW.instrument_id AND i.portfolio_id=NEW.portfolio_id AND i.asset_type='STOCK'
      ) THEN RAISE EXCEPTION 'STOCK_WHOLE_QUANTITY_REQUIRED'; END IF;
      RETURN NEW;
    END
    $body$;
  $sql$;
  CREATE TRIGGER stock_whole_quantity BEFORE INSERT OR UPDATE OF quantity, instrument_id, portfolio_id
    ON investment_transactions FOR EACH ROW EXECUTE FUNCTION enforce_stock_whole_quantity();
  INSERT INTO schema_migrations(version) VALUES ('006_market_guardrails');
END
$migration$;
