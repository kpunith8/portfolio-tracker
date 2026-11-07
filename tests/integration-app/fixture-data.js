export const instruments = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alpha Ltd",
    trading_symbol: "ALPHA",
    fyers_symbol: "NSE:ALPHA-EQ",
    unit: "share",
    price: "100",
    market_date: "2026-11-07",
    retrieved_at: "2026-11-07T00:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Beta Ltd",
    trading_symbol: "BETA",
    fyers_symbol: "NSE:BETA-EQ",
    unit: "share",
    price: "60",
    market_date: "2026-11-07",
    retrieved_at: "2026-11-07T00:00:00Z",
  },
];

export const transactions = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    instrument_id: instruments[0].id,
    type: "BUY",
    transaction_date: "2026-10-01",
    quantity: "20",
    unit_price: "80",
    fees: "0",
    taxes: "0",
    sold: "0",
    allocated_cost: "0",
    sale_cost: null,
    charges_missing: false,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    instrument_id: instruments[1].id,
    type: "BUY",
    transaction_date: "2026-10-15",
    quantity: "5",
    unit_price: "50",
    fees: "0",
    taxes: "0",
    sold: "0",
    allocated_cost: "0",
    sale_cost: null,
    charges_missing: false,
  },
];

export const history = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-11-0${index + 1}`,
  value: String(1700 + index * 100),
  alternate: false,
}));
