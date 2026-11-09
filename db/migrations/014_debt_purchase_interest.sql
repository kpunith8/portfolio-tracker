DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='014_debt_purchase_interest') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version='013_manual_assets') THEN RAISE EXCEPTION 'Migration 013 required'; END IF;
  ALTER TABLE manual_asset_entries ADD COLUMN purchase_id uuid;
  ALTER TABLE manual_asset_entries ADD COLUMN voided_at timestamptz;
  ALTER TABLE manual_asset_entries ADD CONSTRAINT manual_entries_identity UNIQUE (portfolio_id,instrument_id,id);
  ALTER TABLE manual_asset_entries ADD CONSTRAINT manual_entries_purchase_fk FOREIGN KEY (portfolio_id,instrument_id,purchase_id) REFERENCES manual_asset_entries(portfolio_id,instrument_id,id);
  ALTER TABLE manual_asset_entries ADD CONSTRAINT manual_entries_purchase_kind CHECK (purchase_id IS NULL OR entry_type='INTEREST');
  CREATE INDEX manual_entries_purchase ON manual_asset_entries(portfolio_id,instrument_id,purchase_id) WHERE purchase_id IS NOT NULL AND voided_at IS NULL;
  EXECUTE $ddl$
  CREATE FUNCTION record_debt_interest(p_subject text,p_request uuid,p_purchase uuid,p_date date,p_amount numeric) RETURNS void LANGUAGE plpgsql AS $body$
  DECLARE v_portfolio uuid; v_purchase manual_asset_entries%ROWTYPE; v_payload jsonb; v_previous jsonb;
  BEGIN
    IF p_request IS NULL OR p_date IS NULL OR p_date>(now() AT TIME ZONE 'Asia/Kolkata')::date OR p_amount IS NULL OR p_amount<=0 OR p_amount>=10000000000000000 OR scale(p_amount)>8 THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
    SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject=p_subject FOR UPDATE;
    SELECT e.* INTO v_purchase FROM manual_asset_entries e JOIN instruments i ON i.id=e.instrument_id AND i.portfolio_id=e.portfolio_id WHERE e.portfolio_id=v_portfolio AND e.id=p_purchase AND e.entry_type='PURCHASE' AND e.voided_at IS NULL AND i.asset_type='DEBT_OTHER' AND i.is_active;
    IF NOT FOUND OR p_date<v_purchase.entry_date THEN RAISE EXCEPTION 'INVALID_PURCHASE'; END IF;
    v_payload:=jsonb_build_object('purchase',p_purchase,'date',p_date,'amount',p_amount,'kind','DEBT_INTEREST');
    SELECT payload INTO v_previous FROM purchase_import_batches WHERE portfolio_id=v_portfolio AND request_id=p_request;
    IF FOUND THEN IF v_previous<>v_payload THEN RAISE EXCEPTION 'IMPORT_KEY_CONFLICT'; END IF; RETURN; END IF;
    INSERT INTO manual_asset_entries(portfolio_id,instrument_id,entry_type,entry_date,amount,source,purchase_id) VALUES(v_portfolio,v_purchase.instrument_id,'INTEREST',p_date,p_amount,'MANUAL',p_purchase);
    INSERT INTO purchase_import_batches(portfolio_id,request_id,payload) VALUES(v_portfolio,p_request,v_payload);
  END $body$;
  $ddl$;
  EXECUTE $ddl$
  CREATE FUNCTION void_debt_purchase(p_subject text,p_purchase uuid) RETURNS void LANGUAGE plpgsql AS $body$
  DECLARE v_portfolio uuid; v_purchase manual_asset_entries%ROWTYPE;
  BEGIN
    SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject=p_subject FOR UPDATE;
    SELECT e.* INTO v_purchase FROM manual_asset_entries e JOIN instruments i ON i.id=e.instrument_id AND i.portfolio_id=e.portfolio_id WHERE e.portfolio_id=v_portfolio AND e.id=p_purchase AND e.entry_type='PURCHASE' AND e.voided_at IS NULL AND i.asset_type='DEBT_OTHER' AND i.is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_NOT_FOUND'; END IF;
    IF EXISTS (SELECT 1 FROM manual_asset_entries WHERE portfolio_id=v_portfolio AND instrument_id=v_purchase.instrument_id AND entry_type='INTEREST' AND voided_at IS NULL AND (purchase_id=p_purchase OR purchase_id IS NULL)) THEN RAISE EXCEPTION 'INTEREST_EXISTS'; END IF;
    UPDATE manual_asset_entries SET voided_at=now() WHERE portfolio_id=v_portfolio AND id=p_purchase;
    IF NOT EXISTS(SELECT 1 FROM manual_asset_entries WHERE portfolio_id=v_portfolio AND instrument_id=v_purchase.instrument_id AND entry_type='PURCHASE' AND voided_at IS NULL) THEN UPDATE instruments SET is_active=false WHERE portfolio_id=v_portfolio AND id=v_purchase.instrument_id; END IF;
  END $body$;
  $ddl$;
  INSERT INTO schema_migrations(version) VALUES ('014_debt_purchase_interest');
END
$migration$;
