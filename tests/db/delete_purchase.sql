DO $test$
DECLARE
  p uuid := gen_random_uuid(); subj text := 'delete-test-' || p::text;
  buy_id uuid; other_buy uuid; instrument uuid; rejected boolean;
BEGIN
  INSERT INTO portfolios(id,kinde_subject) VALUES (p,subj), (gen_random_uuid(),subj || '-other');
  buy_id := record_portfolio_trade(subj,'BUY',NULL,'DELETE-TEST',10,100,'2020-01-01',NULL);
  SELECT instrument_id INTO instrument FROM investment_transactions WHERE id=buy_id;
  rejected := false;
  BEGIN PERFORM delete_portfolio_purchase(subj || '-other', buy_id);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='PURCHASE_NOT_FOUND' THEN rejected := true; ELSE RAISE; END IF; END;
  IF NOT rejected OR NOT EXISTS(SELECT 1 FROM investment_transactions WHERE id=buy_id) THEN RAISE EXCEPTION 'cross-user delete accepted'; END IF;
  other_buy := record_portfolio_trade(subj,'BUY',instrument,NULL,5,100,'2020-01-04',NULL);
  PERFORM record_portfolio_trade(subj,'SELL',instrument,NULL,1,100,'2020-01-02',buy_id);
  rejected := false;
  BEGIN PERFORM delete_portfolio_purchase(subj,buy_id);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='SALE_REPLAY_REQUIRED' THEN rejected := true; ELSE RAISE; END IF; END;
  IF NOT rejected OR NOT EXISTS(SELECT 1 FROM investment_transactions WHERE id=buy_id) THEN RAISE EXCEPTION 'unsafe delete accepted'; END IF;
  PERFORM delete_portfolio_purchase(subj,other_buy);
  IF EXISTS(SELECT 1 FROM investment_transactions WHERE id=other_buy) THEN RAISE EXCEPTION 'delete failed'; END IF;
  DELETE FROM sale_allocations WHERE portfolio_id=p;
  DELETE FROM investment_transactions WHERE portfolio_id=p;
  DELETE FROM instruments WHERE portfolio_id=p;
  DELETE FROM portfolios WHERE id=p OR kinde_subject = subj || '-other';
END
$test$;
