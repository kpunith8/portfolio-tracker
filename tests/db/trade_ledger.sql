DO $test$
DECLARE
  p uuid := gen_random_uuid(); subj text := 'ledger-test-' || p::text; b1 uuid; b2 uuid; inst uuid; s uuid; rejected boolean; remaining numeric;
BEGIN
  INSERT INTO portfolios(id,kinde_subject) VALUES(p,subj), (gen_random_uuid(), subj || '-other');
  b1 := record_portfolio_trade(subj,'BUY',NULL,'TEST',10,100,'2020-01-01',NULL);
  SELECT instrument_id INTO inst FROM investment_transactions WHERE id=b1;
  b2 := record_portfolio_trade(subj,'BUY',inst,NULL,5,200,'2020-01-02',NULL);
  rejected := false;
  BEGIN PERFORM record_portfolio_trade(subj,'BUY',inst,NULL,1.5,100,'2020-01-02',NULL);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'STOCK_WHOLE_QUANTITY_REQUIRED' THEN rejected := true; ELSE RAISE; END IF; END;
  IF NOT rejected THEN RAISE EXCEPTION 'fractional stock quantity was accepted'; END IF;

  rejected := false;
  BEGIN PERFORM record_portfolio_trade(subj || '-other','BUY',inst,NULL,1,100,'2020-01-02',NULL);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'INSTRUMENT_NOT_FOUND' THEN rejected := true; ELSE RAISE; END IF; END;
  IF NOT rejected THEN RAISE EXCEPTION 'cross-user trade accepted'; END IF;
  s := record_portfolio_trade(subj,'SELL',inst,NULL,4,150,'2020-01-03',b1);
  SELECT quantity INTO remaining FROM sale_allocations WHERE sell_transaction_id=s AND buy_transaction_id=b1;
  IF remaining <> 4 THEN RAISE EXCEPTION 'wrong allocation'; END IF;
  rejected := false;
  BEGIN PERFORM record_portfolio_trade(subj,'SELL',inst,NULL,1,150,'2020-01-04',b2);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'FIFO_OLDEST_FIRST' THEN rejected := true; ELSE RAISE; END IF; END;
  IF NOT rejected THEN RAISE EXCEPTION 'FIFO not enforced'; END IF;
  rejected := false;
  BEGIN PERFORM record_portfolio_trade(subj,'SELL',inst,NULL,99,150,'2020-01-04',NULL);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'INSUFFICIENT_SHARES' THEN rejected := true; ELSE RAISE; END IF; END;
  IF NOT rejected THEN RAISE EXCEPTION 'oversell accepted'; END IF;
  rejected := false;
  BEGIN PERFORM record_portfolio_trade(subj,'BUY',inst,NULL,1,150,'2020-01-01',NULL);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'BACKDATED_REPLAY_REQUIRED' THEN rejected := true; ELSE RAISE; END IF; END;
  IF NOT rejected THEN RAISE EXCEPTION 'unsafe backdated buy accepted'; END IF;
  IF (SELECT count(*) FROM investment_transactions WHERE portfolio_id=p) <> 3 THEN RAISE EXCEPTION 'failed transactions were persisted'; END IF;
  DELETE FROM sale_allocations WHERE portfolio_id=p;
  DELETE FROM investment_transactions WHERE portfolio_id=p;
  DELETE FROM instruments WHERE portfolio_id=p;
  DELETE FROM portfolios WHERE id=p OR kinde_subject = subj || '-other';
END
$test$;
