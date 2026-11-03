CREATE OR REPLACE FUNCTION record_portfolio_trade(
  p_subject text, p_type text, p_instrument_id uuid, p_symbol text,
  p_quantity numeric, p_price numeric, p_date date, p_selected_buy uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $function$
DECLARE
  v_portfolio uuid; v_instrument uuid; v_trade uuid; v_sequence integer;
  v_remaining numeric; v_available numeric; v_take numeric; v_first boolean := true; v_lot record;
BEGIN
  IF p_type NOT IN ('BUY','SELL') OR p_subject IS NULL OR p_date IS NULL
    OR p_date > (now() AT TIME ZONE 'Asia/Kolkata')::date
    OR p_quantity IS NULL OR p_quantity <= 0 OR p_quantity >= 1000000000000000000 OR scale(p_quantity) > 10
    OR p_price IS NULL OR p_price < 0 OR p_price >= 10000000000000000 OR scale(p_price) > 8
  THEN RAISE EXCEPTION 'INVALID_TRADE'; END IF;
  SELECT id INTO v_portfolio FROM portfolios WHERE kinde_subject = p_subject FOR UPDATE;
  IF v_portfolio IS NULL THEN RAISE EXCEPTION 'PORTFOLIO_NOT_FOUND'; END IF;
  IF p_instrument_id IS NOT NULL THEN
    SELECT id INTO v_instrument FROM instruments WHERE id = p_instrument_id AND portfolio_id = v_portfolio AND asset_type = 'STOCK' AND is_active;
    IF v_instrument IS NULL THEN RAISE EXCEPTION 'INSTRUMENT_NOT_FOUND'; END IF;
  ELSIF p_type = 'BUY' AND p_symbol ~ '^[A-Z0-9&-]{1,30}$' THEN
    SELECT id INTO v_instrument FROM instruments WHERE portfolio_id = v_portfolio AND exchange = 'NSE' AND trading_symbol = p_symbol AND is_active;
    IF v_instrument IS NULL THEN
      INSERT INTO instruments(portfolio_id, asset_type, name, exchange, trading_symbol, fyers_symbol, unit)
        VALUES(v_portfolio, 'STOCK', p_symbol, 'NSE', p_symbol, 'NSE:' || p_symbol || '-EQ', 'share') RETURNING id INTO v_instrument;
    END IF;
  ELSE RAISE EXCEPTION 'INSTRUMENT_NOT_FOUND'; END IF;
  -- Historical insertions before a sale require replay, which this slice does not perform.
  IF EXISTS(SELECT 1 FROM investment_transactions WHERE portfolio_id = v_portfolio AND instrument_id = v_instrument AND type = 'SELL' AND voided_at IS NULL AND transaction_date > p_date) THEN
    RAISE EXCEPTION 'BACKDATED_REPLAY_REQUIRED';
  END IF;
  SELECT COALESCE(MAX(sequence), -1) + 1 INTO v_sequence FROM investment_transactions WHERE portfolio_id = v_portfolio AND instrument_id = v_instrument AND transaction_date = p_date;
  INSERT INTO investment_transactions(portfolio_id,instrument_id,type,transaction_date,sequence,quantity,unit_price)
    VALUES(v_portfolio,v_instrument,p_type,p_date,v_sequence,p_quantity,p_price) RETURNING id INTO v_trade;
  IF p_type = 'SELL' THEN
    v_remaining := p_quantity;
    FOR v_lot IN
      SELECT b.id, b.quantity, b.unit_price, b.fees, b.taxes,
        COALESCE((SELECT SUM(a.quantity) FROM sale_allocations a WHERE a.portfolio_id=v_portfolio AND a.buy_transaction_id=b.id),0) AS sold
      FROM investment_transactions b WHERE b.portfolio_id=v_portfolio AND b.instrument_id=v_instrument AND b.type='BUY' AND b.voided_at IS NULL AND b.transaction_date <= p_date
      ORDER BY b.transaction_date,b.sequence,b.id
    LOOP
      v_available := v_lot.quantity - v_lot.sold;
      IF v_available <= 0 THEN CONTINUE; END IF;
      IF v_first AND p_selected_buy IS NOT NULL AND v_lot.id <> p_selected_buy THEN RAISE EXCEPTION 'FIFO_OLDEST_FIRST'; END IF;
      v_first := false;
      IF p_selected_buy IS NOT NULL AND v_remaining > v_available THEN RAISE EXCEPTION 'LOT_QUANTITY_EXCEEDED'; END IF;
      v_take := LEAST(v_remaining, v_available);
      INSERT INTO sale_allocations(portfolio_id,instrument_id,buy_transaction_id,sell_transaction_id,quantity,allocated_cost,allocated_proceeds)
      VALUES(v_portfolio,v_instrument,v_lot.id,v_trade,v_take,round((v_lot.quantity*v_lot.unit_price+v_lot.fees+v_lot.taxes)*v_take/v_lot.quantity,8),round(v_take*p_price,8));
      v_remaining := v_remaining-v_take;
      EXIT WHEN v_remaining=0;
    END LOOP;
    IF v_remaining > 0 THEN RAISE EXCEPTION 'INSUFFICIENT_SHARES'; END IF;
  END IF;
  RETURN v_trade;
END
$function$;
