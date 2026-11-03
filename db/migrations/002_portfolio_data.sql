-- Atomic, versioned bootstrap. 001 was applied before migration tracking existed.
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '002_portfolio_data') THEN
    RETURN;
  END IF;
  IF to_regclass('public.portfolios') IS NULL THEN
    RAISE EXCEPTION 'Migration 001 must be applied first';
  END IF;

  CREATE TABLE instruments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE RESTRICT,
    asset_type text NOT NULL CHECK (asset_type IN ('STOCK', 'MUTUAL_FUND', 'GOLD', 'DEBT_OTHER')),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
    exchange text,
    trading_symbol text,
    fyers_symbol text,
    isin text,
    unit text NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 30),
    currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (portfolio_id, id),
    CHECK ((exchange IS NULL AND trading_symbol IS NULL AND fyers_symbol IS NULL) OR
      (exchange IS NOT NULL AND trading_symbol IS NOT NULL AND fyers_symbol IS NOT NULL AND length(trim(exchange)) > 0 AND length(trim(trading_symbol)) > 0 AND length(trim(fyers_symbol)) > 0))
  );
  CREATE UNIQUE INDEX instruments_active_symbol ON instruments(portfolio_id, exchange, trading_symbol)
    WHERE is_active AND exchange IS NOT NULL;

  CREATE TABLE investment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE RESTRICT,
    instrument_id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('BUY', 'SELL', 'INCOME', 'FEE', 'ADJUSTMENT')),
    transaction_date date NOT NULL,
    sequence integer NOT NULL DEFAULT 0 CHECK (sequence >= 0),
    quantity numeric(28,10),
    unit_price numeric(24,8),
    amount numeric(24,8),
    fees numeric(24,8) NOT NULL DEFAULT 0,
    taxes numeric(24,8) NOT NULL DEFAULT 0,
    currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'CSV')),
    external_reference text,
    notes text,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    voided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (portfolio_id, instrument_id) REFERENCES instruments(portfolio_id, id) ON DELETE RESTRICT,
    UNIQUE (portfolio_id, instrument_id, id),
    CHECK (quantity IS NULL OR (quantity > 0 AND quantity < 1000000000000000000)),
    CHECK (unit_price IS NULL OR (unit_price >= 0 AND unit_price < 10000000000000000)),
    CHECK (amount IS NULL OR (amount >= 0 AND amount < 10000000000000000)),
    CHECK (fees >= 0 AND fees < 10000000000000000 AND taxes >= 0 AND taxes < 10000000000000000),
    CHECK (type NOT IN ('BUY', 'SELL') OR (quantity IS NOT NULL AND unit_price IS NOT NULL)),
    CHECK (type NOT IN ('INCOME', 'FEE') OR amount IS NOT NULL)
  );
  CREATE INDEX investment_transactions_ledger ON investment_transactions(portfolio_id, instrument_id, transaction_date, sequence, id) WHERE voided_at IS NULL;
  CREATE UNIQUE INDEX investment_transactions_external_reference ON investment_transactions(portfolio_id, external_reference)
    WHERE external_reference IS NOT NULL AND voided_at IS NULL;

  CREATE TABLE price_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE RESTRICT,
    instrument_id uuid NOT NULL,
    source text NOT NULL CHECK (source IN ('FYERS', 'MANUAL')),
    interval_type text NOT NULL CHECK (interval_type IN ('QUOTE', 'DAY', 'MANUAL')),
    market_date date NOT NULL,
    observed_at timestamptz,
    price numeric(24,8) NOT NULL CHECK (price >= 0 AND price < 10000000000000000),
    adjustment_basis text NOT NULL DEFAULT 'UNKNOWN' CHECK (adjustment_basis IN ('UNKNOWN', 'RAW', 'ADJUSTED')),
    retrieved_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (portfolio_id, instrument_id) REFERENCES instruments(portfolio_id, id) ON DELETE RESTRICT,
    UNIQUE (portfolio_id, instrument_id, source, interval_type, market_date),
    UNIQUE (portfolio_id, instrument_id, id),
    CHECK ((source = 'MANUAL' AND interval_type = 'MANUAL') OR (source = 'FYERS' AND interval_type IN ('QUOTE', 'DAY')))
  );
  CREATE INDEX price_observations_history ON price_observations(portfolio_id, instrument_id, market_date DESC);

  CREATE TABLE ticker_period_baselines (
    portfolio_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    period text NOT NULL CHECK (period IN ('7D', '30D', '60D', '90D', '6M', '365D')),
    as_of_date date NOT NULL,
    target_date date NOT NULL CHECK (target_date <= as_of_date),
    observation_id uuid,
    status text NOT NULL CHECK (status IN ('AVAILABLE', 'UNAVAILABLE')),
    checked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (portfolio_id, instrument_id, period, as_of_date),
    FOREIGN KEY (portfolio_id, instrument_id) REFERENCES instruments(portfolio_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (portfolio_id, instrument_id, observation_id) REFERENCES price_observations(portfolio_id, instrument_id, id) ON DELETE RESTRICT,
    CHECK ((status = 'AVAILABLE' AND observation_id IS NOT NULL) OR (status = 'UNAVAILABLE' AND observation_id IS NULL))
  );

  CREATE TABLE sale_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    buy_transaction_id uuid NOT NULL,
    sell_transaction_id uuid NOT NULL,
    quantity numeric(28,10) NOT NULL CHECK (quantity > 0 AND quantity < 1000000000000000000),
    allocated_cost numeric(24,8) NOT NULL CHECK (allocated_cost >= 0 AND allocated_cost < 10000000000000000),
    allocated_proceeds numeric(24,8) NOT NULL CHECK (allocated_proceeds >= 0 AND allocated_proceeds < 10000000000000000),
    calculation_version integer NOT NULL DEFAULT 1 CHECK (calculation_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (portfolio_id, instrument_id, buy_transaction_id) REFERENCES investment_transactions(portfolio_id, instrument_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (portfolio_id, instrument_id, sell_transaction_id) REFERENCES investment_transactions(portfolio_id, instrument_id, id) ON DELETE RESTRICT,
    CHECK (buy_transaction_id <> sell_transaction_id),
    UNIQUE (portfolio_id, buy_transaction_id, sell_transaction_id)
  );
  INSERT INTO schema_migrations(version) VALUES ('002_portfolio_data');
END
$migration$;
