import test from 'node:test';
import assert from 'node:assert/strict';
import { pairHistoricalUpstoxTrades } from '../lib/upstoxHistory';

test('pairHistoricalUpstoxTrades pairs FY F&O round-trips, settles expired OTM bought options at 0, and ignores pre-FY unmatched equity sells', () => {
  const fo = [
    {
      trade_id: 'f1',
      symbol: 'NIFTY',
      strike_price: '25000.0',
      option_type: 'CE',
      expiry: '2026-11-10',
      transaction_type: 'BUY',
      quantity: 65,
      price: 100,
      amount: 6500,
      trade_date: '2026-11-10',
      exchange: 'NFO',
    },
    {
      trade_id: 'f2',
      symbol: 'NIFTY',
      strike_price: '25000.0',
      option_type: 'CE',
      expiry: '2026-11-10',
      transaction_type: 'SELL',
      quantity: 65,
      price: 120,
      amount: 7800,
      trade_date: '2026-11-10',
      exchange: 'NFO',
    },
    {
      trade_id: 'f3',
      symbol: 'NIFTY',
      strike_price: '24100.0',
      option_type: 'PE',
      expiry: '2026-07-21',
      transaction_type: 'BUY',
      quantity: 65,
      price: 59.35,
      amount: 3857.75,
      trade_date: '2026-07-20',
      exchange: 'NFO',
    },
  ];
  const eq = [
    {
      trade_id: 'e0',
      symbol: 'OLDDEMAT',
      isin: 'INE000000001',
      transaction_type: 'SELL',
      quantity: 10,
      price: 50,
      amount: 500,
      trade_date: '2026-07-22',
    },
    {
      trade_id: 'e1',
      symbol: 'HINDPETRO',
      isin: 'INE094A01015',
      transaction_type: 'BUY',
      quantity: 10,
      price: 396.75,
      amount: 3967.5,
      trade_date: '2026-07-20',
    },
    {
      trade_id: 'e2',
      symbol: 'HINDPETRO',
      isin: 'INE094A01015',
      transaction_type: 'SELL',
      quantity: 10,
      price: 397.65,
      amount: 3976.5,
      trade_date: '2026-07-20',
    },
  ];

  const hist = pairHistoricalUpstoxTrades(fo, eq, '2026-11-16');
  assert.equal(hist.length, 3);
  const niftyWin = hist.find((t) => t.symbol === 'NIFTY 25000 CE')!;
  const niftyExp = hist.find((t) => t.symbol === 'NIFTY 24100 PE')!;
  const hp = hist.find((t) => t.symbol === 'HINDPETRO')!;
  assert.equal(niftyWin.realizedPnL, 1300);
  assert.equal(niftyExp.realizedPnL, -3857.75);
  assert.equal(hp.realizedPnL, 9);
});

test('pairHistoricalUpstoxTrades sorts trade_id numerically, consolidates split fills without inflating flat ₹20 brokerage, and falls back to scrip_name when BSE symbol is blank', () => {
  const fo = [
    {
      trade_id: '2967550',
      symbol: 'NIFTY',
      strike_price: '24750.0',
      option_type: 'PE',
      expiry: '2026-11-09',
      transaction_type: 'SELL',
      quantity: 65,
      price: 24.25,
      amount: 1576.25,
      trade_date: '2026-11-09',
      exchange: 'NFO',
    },
    {
      trade_id: '422328',
      symbol: 'NIFTY',
      strike_price: '24750.0',
      option_type: 'PE',
      expiry: '2026-11-09',
      transaction_type: 'SELL',
      quantity: 65,
      price: 37.1,
      amount: 2411.5,
      trade_date: '2026-11-09',
      exchange: 'NFO',
    },
    {
      trade_id: '233618',
      symbol: 'NIFTY',
      strike_price: '24750.0',
      option_type: 'PE',
      expiry: '2026-11-09',
      transaction_type: 'BUY',
      quantity: 65,
      price: 31.35,
      amount: 2037.75,
      trade_date: '2026-11-09',
      exchange: 'NFO',
    },
    {
      trade_id: '597019',
      symbol: 'NIFTY',
      strike_price: '24750.0',
      option_type: 'PE',
      expiry: '2026-11-09',
      transaction_type: 'BUY',
      quantity: 65,
      price: 38.35,
      amount: 2492.75,
      trade_date: '2026-11-09',
      exchange: 'NFO',
    },
  ];
  const eq = [
    {
      trade_id: '2261888',
      symbol: 'AXISBANK',
      isin: 'INE238A01034',
      transaction_type: 'BUY',
      quantity: 3,
      price: 1350,
      amount: 4050,
      trade_date: '2026-07-03',
    },
    {
      trade_id: '7789690',
      symbol: 'AXISBANK',
      isin: 'INE238A01034',
      transaction_type: 'SELL',
      quantity: 1,
      price: 1340,
      amount: 1340,
      trade_date: '2026-07-03',
    },
    {
      trade_id: '7789691',
      symbol: 'AXISBANK',
      isin: 'INE238A01034',
      transaction_type: 'SELL',
      quantity: 2,
      price: 1340,
      amount: 2680,
      trade_date: '2026-07-03',
    },
    {
      trade_id: '972900',
      symbol: '',
      scrip_name: 'A-1 Acid Limited',
      isin: 'INE911Z01025',
      instrument_token: 'BSE_EQ|INE911Z01025',
      transaction_type: 'BUY',
      quantity: 30,
      price: 7.35,
      amount: 220.5,
      trade_date: '2026-06-25',
    },
    {
      trade_id: '1203400',
      symbol: '',
      scrip_name: 'A-1 Acid Limited',
      isin: 'INE911Z01025',
      instrument_token: 'BSE_EQ|INE911Z01025',
      transaction_type: 'SELL',
      quantity: 30,
      price: 7.41,
      amount: 222.3,
      trade_date: '2026-06-25',
    },
  ];

  const hist = pairHistoricalUpstoxTrades(fo, eq, '2026-11-16');
  const niftyTrades = hist.filter((t) => t.symbol === 'NIFTY 24750 PE');
  assert.equal(niftyTrades.length, 2);
  const firstNifty = niftyTrades.find((t) => t.buyPrice === 31.35)!;
  assert.equal(firstNifty.sellPrice, 37.1);
  assert.equal(firstNifty.realizedPnL, 373.75);

  const axisTrades = hist.filter((t) => t.symbol === 'AXISBANK');
  assert.equal(axisTrades.length, 1, 'Split SELL fills at same price must merge into 1 round-trip');
  assert.equal(axisTrades[0].quantity, 3);
  assert.equal(axisTrades[0].realizedPnL, -30);

  const bseFallback = hist.find((t) => t.symbol === 'A-1 ACID LIMITED')!;
  assert.ok(bseFallback);
  assert.equal(bseFallback.instrumentKey, 'BSE_EQ|INE911Z01025');
  assert.equal(bseFallback.realizedPnL, 1.8);
});
