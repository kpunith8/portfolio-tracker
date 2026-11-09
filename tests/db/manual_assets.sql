BEGIN;
DO $test$
DECLARE
  p uuid := gen_random_uuid(); other_p uuid := gen_random_uuid(); asset uuid; debt uuid;
  req uuid := gen_random_uuid(); credit uuid := gen_random_uuid(); rows jsonb;
  caught boolean := false;
BEGIN
  INSERT INTO portfolios(id,kinde_subject) VALUES(p,'manual-test-owner'),(other_p,'manual-test-other');
  rows := '[{"name":"Example fund","date":"2024-01-01","quantity":"2.5","price":"100","expenseRatio":"0.5"}]'::jsonb;
  PERFORM import_manual_assets('manual-test-owner',req,'MUTUAL_FUND',rows,'CSV');
  PERFORM import_manual_assets('manual-test-owner',req,'MUTUAL_FUND',rows,'CSV');
  SELECT id INTO asset FROM instruments WHERE portfolio_id=p AND name='Example fund';
  IF (SELECT count(*) FROM manual_asset_entries WHERE instrument_id=asset) <> 1 THEN RAISE EXCEPTION 'Retry duplicated purchase'; END IF;
  BEGIN
    PERFORM import_manual_assets('manual-test-owner',req,'MUTUAL_FUND','[{"name":"Other","date":"2024-01-01","quantity":"1","price":"100","expenseRatio":""}]'::jsonb,'CSV');
  EXCEPTION WHEN OTHERS THEN caught := true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Changed retry accepted'; END IF;
  caught := false;
  BEGIN
    PERFORM import_manual_assets('manual-test-owner',gen_random_uuid(),'MUTUAL_FUND','[{"name":"Atomic fund","date":"2024-01-01","quantity":"1","price":"100","expenseRatio":""},{"name":"Bad fund","date":"2024-01-01","quantity":"invalid","price":"100","expenseRatio":""}]'::jsonb,'CSV');
  EXCEPTION WHEN OTHERS THEN caught := true; END;
  IF NOT caught OR EXISTS(SELECT 1 FROM instruments WHERE portfolio_id=p AND name='Atomic fund') THEN RAISE EXCEPTION 'Batch was not atomic'; END IF;
  PERFORM record_manual_observation('manual-test-owner',gen_random_uuid(),asset,'NAV','2024-12-31',120);
  caught := false;
  BEGIN
    PERFORM record_manual_observation('manual-test-other',gen_random_uuid(),asset,'NAV','2024-12-31',120);
  EXCEPTION WHEN OTHERS THEN caught := true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Cross-owner observation accepted'; END IF;
  rows := '[{"name":"PPF","date":"2024-01-01","quantity":"","price":"500","expenseRatio":""}]'::jsonb;
  PERFORM import_manual_assets('manual-test-owner',gen_random_uuid(),'DEBT_OTHER',rows,'MANUAL');
  SELECT id INTO debt FROM instruments WHERE portfolio_id=p AND name='PPF';
  PERFORM record_manual_observation('manual-test-owner',credit,debt,'INTEREST','2024-03-31',20);
  PERFORM record_manual_observation('manual-test-owner',credit,debt,'INTEREST','2024-03-31',20);
  IF (SELECT count(*) FROM manual_asset_entries WHERE instrument_id=debt AND entry_type='INTEREST') <> 1 THEN RAISE EXCEPTION 'Retry duplicated interest'; END IF;
  caught := false;
  BEGIN
    PERFORM record_manual_observation('manual-test-owner',gen_random_uuid(),debt,'NAV','2024-03-31',20);
  EXCEPTION WHEN OTHERS THEN caught := true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Invalid observation type accepted'; END IF;
END
$test$;
ROLLBACK;
