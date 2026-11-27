import test from 'node:test';
import assert from 'node:assert/strict';
import { pairLiveDayOrders, computeOpenFifoPositionsFromOrders } from '../lib/upstoxHistory';

test('pairLiveDayOrders pairs chronological orders and normalizes SUMEETINDS-EQ vs SUMEETINDS', () => {
  const paired = pairLiveDayOrders([
    {
      order_id: '3',
      trading_symbol: 'YESBANK',
      transaction_type: 'SELL',
      product: 'D',
      quantity: 1,
      average_price: 17.68,
      order_timestamp: '2026-11-16 09:48:13',
      status: 'complete',
    },
    {
      order_id: '1',
      trading_symbol: 'SUMEETINDS-EQ',
      transaction_type: 'SELL',
      product: 'D',
      quantity: 15,
      average_price: 10.66,
      order_timestamp: '2026-11-16 09:36:34',
      status: 'complete',
    },
    {
      order_id: '2',
      trading_symbol: 'SUMEETINDS-EQ',
      transaction_type: 'BUY',
      product: 'D',
      quantity: 15,
      average_price: 10.71,
      order_timestamp: '2026-11-16 09:41:25',
      status: 'complete',
    },
    {
      order_id: '2b',
      trading_symbol: 'YESBANK',
      transaction_type: 'BUY',
      product: 'D',
      quantity: 1,
      average_price: 17.55,
      order_timestamp: '2026-11-16 09:41:34',
      status: 'complete',
    },
  ]);

  assert.equal(paired.length, 2);
  const yesbank = paired.find((t) => t.symbol === 'YESBANK')!;
  const sumeet = paired.find((t) => t.symbol === 'SUMEETINDS')!;
  assert.equal(yesbank.realizedPnL, 0.13);
  assert.equal(sumeet.realizedPnL, -0.75);
});

test('pairLiveDayOrders pairs today 5 SENSEX orders into strictly 2 closed round-trips (no phantom 3rd trade) and isolates 10:38 open buy', () => {
  const sensexOrders = [
    {
      order_id: '261119000063027',
      instrument_token: 'BSE_FO|823045',
      trading_symbol: 'SENSEX26N1983500CE',
      exchange: 'BFO',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 20,
      average_price: 4.9,
      order_timestamp: '2026-11-19 09:58:17',
      status: 'complete',
    },
    {
      order_id: '261119000063028',
      instrument_token: 'BSE_FO|823045',
      trading_symbol: 'SENSEX26N1983500CE',
      exchange: 'BFO',
      product: 'D',
      transaction_type: 'SELL',
      quantity: 20,
      average_price: 4.5,
      order_timestamp: '2026-11-19 10:05:19',
      status: 'complete',
    },
    {
      order_id: '261119000063029',
      instrument_token: 'BSE_FO|823041',
      trading_symbol: 'SENSEX26N1983400CE',
      exchange: 'BFO',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 20,
      average_price: 6.6,
      order_timestamp: '2026-11-19 10:06:30',
      status: 'complete',
    },
    {
      order_id: '261119000063030',
      instrument_token: 'BSE_FO|823041',
      trading_symbol: 'SENSEX26N1983400CE',
      exchange: 'BFO',
      product: 'D',
      transaction_type: 'SELL',
      quantity: 20,
      average_price: 5.55,
      order_timestamp: '2026-11-19 10:21:09',
      status: 'complete',
    },
    {
      order_id: '261119000063031',
      instrument_token: 'BSE_FO|823041',
      trading_symbol: 'SENSEX26N1983400CE',
      exchange: 'BFO',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 20,
      average_price: 4.35,
      order_timestamp: '2026-11-19 10:38:03',
      status: 'complete',
    },
  ];

  const paired = pairLiveDayOrders(sensexOrders);
  assert.equal(
    paired.length,
    2,
    'Must produce strictly 2 closed round-trip trades (never a 3rd phantom trade from open lot)',
  );
  const closedGross = Number(paired.reduce((s, t) => s + Number(t.realizedPnL || 0), 0).toFixed(2));
  assert.equal(closedGross, -29.0);
  const totalBrokerage = Number(
    paired.reduce((s, t) => s + Number(t.brokerageCharges || 0), 0).toFixed(2),
  );
  assert.ok(
    totalBrokerage >= 141.8 && totalBrokerage <= 142.2,
    `2 BSE round-trips must sum to ~₹141.94, got ${totalBrokerage}`,
  );

  const openLots = computeOpenFifoPositionsFromOrders(sensexOrders);
  assert.equal(
    openLots['BSE_FO|823041|D']?.openAvgBuyPrice,
    4.35,
    'Open lot must isolate 4.35 entry, not Upstox weighted average 5.40',
  );
});
