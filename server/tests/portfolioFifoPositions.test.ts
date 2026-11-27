import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOpenFifoPositionsFromOrders } from '../lib/upstoxHistory';
import { normalizeUpstoxShortTermPositionsWithOrders } from '../lib/portfolioNormalize';

test('computeOpenFifoPositionsFromOrders & normalizeUpstoxShortTermPositionsWithOrders isolate true open cost basis on re-entered strikes and separate D vs I products', () => {
  const dayOrders = [
    {
      order_id: '101',
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 65,
      average_price: 6.05,
      status: 'complete',
      tag: 'bot_auto_entry',
      order_timestamp: '2026-11-17 14:03:31',
    },
    {
      order_id: '102',
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      transaction_type: 'SELL',
      quantity: 65,
      average_price: 8.55,
      status: 'complete',
      tag: 'bot_target_profit',
      order_timestamp: '2026-11-17 14:08:44',
    },
    {
      order_id: '103',
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 65,
      average_price: 8.2,
      status: 'complete',
      tag: 'bot_auto_entry',
      order_timestamp: '2026-11-17 14:09:40',
    },
    {
      order_id: '104',
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      transaction_type: 'SELL',
      quantity: 65,
      average_price: 8.55,
      status: 'complete',
      tag: 'bot_stop_loss',
      order_timestamp: '2026-11-17 14:10:33',
    },
    {
      order_id: '105',
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 65,
      average_price: 8.65,
      status: 'complete',
      tag: 'bot_auto_entry',
      order_timestamp: '2026-11-17 14:11:28',
    },
    {
      order_id: '106',
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      transaction_type: 'SELL',
      quantity: 65,
      average_price: 6.25,
      status: 'complete',
      tag: 'bot_stop_loss',
      order_timestamp: '2026-11-17 14:13:29',
    },
    {
      order_id: '107',
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 65,
      average_price: 5.65,
      status: 'complete',
      tag: null,
      order_timestamp: '2026-11-17 14:23:28',
    },
    // Same strike 25600CE closed in D earlier, then opened fresh in I
    {
      order_id: '108',
      instrument_token: 'NSE_FO|45414',
      trading_symbol: 'NIFTY26N1725600CE',
      product: 'D',
      transaction_type: 'BUY',
      quantity: 65,
      average_price: 6.6,
      status: 'complete',
      tag: 'bot_auto_entry',
      order_timestamp: '2026-11-17 12:52:36',
    },
    {
      order_id: '109',
      instrument_token: 'NSE_FO|45414',
      trading_symbol: 'NIFTY26N1725600CE',
      product: 'D',
      transaction_type: 'SELL',
      quantity: 65,
      average_price: 5.2,
      status: 'complete',
      tag: 'bot_stop_loss',
      order_timestamp: '2026-11-17 13:00:18',
    },
    {
      order_id: '110',
      instrument_token: 'NSE_FO|45414',
      trading_symbol: 'NIFTY26N1725600CE',
      product: 'I',
      transaction_type: 'BUY',
      quantity: 65,
      average_price: 2.0,
      status: 'complete',
      tag: null,
      order_timestamp: '2026-11-17 14:27:34',
    },
  ];

  const openLots = computeOpenFifoPositionsFromOrders(dayOrders);
  assert.equal(openLots['NSE_FO|45412|D']?.openAvgBuyPrice, 5.65);
  assert.equal(openLots['NSE_FO|45412|D']?.isBotManaged, false);
  assert.equal(openLots['NSE_FO|45414|D'], undefined);
  assert.equal(openLots['NSE_FO|45414|I']?.openAvgBuyPrice, 2.0);

  const rawPositions = [
    {
      instrument_token: 'NSE_FO|45412',
      trading_symbol: 'NIFTY26N1725550CE',
      product: 'D',
      quantity: 65,
      overnight_quantity: 0,
      day_buy_price: 7.14,
      buy_price: 7.1375,
      last_price: 5.95,
      realised: 124.8,
      pnl: 47.75,
    },
    {
      instrument_token: 'NSE_FO|45414',
      trading_symbol: 'NIFTY26N1725600CE',
      product: 'I',
      quantity: 65,
      overnight_quantity: 0,
      day_buy_price: 2.0,
      buy_price: 2.0,
      last_price: 2.15,
      realised: 0,
      pnl: 9.75,
    },
  ];

  const normalized = normalizeUpstoxShortTermPositionsWithOrders(rawPositions, dayOrders);
  assert.equal(normalized.length, 2);
  const pos25550 = normalized.find((p) => p.symbol === 'NIFTY26N1725550CE')!;
  assert.equal(
    pos25550.buyPrice,
    5.65,
    'Must use true open FIFO cost basis (₹5.65), NEVER Upstox cumulative ₹7.14',
  );
  assert.equal(pos25550.pnl, 19.5, 'Unrealized PnL at 5.95 vs 5.65 open lot must be +₹19.50');
  assert.equal(
    pos25550.realizedPnL,
    124.8,
    'Realized PnL from prior closed legs remains preserved',
  );

  const pos25600 = normalized.find((p) => p.symbol === 'NIFTY26N1725600CE')!;
  assert.equal(pos25600.buyPrice, 2.0);
  assert.equal(pos25600.productType, 'INTRADAY');
});
