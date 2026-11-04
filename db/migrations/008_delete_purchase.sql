DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '008_delete_purchase') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '006_market_guardrails') THEN RAISE EXCEPTION 'Migration 006 required'; END IF;
  EXECUTE $sql$
    CREATE FUNCTION delete_portfolio_purchase(p_subject text, p_trade_id uuid)
    RETURNS void LANGUAGE plpgsql AS $body$
    DECLARE v_portfolio uuid; v_trade investment_transactions%ROWTYPE;
    BEGIN
      SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject = p_subject FOR UPDATE;
      IF v_portfolio IS NULL THEN RAISE EXCEPTION 'PURCHASE_NOT_FOUND'; END IF;
      SELECT * INTO v_trade FROM investment_transactions
        WHERE id = p_trade_id AND portfolio_id = v_portfolio AND type = 'BUY' AND voided_at IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_NOT_FOUND'; END IF;
      -- Later sales must be replayed to preserve allocation and cost history.
      IF EXISTS (SELECT 1 FROM investment_transactions WHERE portfolio_id = v_portfolio
        AND instrument_id = v_trade.instrument_id AND type = 'SELL' AND voided_at IS NULL
        AND transaction_date >= v_trade.transaction_date) THEN
        RAISE EXCEPTION 'SALE_REPLAY_REQUIRED';
      END IF;
      DELETE FROM investment_transactions WHERE id = v_trade.id AND portfolio_id = v_portfolio;
    END
    $body$;
  $sql$;
  INSERT INTO schema_migrations(version) VALUES ('008_delete_purchase');
END
$migration$;
