import test from 'node:test';
import assert from 'node:assert/strict';
import { handleShortOptionExit } from '../services/bot/positionMonitor/shortOptionExit';

const ctx = { token: '', isEodSquareOff: false, isBtstHoldRecommended: false };

test('handleShortOptionExit ignores long option positions', async () => {
  const pos: any = {
    id: 'POS1',
    symbol: 'NIFTY 25000 CE',
    type: 'BUY',
    transactionType: 'BUY',
    isOption: true,
    buyPrice: 100,
    currentLTP: 120,
    quantity: 75,
  };
  assert.equal(await handleShortOptionExit(pos, ctx), false);
  assert.equal(pos.lockedStopLossPrice, undefined);
});

test('handleShortOptionExit ignores plain equity positions', async () => {
  const pos: any = { id: 'POS2', symbol: 'RELIANCE', type: 'SELL', buyPrice: 2900, quantity: 1 };
  assert.equal(await handleShortOptionExit(pos, ctx), false);
});

test('handleShortOptionExit caps the buy-back stop above entry while the short is not yet in profit', async () => {
  const pos: any = {
    id: 'POS3',
    symbol: 'NIFTY 25000 CE',
    instrumentKey: 'NSE_FO|NIFTY25NOV25000CE',
    type: 'SELL',
    transactionType: 'SELL',
    isOption: true,
    buyPrice: 100,
    currentLTP: 101,
    quantity: 75,
    mode: 'PAPER_TRADING',
    productType: 'INTRADAY',
  };
  assert.equal(await handleShortOptionExit(pos, ctx), false, 'a small adverse tick must not exit');
  assert.ok(
    pos.lockedStopLossPrice > pos.buyPrice,
    `stop must cap losses above entry, got ${pos.lockedStopLossPrice}`,
  );
  assert.ok(
    pos.lockedStopLossPrice <= pos.buyPrice + 400 / 75,
    'stop must respect the rupee loss cap',
  );
  assert.ok(pos.target < pos.buyPrice, 'target must sit below entry for a decay trade');
});

test('handleShortOptionExit trails the buy-back stop below entry once decay profit is banked', async () => {
  const pos: any = {
    id: 'POS4',
    symbol: 'NIFTY 25000 PE',
    instrumentKey: 'NSE_FO|NIFTY25NOV25000PE',
    type: 'SELL',
    transactionType: 'SELL',
    isOption: true,
    buyPrice: 100,
    currentLTP: 80,
    quantity: 75,
    mode: 'PAPER_TRADING',
    productType: 'INTRADAY',
  };
  assert.equal(await handleShortOptionExit(pos, ctx), false);
  assert.ok(
    pos.lockedStopLossPrice < pos.buyPrice,
    `banked profit must trail the stop below entry, got ${pos.lockedStopLossPrice}`,
  );
});

test('handleShortOptionExit squares off a paper short once the decay target is reached', async () => {
  const pos: any = {
    id: 'POS5',
    symbol: 'NIFTY 25000 CE',
    instrumentKey: 'NSE_FO|NIFTY25NOV25000CE',
    type: 'SELL',
    transactionType: 'SELL',
    isOption: true,
    buyPrice: 100,
    currentLTP: 40,
    quantity: 75,
    mode: 'PAPER_TRADING',
    productType: 'INTRADAY',
  };
  assert.equal(
    await handleShortOptionExit(pos, ctx),
    true,
    'decay target hit must close the short',
  );
  assert.equal(pos.target, 55, 'target stays at 55% of the entry premium');
});
