-- Runs atomically, deletes its temporary fixtures, and aborts on failure.
DO $test$
DECLARE
  first_portfolio uuid := gen_random_uuid();
  second_portfolio uuid := gen_random_uuid();
  first_instrument uuid := gen_random_uuid();
  first_transaction uuid := gen_random_uuid();
  caught boolean;
BEGIN
  INSERT INTO portfolios(id, kinde_subject) VALUES
    (first_portfolio, 'schema-test-' || first_portfolio::text),
    (second_portfolio, 'schema-test-' || second_portfolio::text);
  INSERT INTO instruments(id, portfolio_id, asset_type, name, unit)
    VALUES (first_instrument, first_portfolio, 'STOCK', 'schema test', 'share');
  INSERT INTO investment_transactions(id, portfolio_id, instrument_id, type, transaction_date, quantity, unit_price)
    VALUES (first_transaction, first_portfolio, first_instrument, 'BUY', current_date, 2, 100.25);
  caught := false;
  BEGIN
    INSERT INTO investment_transactions(portfolio_id, instrument_id, type, transaction_date, quantity, unit_price)
      VALUES (second_portfolio, first_instrument, 'BUY', current_date, 1, 1);
  EXCEPTION WHEN foreign_key_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Cross-portfolio instrument reference was accepted'; END IF;
  caught := false;
  BEGIN
    INSERT INTO investment_transactions(portfolio_id, instrument_id, type, transaction_date, quantity, unit_price)
      VALUES (first_portfolio, first_instrument, 'BUY', current_date, -1, 1);
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Negative buy quantity was accepted'; END IF;
  caught := false;
  BEGIN
    INSERT INTO ticker_period_baselines(portfolio_id, instrument_id, period, as_of_date, target_date, status)
      VALUES (first_portfolio, first_instrument, '7D', current_date, current_date - 7, 'AVAILABLE');
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Available baseline without observation was accepted'; END IF;
  INSERT INTO ticker_period_baselines(portfolio_id, instrument_id, period, as_of_date, target_date, market_date, price, status)
    VALUES (first_portfolio, first_instrument, '7D', current_date, current_date - 7, current_date - 8, 100.25, 'AVAILABLE');
  INSERT INTO ticker_period_baselines(portfolio_id, instrument_id, period, as_of_date, target_date, market_date, price, status)
    VALUES (first_portfolio, first_instrument, '7D', current_date + 1, current_date - 6, current_date - 7, 101, 'AVAILABLE')
    ON CONFLICT (portfolio_id, instrument_id, period) DO UPDATE
      SET as_of_date = EXCLUDED.as_of_date, target_date = EXCLUDED.target_date, market_date = EXCLUDED.market_date, price = EXCLUDED.price;
  IF (SELECT count(*) FROM ticker_period_baselines WHERE portfolio_id = first_portfolio AND instrument_id = first_instrument) <> 1 THEN
    RAISE EXCEPTION 'Baseline replacement created more than one row';
  END IF;
  caught := false;
  BEGIN
    INSERT INTO price_observations(portfolio_id, instrument_id, source, interval_type, market_date, price)
      VALUES (first_portfolio, first_instrument, 'FYERS', 'DAY', current_date, 1);
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Daily FYERS observation was accepted'; END IF;
  DELETE FROM ticker_period_baselines WHERE portfolio_id = first_portfolio;
  DELETE FROM investment_transactions WHERE id = first_transaction;
  DELETE FROM instruments WHERE id = first_instrument;
  DELETE FROM portfolios WHERE id IN (first_portfolio, second_portfolio);
END
$test$;
