DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='013_manual_assets') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version='012_purchase_import') THEN RAISE EXCEPTION 'Migration 012 required'; END IF;
  ALTER TABLE instruments ADD COLUMN expense_ratio numeric(7,4) CHECK (expense_ratio IS NULL OR (expense_ratio BETWEEN 0 AND 100 AND asset_type='MUTUAL_FUND'));
  CREATE UNIQUE INDEX manual_instrument_name ON instruments(portfolio_id, asset_type, lower(trim(name))) WHERE is_active AND asset_type IN ('MUTUAL_FUND','DEBT_OTHER');
  CREATE TABLE manual_asset_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id uuid NOT NULL, instrument_id uuid NOT NULL,
    entry_type text NOT NULL CHECK (entry_type IN ('PURCHASE','INTEREST')),
    entry_date date NOT NULL, quantity numeric(24,8), amount numeric(24,8) NOT NULL CHECK (amount > 0),
    source text NOT NULL CHECK (source IN ('MANUAL','CSV')), created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (portfolio_id,instrument_id) REFERENCES instruments(portfolio_id,id),
    CHECK (quantity IS NULL OR quantity > 0)
  );
  CREATE INDEX manual_asset_entries_instrument ON manual_asset_entries(portfolio_id,instrument_id,entry_date);
  EXECUTE $ddl$
    CREATE FUNCTION import_manual_assets(p_subject text, p_request uuid, p_type text, p_rows jsonb, p_source text)
    RETURNS void LANGUAGE plpgsql AS $body$
    DECLARE v_portfolio uuid; v_row jsonb; v_instrument uuid; v_previous jsonb; v_payload jsonb;
    BEGIN
      IF p_subject IS NULL OR p_request IS NULL OR p_type NOT IN ('MUTUAL_FUND','DEBT_OTHER') OR p_source NOT IN ('MANUAL','CSV') OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_IMPORT'; END IF;
      SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject=p_subject FOR UPDATE;
      IF v_portfolio IS NULL THEN RAISE EXCEPTION 'PORTFOLIO_NOT_FOUND'; END IF;
      v_payload := jsonb_build_object('type',p_type,'source',p_source,'rows',p_rows);
      SELECT payload INTO v_previous FROM purchase_import_batches WHERE portfolio_id=v_portfolio AND request_id=p_request;
      IF FOUND THEN
        IF v_previous <> v_payload THEN RAISE EXCEPTION 'IMPORT_KEY_CONFLICT'; END IF;
        RETURN;
      END IF;
      FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        SELECT id INTO v_instrument FROM instruments WHERE portfolio_id=v_portfolio AND asset_type=p_type AND lower(trim(name))=lower(trim(v_row->>'name')) AND is_active;
        IF v_instrument IS NULL THEN
          INSERT INTO instruments(portfolio_id,asset_type,name,unit,expense_ratio)
          VALUES(v_portfolio,p_type,trim(v_row->>'name'),CASE WHEN p_type='MUTUAL_FUND' THEN 'unit' ELSE 'INR' END, CASE WHEN p_type='MUTUAL_FUND' THEN NULLIF(v_row->>'expenseRatio','')::numeric ELSE NULL END) RETURNING id INTO v_instrument;
        ELSIF p_type='MUTUAL_FUND' AND NULLIF(v_row->>'expenseRatio','') IS NOT NULL THEN
          UPDATE instruments SET expense_ratio=(v_row->>'expenseRatio')::numeric WHERE portfolio_id=v_portfolio AND id=v_instrument;
        END IF;
        INSERT INTO manual_asset_entries(portfolio_id,instrument_id,entry_type,entry_date,quantity,amount,source)
        VALUES(v_portfolio,v_instrument,'PURCHASE',(v_row->>'date')::date,CASE WHEN p_type='MUTUAL_FUND' THEN (v_row->>'quantity')::numeric ELSE NULL END,(v_row->>'price')::numeric,p_source);
      END LOOP;
      INSERT INTO purchase_import_batches(portfolio_id,request_id,payload) VALUES(v_portfolio,p_request,v_payload);
    END
    $body$;
  $ddl$;
  EXECUTE $ddl$
    CREATE FUNCTION record_manual_observation(p_subject text, p_request uuid, p_instrument uuid, p_kind text, p_date date, p_amount numeric)
    RETURNS void LANGUAGE plpgsql AS $body$
    DECLARE v_portfolio uuid; v_type text; v_previous jsonb; v_payload jsonb;
    BEGIN
      IF p_request IS NULL OR p_date IS NULL OR p_date > (now() AT TIME ZONE 'Asia/Kolkata')::date OR p_amount IS NULL OR p_amount <= 0 OR p_amount >= 10000000000000000 OR scale(p_amount)>8 THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
      SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject=p_subject FOR UPDATE;
      SELECT asset_type INTO v_type FROM instruments WHERE portfolio_id=v_portfolio AND id=p_instrument AND is_active;
      IF NOT ((v_type='MUTUAL_FUND' AND p_kind='NAV') OR (v_type='DEBT_OTHER' AND p_kind='INTEREST')) THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
      v_payload := jsonb_build_object('instrument',p_instrument,'kind',p_kind,'date',p_date,'amount',p_amount);
      SELECT payload INTO v_previous FROM purchase_import_batches WHERE portfolio_id=v_portfolio AND request_id=p_request;
      IF FOUND THEN
        IF v_previous <> v_payload THEN RAISE EXCEPTION 'IMPORT_KEY_CONFLICT'; END IF;
        RETURN;
      END IF;
      IF p_kind='NAV' THEN
        INSERT INTO price_observations(portfolio_id,instrument_id,source,interval_type,market_date,price)
        VALUES(v_portfolio,p_instrument,'MANUAL','MANUAL',p_date,p_amount)
;
      ELSE
        INSERT INTO manual_asset_entries(portfolio_id,instrument_id,entry_type,entry_date,amount,source)
        VALUES(v_portfolio,p_instrument,'INTEREST',p_date,p_amount,'MANUAL');
      END IF;
      INSERT INTO purchase_import_batches(portfolio_id,request_id,payload) VALUES(v_portfolio,p_request,v_payload);
    END
    $body$;
  $ddl$;
  INSERT INTO schema_migrations(version) VALUES ('013_manual_assets');
END
$migration$;
