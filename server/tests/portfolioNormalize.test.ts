import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDeliverySoldHoldingPosition,
  normalizeUpstoxShortTermPosition,
  normalizeUpstoxShortTermPositionsList,
  shouldMonitorEquityPosition,
} from '../lib/portfolioNormalize';

test('normalizeUpstoxShortTermPositionsList excludes Delivery holdings sold today (TRIDENT -39, YESBANK -1, SUMEETINDS -1)', () => {
  const rawUpstoxPositions = [
    {
      exchange: 'BSE',
      product: 'D',
      instrument_token: 'BSE_EQ|INE064C01022',
      trading_symbol: 'TRIDENT',
      quantity: -39,
      day_buy_price: 0,
      buy_price: 0,
      average_price: 0,
      day_sell_price: 23.29,
      sell_price: 23.29282,
      last_price: 23.32,
      pnl: -1.17,
    },
    {
      exchange: 'NSE',
      product: 'D',
      instrument_token: 'NSE_EQ|INE235C01036',
      trading_symbol: 'SUMEETINDS',
      quantity: -1,
      buy_price: 10.7133,
      sell_price: 10.658,
      last_price: 10.79,
      pnl: -0.88,
    },
    {
      exchange: 'BSE',
      product: 'D',
      instrument_token: 'BSE_EQ|INE528G01035',
      trading_symbol: 'YESBANK',
      quantity: -1,
      buy_price: 17.55,
      sell_price: 17.605,
      last_price: 17.66,
      pnl: -0.01,
    },
  ];

  assert.equal(isDeliverySoldHoldingPosition(rawUpstoxPositions[0]), true);
  assert.equal(isDeliverySoldHoldingPosition(rawUpstoxPositions[1]), true);
  assert.equal(isDeliverySoldHoldingPosition(rawUpstoxPositions[2]), true);
  assert.deepEqual(normalizeUpstoxShortTermPositionsList(rawUpstoxPositions), []);
});

test('normalizeUpstoxShortTermPosition preserves valid Intraday short & Option BUY positions accurately', () => {
  const intradayShort = normalizeUpstoxShortTermPosition({
    product: 'I',
    instrument_token: 'NSE_EQ|INE081A01020',
    trading_symbol: 'TATASTEEL',
    quantity: -10,
    buy_price: 0,
    sell_price: 140,
    last_price: 138,
  });
  assert.ok(intradayShort);
  assert.equal(intradayShort.type, 'SELL');
  assert.equal(intradayShort.buyPrice, 140);
  assert.equal(intradayShort.pnl, 20);

  const optionLong = normalizeUpstoxShortTermPosition({
    product: 'D',
    instrument_token: 'NSE_FO|45001',
    trading_symbol: 'NIFTY 25400 CE',
    quantity: 65,
    buy_price: 45,
    last_price: 55,
    pnl: 650,
  });
  assert.ok(optionLong);
  assert.equal(optionLong.isOption, true);
  assert.equal(optionLong.type, 'BUY');
  assert.equal(optionLong.pnl, 650);
});

test('shouldMonitorEquityPosition blocks equity automation in OPTIONS_ONLY mode and on live manual DELIVERY positions', () => {
  assert.equal(
    shouldMonitorEquityPosition(
      {
        symbol: 'RELIANCE',
        isOption: false,
        productType: 'INTRADAY',
        buyPrice: 1200,
        quantity: 2,
        mode: 'UPSTOX_LIVE',
        isBotManaged: true,
      },
      'OPTIONS_ONLY',
    ),
    false,
  );
  assert.equal(
    shouldMonitorEquityPosition(
      {
        symbol: 'TRIDENT',
        isOption: false,
        productType: 'DELIVERY',
        type: 'SELL',
        buyPrice: 23,
        quantity: 39,
        mode: 'UPSTOX_LIVE',
      },
      'BOTH',
    ),
    false,
  );
  assert.equal(
    shouldMonitorEquityPosition(
      {
        symbol: 'TATASTEEL',
        isOption: false,
        productType: 'INTRADAY',
        buyPrice: 140,
        quantity: 5,
        mode: 'UPSTOX_LIVE',
        isBotManaged: true,
      },
      'BOTH',
    ),
    true,
  );
});
