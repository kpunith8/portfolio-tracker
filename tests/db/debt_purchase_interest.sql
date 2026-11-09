BEGIN;
DO $test$
DECLARE p uuid := gen_random_uuid(); other_p uuid := gen_random_uuid(); inv uuid; buy uuid; request uuid:=gen_random_uuid(); caught boolean;
BEGIN
  INSERT INTO portfolios(id,kinde_subject) VALUES(p,'debt-interest-test'),(other_p,'debt-interest-other');
  INSERT INTO instruments(portfolio_id,asset_type,name,unit) VALUES(p,'DEBT_OTHER','PPF','INR') RETURNING id INTO inv;
  INSERT INTO manual_asset_entries(portfolio_id,instrument_id,entry_type,entry_date,amount,source) VALUES(p,inv,'PURCHASE','2020-01-01',100,'MANUAL') RETURNING id INTO buy;
  PERFORM record_debt_interest('debt-interest-test',request,buy,'2021-03-31',10);
  PERFORM record_debt_interest('debt-interest-test',request,buy,'2021-03-31',10);
  IF (SELECT count(*) FROM manual_asset_entries WHERE purchase_id=buy)<>1 THEN RAISE EXCEPTION 'Retry duplicated interest'; END IF;
  caught:=false; BEGIN PERFORM record_debt_interest('debt-interest-other',gen_random_uuid(),buy,'2021-03-31',10); EXCEPTION WHEN OTHERS THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Cross-owner interest accepted'; END IF;
  caught:=false; BEGIN PERFORM record_debt_interest('debt-interest-test',gen_random_uuid(),buy,'2019-03-31',10); EXCEPTION WHEN OTHERS THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Earlier interest date accepted'; END IF;
  caught:=false; BEGIN PERFORM void_debt_purchase('debt-interest-test',buy); EXCEPTION WHEN OTHERS THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Purchase with interest deleted'; END IF;
  INSERT INTO manual_asset_entries(portfolio_id,instrument_id,entry_type,entry_date,amount,source) VALUES(p,inv,'PURCHASE','2020-02-01',200,'MANUAL') RETURNING id INTO buy;
  caught:=false; BEGIN PERFORM void_debt_purchase('debt-interest-other',buy); EXCEPTION WHEN OTHERS THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Cross-owner delete accepted'; END IF;
  PERFORM void_debt_purchase('debt-interest-test',buy);
  IF (SELECT voided_at IS NULL FROM manual_asset_entries WHERE id=buy) THEN RAISE EXCEPTION 'Purchase not voided'; END IF;
END
$test$;
ROLLBACK;
