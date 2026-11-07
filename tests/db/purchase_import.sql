BEGIN;
DO $test$
DECLARE p uuid := gen_random_uuid(); other uuid := gen_random_uuid(); request uuid := gen_random_uuid(); payload jsonb := '[{"fyersSymbol":"NSE:TEST-EQ","quantity":"2","price":"12.34","date":"2020-01-01"}]';
BEGIN
  INSERT INTO portfolios(id,kinde_subject) VALUES(p,'purchase-test'),(other,'purchase-test-other');
  INSERT INTO fyers_symbol_catalog(fyers_symbol,exchange,trading_symbol,name) VALUES('NSE:TEST-EQ','NSE','TEST','Test company'),('BSE:OTHER-A','BSE','OTHER','Other company');
  PERFORM import_portfolio_purchases('purchase-test',request,payload,'CSV');
  PERFORM import_portfolio_purchases('purchase-test',request,payload,'CSV');
  IF (SELECT count(*) FROM investment_transactions WHERE portfolio_id=p) <> 1 THEN RAISE EXCEPTION 'retry duplicated purchase'; END IF;
  IF NOT EXISTS (SELECT 1 FROM investment_transactions WHERE portfolio_id=p AND source='CSV' AND notes='Imported purchase; fees and taxes were not supplied.') THEN RAISE EXCEPTION 'missing import provenance'; END IF;
  BEGIN
    PERFORM import_portfolio_purchases('purchase-test',request,'[{"fyersSymbol":"NSE:TEST-EQ","quantity":"3","price":"12.34","date":"2020-01-01"}]','CSV');
    RAISE EXCEPTION 'changed retry accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'IMPORT_KEY_CONFLICT' THEN RAISE; END IF; END;
  BEGIN
    PERFORM import_portfolio_purchases('purchase-test',gen_random_uuid(),'[{"fyersSymbol":"NSE:TEST-EQ","quantity":"1","price":"1","date":"2999-01-01"}]','CSV');
    RAISE EXCEPTION 'future date accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'INVALID_TRADE' THEN RAISE; END IF; END;
  BEGIN
    PERFORM import_portfolio_purchases('purchase-test',gen_random_uuid(),payload || '[{"fyersSymbol":"NSE:BAD-EQ","quantity":"1","price":"1","date":"2020-01-01"}]'::jsonb,'CSV');
    RAISE EXCEPTION 'invalid symbol accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'INVALID_SYMBOL:%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM investment_transactions WHERE portfolio_id=p) <> 1 THEN RAISE EXCEPTION 'failed batch did not roll back'; END IF;
  PERFORM import_portfolio_purchases('purchase-test-other',request,payload,'CSV');
  IF (SELECT count(*) FROM investment_transactions WHERE portfolio_id=other) <> 1 THEN RAISE EXCEPTION 'portfolio isolation failed'; END IF;
END
$test$;
ROLLBACK;
