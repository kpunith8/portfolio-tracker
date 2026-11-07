DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='012_purchase_import') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version='011_symbol_catalog') THEN RAISE EXCEPTION 'Migration 011 required'; END IF;
  CREATE TABLE purchase_import_batches (
    portfolio_id uuid NOT NULL REFERENCES portfolios(id),
    request_id uuid NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(portfolio_id, request_id)
  );
  EXECUTE $ddl$CREATE OR REPLACE FUNCTION import_portfolio_purchases(p_subject text, p_request uuid, p_rows jsonb, p_source text DEFAULT 'CSV')
RETURNS void LANGUAGE plpgsql AS $function$
DECLARE
  v_portfolio uuid; v_row jsonb; v_catalog fyers_symbol_catalog%ROWTYPE;
  v_instrument uuid; v_existing_symbol text; v_trade uuid; v_previous jsonb;
BEGIN
  IF p_subject IS NULL OR p_request IS NULL OR p_source NOT IN ('CSV','MANUAL') OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_IMPORT'; END IF;
  SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject=p_subject FOR UPDATE;
  IF v_portfolio IS NULL THEN RAISE EXCEPTION 'PORTFOLIO_NOT_FOUND'; END IF;
  SELECT payload INTO v_previous FROM purchase_import_batches WHERE portfolio_id=v_portfolio AND request_id=p_request;
  IF FOUND THEN
    IF v_previous <> jsonb_build_object('rows',p_rows,'source',p_source) THEN RAISE EXCEPTION 'IMPORT_KEY_CONFLICT'; END IF;
    RETURN;
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    SELECT * INTO v_catalog FROM fyers_symbol_catalog WHERE fyers_symbol=v_row->>'fyersSymbol';
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SYMBOL: %', v_row->>'fyersSymbol'; END IF;
    SELECT id, fyers_symbol INTO v_instrument, v_existing_symbol FROM instruments WHERE portfolio_id=v_portfolio AND exchange=v_catalog.exchange AND trading_symbol=v_catalog.trading_symbol AND is_active;
    IF v_instrument IS NOT NULL AND v_existing_symbol <> v_catalog.fyers_symbol THEN RAISE EXCEPTION 'SYMBOL_SERIES_CONFLICT: %', v_catalog.trading_symbol; END IF;
    IF v_instrument IS NULL THEN
      INSERT INTO instruments(portfolio_id,asset_type,name,exchange,trading_symbol,fyers_symbol,isin,unit)
      VALUES(v_portfolio,'STOCK',v_catalog.name,v_catalog.exchange,v_catalog.trading_symbol,v_catalog.fyers_symbol,NULLIF(v_catalog.isin,''),'share') RETURNING id INTO v_instrument;
    END IF;
    SELECT record_portfolio_trade(p_subject,'BUY',v_instrument,NULL,(v_row->>'quantity')::numeric,(v_row->>'price')::numeric,(v_row->>'date')::date,NULL) INTO v_trade;
    IF p_source='CSV' THEN UPDATE investment_transactions SET source='CSV', notes='Imported purchase; fees and taxes were not supplied.' WHERE id=v_trade AND portfolio_id=v_portfolio; END IF;
  END LOOP;
  INSERT INTO purchase_import_batches(portfolio_id,request_id,payload) VALUES(v_portfolio,p_request,jsonb_build_object('rows',p_rows,'source',p_source));
END
$function$;$ddl$;
  INSERT INTO schema_migrations(version) VALUES ('012_purchase_import');
END
$migration$;
