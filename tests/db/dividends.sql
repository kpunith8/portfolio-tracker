BEGIN;
INSERT INTO portfolios(kinde_subject) VALUES ('dividend-test-one'),('dividend-test-two');
INSERT INTO fyers_symbol_catalog(fyers_symbol,exchange,trading_symbol,name,isin,series) VALUES ('NSE:TEST-EQ','NSE','TEST','Test Ltd','INE123A01012','EQ');
DO $test$
DECLARE r jsonb := '[{"company":"Test Ltd","isin":"INE123A01012","exDate":"2025-06-15","shares":"10","perShare":"2.5","netAmount":"25.00"}]'::jsonb; n integer;
BEGIN
  SELECT import_portfolio_dividends('dividend-test-one','00000000-0000-4000-8000-000000000001',r) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'initial import failed'; END IF;
  SELECT import_portfolio_dividends('dividend-test-one','00000000-0000-4000-8000-000000000001',r) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'retry failed'; END IF;
  BEGIN
    PERFORM import_portfolio_dividends('dividend-test-one','00000000-0000-4000-8000-000000000001',r || r);
    RAISE EXCEPTION 'changed payload accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'IMPORT_KEY_CONFLICT' THEN RAISE; END IF; END;
  SELECT import_portfolio_dividends('dividend-test-one','00000000-0000-4000-8000-000000000002',r) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'duplicate failed'; END IF;
  SELECT import_portfolio_dividends('dividend-test-two','00000000-0000-4000-8000-000000000001',r) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'ownership failed'; END IF;
  IF (SELECT count(*) FROM portfolio_dividends WHERE isin='INE123A01012' AND symbol='TEST')<>2 THEN RAISE EXCEPTION 'catalog match failed'; END IF;
  BEGIN
    PERFORM import_portfolio_dividends('dividend-test-one','00000000-0000-4000-8000-000000000003','[{"company":"Other Ltd","isin":"INE456A01019","exDate":"2025-07-01","shares":"1","perShare":"1","netAmount":"1"},{"company":"Test Ltd","isin":"INE123A01012","exDate":"2025-06-15","shares":"10","perShare":"2.5","netAmount":"26"}]'::jsonb);
    RAISE EXCEPTION 'conflict was not rejected';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'DIVIDEND_CONFLICT' THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM portfolio_dividends WHERE isin='INE456A01019') THEN RAISE EXCEPTION 'partial import committed'; END IF;
  IF EXISTS(SELECT 1 FROM purchase_import_batches WHERE request_id='00000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'conflict committed'; END IF;
END $test$;
ROLLBACK;
