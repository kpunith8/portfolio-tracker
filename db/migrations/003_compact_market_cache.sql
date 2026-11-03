DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '003_compact_market_cache') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '002_portfolio_data') THEN
    RAISE EXCEPTION 'Migration 002 must be applied first';
  END IF;

  CREATE TABLE ticker_period_baselines_compact (
    portfolio_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    period text NOT NULL CHECK (period IN ('7D', '30D', '60D', '90D', '6M', '365D')),
    as_of_date date NOT NULL,
    target_date date NOT NULL CHECK (target_date <= as_of_date),
    market_date date,
    price numeric(24,8) CHECK (price >= 0 AND price < 10000000000000000),
    adjustment_basis text NOT NULL DEFAULT 'UNKNOWN' CHECK (adjustment_basis IN ('UNKNOWN', 'RAW', 'ADJUSTED')),
    status text NOT NULL CHECK (status IN ('AVAILABLE', 'UNAVAILABLE')),
    checked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (portfolio_id, instrument_id, period),
    FOREIGN KEY (portfolio_id, instrument_id) REFERENCES instruments(portfolio_id, id) ON DELETE RESTRICT,
    CHECK ((status = 'AVAILABLE' AND price IS NOT NULL AND market_date IS NOT NULL AND market_date <= target_date)
      OR (status = 'UNAVAILABLE' AND price IS NULL AND market_date IS NULL))
  );

  -- Reject invalid existing links rather than silently changing their meaning.
  IF EXISTS (
    SELECT 1 FROM ticker_period_baselines b
    JOIN price_observations p ON p.portfolio_id = b.portfolio_id AND p.instrument_id = b.instrument_id AND p.id = b.observation_id
    WHERE b.status = 'AVAILABLE' AND (p.source <> 'FYERS' OR p.interval_type <> 'DAY' OR p.market_date > b.target_date)
  ) THEN
    RAISE EXCEPTION 'Existing baseline observations require review';
  END IF;
  INSERT INTO ticker_period_baselines_compact
    (portfolio_id, instrument_id, period, as_of_date, target_date, market_date, price, adjustment_basis, status, checked_at)
  SELECT DISTINCT ON (b.portfolio_id, b.instrument_id, b.period)
    b.portfolio_id, b.instrument_id, b.period, b.as_of_date, b.target_date,
    p.market_date, p.price, COALESCE(p.adjustment_basis, 'UNKNOWN'), b.status, b.checked_at
  FROM ticker_period_baselines b
  LEFT JOIN price_observations p ON p.portfolio_id = b.portfolio_id AND p.instrument_id = b.instrument_id AND p.id = b.observation_id
  ORDER BY b.portfolio_id, b.instrument_id, b.period, b.as_of_date DESC, b.checked_at DESC;
  DROP TABLE ticker_period_baselines;
  ALTER TABLE ticker_period_baselines_compact RENAME TO ticker_period_baselines;

  -- Preserve existing observations, but prevent new daily FYERS rows. Manual
  -- dated valuations remain authoritative and are never removed by cache policy.
  ALTER TABLE price_observations ADD CONSTRAINT no_new_fyers_daily
    CHECK (NOT (source = 'FYERS' AND interval_type = 'DAY')) NOT VALID;
  CREATE UNIQUE INDEX one_fyers_quote_per_instrument
    ON price_observations (portfolio_id, instrument_id) WHERE source = 'FYERS' AND interval_type = 'QUOTE';
  INSERT INTO schema_migrations(version) VALUES ('003_compact_market_cache');
END
$migration$;
