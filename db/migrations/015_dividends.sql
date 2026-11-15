DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(591406218);
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='015_dividends') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version='014_debt_purchase_interest') THEN RAISE EXCEPTION 'Migration 014 required'; END IF;
  CREATE TABLE portfolio_dividends (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    isin text NOT NULL CHECK (isin ~ '^IN[A-Z0-9]{10}$'),
    company_name text NOT NULL CHECK (length(company_name) BETWEEN 1 AND 200),
    symbol text,
    ex_date date NOT NULL,
    shares numeric(24,8) NOT NULL CHECK (shares > 0),
    per_share numeric(24,8) NOT NULL CHECK (per_share >= 0),
    net_amount numeric(24,8) NOT NULL CHECK (net_amount >= 0),
    receipt_date date,
    withholding numeric(24,8) CHECK (withholding >= 0),
    source text NOT NULL CHECK (source IN ('STATEMENT_PDF')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (portfolio_id, isin, ex_date)
  );
  CREATE INDEX portfolio_dividends_date ON portfolio_dividends(portfolio_id, ex_date);
  EXECUTE $ddl$
  CREATE FUNCTION import_portfolio_dividends(p_subject text, p_request uuid, p_rows jsonb) RETURNS integer LANGUAGE plpgsql AS $body$
  DECLARE v_portfolio uuid; v_previous jsonb; v_row jsonb; v_payload jsonb; v_existing portfolio_dividends%ROWTYPE; v_count integer := 0; v_symbol text;
  BEGIN
    IF p_subject IS NULL OR p_request IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_IMPORT'; END IF;
    SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject=p_subject FOR UPDATE;
    IF v_portfolio IS NULL THEN RAISE EXCEPTION 'PORTFOLIO_NOT_FOUND'; END IF;
    v_payload := jsonb_build_object('kind','DIVIDEND_PDF','rows',p_rows);
    SELECT payload INTO v_previous FROM purchase_import_batches WHERE portfolio_id=v_portfolio AND request_id=p_request;
    IF FOUND THEN
      IF v_previous <> v_payload THEN RAISE EXCEPTION 'IMPORT_KEY_CONFLICT'; END IF;
      RETURN 0;
    END IF;
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
      IF (v_row->>'isin') !~ '^IN[A-Z0-9]{10}$' OR length(trim(v_row->>'company')) NOT BETWEEN 1 AND 200 OR (v_row->>'exDate') !~ '^\d{4}-\d{2}-\d{2}$' OR (v_row->>'shares') !~ '^\d{1,16}(\.\d{1,8})?$' OR (v_row->>'perShare') !~ '^\d{1,16}(\.\d{1,8})?$' OR (v_row->>'netAmount') !~ '^\d{1,16}(\.\d{1,8})?$' THEN RAISE EXCEPTION 'INVALID_DIVIDEND'; END IF;
      SELECT * INTO v_existing FROM portfolio_dividends WHERE portfolio_id=v_portfolio AND isin=v_row->>'isin' AND ex_date=(v_row->>'exDate')::date;
      IF FOUND THEN
        IF v_existing.shares<>(v_row->>'shares')::numeric OR v_existing.per_share<>(v_row->>'perShare')::numeric OR v_existing.net_amount<>(v_row->>'netAmount')::numeric THEN RAISE EXCEPTION 'DIVIDEND_CONFLICT'; END IF;
        CONTINUE;
      END IF;
      SELECT CASE WHEN count(DISTINCT trading_symbol)=1 THEN min(trading_symbol) END INTO v_symbol FROM fyers_symbol_catalog WHERE isin=v_row->>'isin' AND exchange='NSE' AND (series='EQ' OR series IS NULL);
      INSERT INTO portfolio_dividends(portfolio_id,isin,company_name,symbol,ex_date,shares,per_share,net_amount,source)
      VALUES(v_portfolio,v_row->>'isin',trim(v_row->>'company'),v_symbol,(v_row->>'exDate')::date,(v_row->>'shares')::numeric,(v_row->>'perShare')::numeric,(v_row->>'netAmount')::numeric,'STATEMENT_PDF');
      v_count := v_count + 1;
    END LOOP;
    INSERT INTO purchase_import_batches(portfolio_id,request_id,payload) VALUES(v_portfolio,p_request,v_payload);
    RETURN v_count;
  END $body$;
  $ddl$;
  INSERT INTO schema_migrations(version) VALUES ('015_dividends');
END
$migration$;
