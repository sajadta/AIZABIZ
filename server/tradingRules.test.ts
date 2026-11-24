import test from 'node:test';
import assert from 'node:assert/strict';
import { isJwtTokenActuallyExpired } from './lib/tokens';
import {
  parseUpstoxFundsData,
  shouldUseProxyForUrl,
  evaluateProxyHealthCacheState,
} from './services/upstoxTransport';
import { resolveOptionChainSymbol } from './routes/market/optionChain';
import { calculateTradeCharges } from '../src/utils/indicators/tradeMath';
import { getInstrumentKey, MICRO_CAPITAL_EQUITY_UNIVERSE } from './lib/instruments';
import {
  isDeliverySoldHoldingPosition,
  normalizeUpstoxShortTermPosition,
  normalizeUpstoxShortTermPositionsList,
  computeEffectiveHoldingQuantity,
  shouldMonitorEquityPosition,
  normalizeUpstoxShortTermPositionsWithOrders,
} from './lib/portfolioNormalize';
import {
  pairLiveDayOrders,
  pairHistoricalUpstoxTrades,
  computeOpenFifoPositionsFromOrders,
} from './lib/upstoxHistory';
import {
  enforceOptionsOnlyConfig,
  evaluateOptionTradeProfitability,
  getCapitalTierOptionConstraints,
  evaluateOptionDipMomentum,
  validatePaperOrderInput,
} from './lib/optionTradeRules';
import { analyzeTradingSignals } from '../src/utils/indicators/signals';
import type { CandleData } from '../src/types';

function calculateOptionStopLoss(buyPrice: number, quantity: number, stopLossPercent: number) {
  const effectiveSlPct = Math.max(10.0, Math.min(18.0, Number(stopLossPercent || 14.0)));
  let optionSlPoints = Math.max(6.0, Number((buyPrice * (effectiveSlPct / 100)).toFixed(2)));
  if (buyPrice < 24) {
    optionSlPoints = Math.min(optionSlPoints, Number((buyPrice * 0.25).toFixed(2)));
  }
  const dynamicMaxRupeeLossCap = Math.max(380, Math.min(650, Math.round(optionSlPoints * quantity)));
  if (optionSlPoints * quantity > dynamicMaxRupeeLossCap) {
    optionSlPoints = Number((dynamicMaxRupeeLossCap / quantity).toFixed(2));
  }
  const stopLossPrice = Number(Math.max(0.10, buyPrice - optionSlPoints).toFixed(2));
  return {
    optionSlPoints,
    dynamicMaxRupeeLossCap,
    stopLossPrice,
    maxRupeeLoss: Math.round(optionSlPoints * quantity)
  };
}

function canEnterTradeAfterExit(lastExitTimeMs: number, currentTimeMs: number, cooldownMs: number = 180000): boolean {
  return (currentTimeMs - lastExitTimeMs) >= cooldownMs;
}

function makeMockJwt(expUnixSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: '5VCABX', exp: expUnixSeconds })).toString('base64url');
  return `${header}.${payload}.signature`;
}

test('calculateOptionStopLoss guarantees at least 6 points breathing room on option strike', () => {
  const res = calculateOptionStopLoss(50.0, 50, 12.0);
  assert.ok(res.optionSlPoints >= 6.0, 'SL points must be at least 6.0');
  assert.equal(res.stopLossPrice, 44.0);
  assert.ok(res.maxRupeeLoss >= 300, 'Max rupee loss must be at least ₹300 to survive 1m noise');
  assert.ok(res.maxRupeeLoss <= 650, 'Max rupee loss must not exceed safety cap ₹650');
});

test('calculateOptionStopLoss handles expensive options safely without blowing account cap', () => {
  const res = calculateOptionStopLoss(120.0, 50, 12.0);
  assert.ok(res.maxRupeeLoss <= 650, 'Account risk per trade capped safely');
  assert.ok(res.stopLossPrice < 120.0);
});

test('canEnterTradeAfterExit blocks revenge trading within 3-minute cooldown', () => {
  const exitTime = 1000000;
  // 30 seconds later -> must be blocked
  assert.equal(canEnterTradeAfterExit(exitTime, exitTime + 30000), false);
  // 2 minutes later -> must be blocked
  assert.equal(canEnterTradeAfterExit(exitTime, exitTime + 120000), false);
  // 3 minutes and 1 second later -> allowed
  assert.equal(canEnterTradeAfterExit(exitTime, exitTime + 181000), true);
});

test('isJwtTokenActuallyExpired validates real exp and rejects empty/corrupted tokens', () => {
  assert.equal(isJwtTokenActuallyExpired(''), true);
  assert.equal(isJwtTokenActuallyExpired('not-a-jwt'), true);
  assert.equal(isJwtTokenActuallyExpired('eyJhbGciOiJIUzI1NiJ9.!!!corrupted!!!.sig'), true);

  const nowSec = Math.floor(Date.now() / 1000);
  assert.equal(isJwtTokenActuallyExpired(makeMockJwt(nowSec + 3600)), false);
  assert.equal(isJwtTokenActuallyExpired(makeMockJwt(nowSec - 60)), true);
  assert.equal(isJwtTokenActuallyExpired(makeMockJwt(nowSec + 10)), true);
});

test('parseUpstoxFundsData extracts payin_amount, payout_amount, and commodity fallback cleanly', () => {
  const eqFunds = parseUpstoxFundsData({
    status: 'success',
    data: {
      equity: {
        available_margin: 524.59,
        used_margin: 120.0,
        payin_amount: 500,
        payout_amount: 50,
      },
      commodity: { available_margin: 0 },
    },
  });
  assert.equal(eqFunds.availableMargin, 524.59);
  assert.equal(eqFunds.usedMargin, 120.0);
  assert.equal(eqFunds.utilizedMargin, 120.0);
  assert.equal(eqFunds.payin, 500);
  assert.equal(eqFunds.payout, 50);

  const comFunds = parseUpstoxFundsData({
    status: 'success',
    data: {
      equity: { available_margin: 0, used_margin: 0 },
      commodity: { available_margin: 1500 },
    },
  });
  assert.equal(comFunds.availableMargin, 1500);
});

test('shouldUseProxyForUrl reserves proxy for orders/auth/portfolio and bypasses high-frequency read polling', () => {
  assert.equal(shouldUseProxyForUrl('https://api.upstox.com/v2/order/place'), true);
  assert.equal(shouldUseProxyForUrl('https://api.upstox.com/v2/user/profile'), true);
  assert.equal(shouldUseProxyForUrl('https://api.upstox.com/v2/portfolio/long-term-holdings'), true);
  assert.equal(shouldUseProxyForUrl('https://api.upstox.com/v2/market-quote/quotes?instrument_key=X'), false);
  assert.equal(shouldUseProxyForUrl('https://api.upstox.com/v2/historical-candle/intraday/X/1minute'), false);
  assert.equal(shouldUseProxyForUrl('https://api.upstox.com/v2/option/chain?instrument_key=X'), false);
  assert.equal(shouldUseProxyForUrl('https://api.upstox.com/v2/option/contract?instrument_key=X'), false);
});

test('evaluateProxyHealthCacheState uses stale-while-revalidate when online proxy TTL expires', () => {
  const proxyUrl = 'http://8.234.113.241:8888';
  const now = 1_000_000;
  // Fresh online cache stays online without refresh
  assert.deepEqual(
    evaluateProxyHealthCacheState({ url: proxyUrl, online: true, lastChecked: now - 5000 }, proxyUrl, now),
    { online: true, shouldRefresh: false },
  );
  // Expired online cache keeps routing via last-good proxy while triggering background refresh
  assert.deepEqual(
    evaluateProxyHealthCacheState({ url: proxyUrl, online: true, lastChecked: now - 35000 }, proxyUrl, now),
    { online: true, shouldRefresh: true },
  );
  // Changed proxy URL or unchecked cache starts offline and triggers refresh
  assert.deepEqual(
    evaluateProxyHealthCacheState({ url: 'http://other:8888', online: true, lastChecked: now - 1000 }, proxyUrl, now),
    { online: false, shouldRefresh: true },
  );
});

test('resolveOptionChainSymbol accepts either symbol or instrumentKey query parameter', () => {
  assert.equal(resolveOptionChainSymbol({ symbol: 'BANKNIFTY' }), 'BANKNIFTY');
  assert.equal(resolveOptionChainSymbol({ instrumentKey: 'BSE_INDEX|SENSEX' }), 'BSE_INDEX|SENSEX');
  assert.equal(resolveOptionChainSymbol({}), 'NIFTY 50');
});

test('calculateTradeCharges ensures micro equity trades pay < ₹1 brokerage so ₹524 margin compounds profitably', () => {
  // 14 shares of TRIDENT @ ₹35 = ₹490 trade value
  const eqCharges = calculateTradeCharges(35, 14, false, 36);
  assert.ok(eqCharges.roundTripCharges < 1.50, 'Micro equity round-trip brokerage must be under ₹1.50');
  assert.ok(eqCharges.totalRequiredWithBrokerage < 500, 'Total required must fit comfortably in ₹524.59 margin');

  // Conversely, option trades charge full F&O rates
  const optCharges = calculateTradeCharges(50, 65, true, 60);
  assert.ok(optCharges.roundTripCharges >= 40, 'Option round-trip brokerage includes F&O statutory minimums');
});

test('getInstrumentKey resolves liquid momentum stocks for micro-capital trading', () => {
  assert.equal(getInstrumentKey('TRIDENT'), 'NSE_EQ|INE064C01022');
  assert.equal(getInstrumentKey('SUZLON'), 'NSE_EQ|INE040H01021');
  assert.equal(getInstrumentKey('TATASTEEL'), 'NSE_EQ|INE081A01020');
  assert.ok(MICRO_CAPITAL_EQUITY_UNIVERSE.length >= 10, 'Must have at least 10 liquid stocks in micro-capital universe');
});

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
      { symbol: 'RELIANCE', isOption: false, productType: 'INTRADAY', buyPrice: 1200, quantity: 2, mode: 'UPSTOX_LIVE', isBotManaged: true },
      'OPTIONS_ONLY',
    ),
    false,
  );
  assert.equal(
    shouldMonitorEquityPosition(
      { symbol: 'TRIDENT', isOption: false, productType: 'DELIVERY', type: 'SELL', buyPrice: 23, quantity: 39, mode: 'UPSTOX_LIVE' },
      'BOTH',
    ),
    false,
  );
  assert.equal(
    shouldMonitorEquityPosition(
      { symbol: 'TATASTEEL', isOption: false, productType: 'INTRADAY', buyPrice: 140, quantity: 5, mode: 'UPSTOX_LIVE', isBotManaged: true },
      'BOTH',
    ),
    true,
  );
});

test('computeEffectiveHoldingQuantity subtracts cnc_used_quantity for holdings sold today', () => {
  assert.deepEqual(
    computeEffectiveHoldingQuantity({ quantity: 15, t1_quantity: 0, cnc_used_quantity: 1 }),
    { remainingQty: 14, soldTodayQty: 1, rawTotalQty: 15 },
  );
  assert.deepEqual(
    computeEffectiveHoldingQuantity({ quantity: 39, t1_quantity: 21, cnc_used_quantity: 39 }),
    { remainingQty: 0, soldTodayQty: 39, rawTotalQty: 60 },
  );
  assert.deepEqual(
    computeEffectiveHoldingQuantity({ quantity: 0, t1_quantity: 10, cnc_used_quantity: 0 }),
    { remainingQty: 10, soldTodayQty: 0, rawTotalQty: 10 },
  );
});

test('parseUpstoxFundsData exposes full available_margin as usableCash plus settledCash and deliverySellCredit when used_margin is negative', () => {
  const funds = parseUpstoxFundsData({
    status: 'success',
    data: {
      equity: {
        available_margin: 434.73,
        used_margin: -429.16,
      },
    },
  });
  assert.equal(funds.availableMargin, 434.73);
  assert.equal(funds.usableCash, 434.73);
  assert.equal(funds.settledCash, 5.57);
  assert.equal(funds.deliverySellCredit, 429.16);
});

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

test('enforceOptionsOnlyConfig locks tradeMode to OPTIONS_ONLY with high conviction settings', () => {
  const cfg: any = { tradeMode: 'STOCKS_ONLY', minConfidence: 50, minOptionProfitAmount: 10 };
  enforceOptionsOnlyConfig(cfg);
  assert.equal(cfg.tradeMode, 'OPTIONS_ONLY');
  assert.ok(cfg.minConfidence >= 78);
  assert.ok(cfg.minOptionProfitAmount >= 250);
  assert.equal(cfg.optionStrikeSelector, true);
});

test('evaluateOptionTradeProfitability rejects low Delta deep OTM lottery contracts', () => {
  const res = evaluateOptionTradeProfitability({
    symbol: 'SENSEX 84500 CE',
    strike: 84500,
    optionType: 'CE',
    ltp: 26.4,
    lotSize: 20,
    delta: 0.05, // deep OTM junk
    estimatedBrokerage: 55,
    expectedGrossGainPoints: 15,
    availableBalance: 10000,
  });
  assert.equal(res.eligible, false);
  assert.match(res.rejectReason || '', /ഡെൽറ്റ കുറവാണ്/);
});

test('evaluateOptionTradeProfitability rejects penny options under ₹25', () => {
  const res = evaluateOptionTradeProfitability({
    symbol: 'NIFTY 25650 CE',
    strike: 25650,
    optionType: 'CE',
    ltp: 7.55, // Penny contract
    lotSize: 65,
    delta: 0.45,
    estimatedBrokerage: 55,
    expectedGrossGainPoints: 2,
    availableBalance: 10000,
  });
  assert.equal(res.eligible, false);
  assert.match(res.rejectReason || '', /പ്രീമിയം വളരെ കുറവാണ്/);
});

test('evaluateOptionTradeProfitability rejects trades when expected net profit is below ₹250 or 2.5x brokerage', () => {
  const res = evaluateOptionTradeProfitability({
    symbol: 'NIFTY 25200 PE',
    strike: 25200,
    optionType: 'PE',
    ltp: 85,
    lotSize: 65,
    delta: 0.50,
    estimatedBrokerage: 65,
    expectedGrossGainPoints: 2.0, // gross = 130, net = 65 (< 250)
    availableBalance: 10000,
  });
  assert.equal(res.eligible, false);
  assert.match(res.rejectReason || '', /പ്രതീക്ഷിക്കുന്ന അറ്റ ലാഭം/);
});

test('evaluateOptionTradeProfitability enforces Capital Guard when account balance is insufficient', () => {
  const res = evaluateOptionTradeProfitability({
    symbol: 'NIFTY 25200 PE',
    strike: 25200,
    optionType: 'PE',
    ltp: 85,
    lotSize: 65, // premium = 5,525 + brokerage 65 = 5,590
    delta: 0.50,
    estimatedBrokerage: 65,
    expectedGrossGainPoints: 15, // gross = 975, net = 910
    availableBalance: 583.83, // User's live balance
  });
  assert.equal(res.eligible, false);
  assert.match(res.rejectReason || '', /ആവശ്യമായ തുക/);
  assert.ok(res.requiredCapital > 5500);
});

test('evaluateOptionTradeProfitability accepts high-conviction ATM contract with sufficient funds', () => {
  const res = evaluateOptionTradeProfitability({
    symbol: 'NIFTY 25200 PE',
    strike: 25200,
    optionType: 'PE',
    ltp: 85,
    lotSize: 65,
    delta: 0.52,
    estimatedBrokerage: 65,
    expectedGrossGainPoints: 12, // gross = 780, net = 715 (> 250)
    candleOpen: 84, // positive momentum (85 >= 84)
    availableBalance: 10000,
  });
  assert.equal(res.eligible, true);
  assert.ok(res.expectedNetProfit >= 700);
  assert.ok(res.requiredCapital > 5500);
});

test('getCapitalTierOptionConstraints adapts thresholds smoothly for Micro (<₹1250), Compact (₹1250–₹3500), and Standard capital without brokerage bleed', () => {
  const micro = getCapitalTierOptionConstraints(781.45, false);
  assert.equal(micro.tier, 'MICRO');
  assert.ok(micro.minLtp >= 8 && micro.minDelta >= 0.09);
  assert.ok(micro.maxBrokerageDragPct <= 0.14);
  assert.ok(micro.minVolume >= 100000);
  assert.ok(micro.getMinReqNetProfit(72) >= 110);

  const sub750Micro = getCapitalTierOptionConstraints(550.70, false);
  assert.equal(sub750Micro.tier, 'MICRO');
  assert.equal(sub750Micro.minLtp, 4.0);
  assert.equal(sub750Micro.minDelta, 0.06);
  assert.equal(sub750Micro.maxBrokerageDragPct, 0.25);
  assert.ok(sub750Micro.getMinReqNetProfit(72) >= 100);

  const bseMicro = getCapitalTierOptionConstraints(781.45, true);
  assert.equal(bseMicro.tier, 'MICRO');
  assert.equal(bseMicro.minVolume, 25000, 'BSE SENSEX 20-lot contracts scale minVolume down proportionally');
  assert.equal(bseMicro.minOi, 15000);

  const compact = getCapitalTierOptionConstraints(2000, false);
  assert.equal(compact.tier, 'COMPACT');
  assert.ok(compact.minLtp >= 10 && compact.minDelta >= 0.10);
  assert.ok(compact.maxBrokerageDragPct <= 0.08);
  assert.ok(compact.getMinReqNetProfit(72) >= 140);

  const standard = getCapitalTierOptionConstraints(15000, false);
  assert.equal(standard.tier, 'STANDARD');
  assert.equal(standard.minLtp, 25);
  assert.equal(standard.minDelta, 0.42);
  assert.ok(standard.maxBrokerageDragPct <= 0.06);
  assert.ok(standard.getMinReqNetProfit(72, 350) >= 350);

  // Nano live balance (₹182.39): supports SENSEX ₹5x20 (₹100) & NIFTY ₹2x65 (₹130) ONLY when runway net profit > ₹35 after ~₹71 brokerage
  const nanoNifty = getCapitalTierOptionConstraints(182.39, false, 'NIFTY 50');
  const nanoSensex = getCapitalTierOptionConstraints(182.39, true, 'SENSEX');
  const nanoBankNifty = getCapitalTierOptionConstraints(182.39, false, 'NIFTY BANK');
  const nanoFinNifty = getCapitalTierOptionConstraints(182.39, false, 'NIFTY FIN SERVICE');
  const nanoMidcp = getCapitalTierOptionConstraints(182.39, false, 'MIDCPNIFTY');
  const nanoBankex = getCapitalTierOptionConstraints(182.39, true, 'BANKEX');
  for (const c of [nanoNifty, nanoSensex, nanoBankNifty, nanoFinNifty, nanoMidcp, nanoBankex]) {
    assert.equal(c.tier, 'MICRO');
    assert.equal(c.minLtp, 1.5);
    assert.equal(c.minDelta, 0.02);
    assert.ok(c.maxStrikeDistPct >= 0.06);
    assert.ok(c.getMinReqNetProfit(71) >= 35);
  }
  assert.ok(nanoBankNifty.minVolume <= 5000 && nanoFinNifty.minVolume <= 5000 && nanoMidcp.minVolume <= 5000 && nanoBankex.minVolume <= 5000);

  const sensexCharges = calculateTradeCharges(5.0, 20, true, 11.0);
  const niftyNanoCharges = calculateTradeCharges(2.0, 65, true, 4.0);
  assert.ok(sensexCharges.tradeValue + sensexCharges.buyCharges <= 182.39, 'SENSEX ₹5x20 entry cash fits ₹182.39 margin');
  assert.ok(niftyNanoCharges.tradeValue + niftyNanoCharges.buyCharges <= 182.39, 'NIFTY ₹2x65 entry cash fits ₹182.39 margin');
  assert.ok((11 - 5) * 20 - sensexCharges.roundTripCharges >= nanoSensex.getMinReqNetProfit(sensexCharges.roundTripCharges));
  assert.ok((4 - 2) * 65 - niftyNanoCharges.roundTripCharges >= nanoNifty.getMinReqNetProfit(niftyNanoCharges.roundTripCharges));
});

test('evaluateOptionDipMomentum allows value dip pullbacks when underlying confirms while rejecting sharp crashes', () => {
  // Healthy pullback dip below stale chain snapshot (₹11.20 vs ₹11.50 snapshot) bouncing off ₹11.00 low
  const dipAllowed = evaluateOptionDipMomentum({
    liveOptLtp: 11.20,
    chainSnapshotLtp: 11.50,
    optLowestBase: 11.00,
    optOpen0: 11.25,
    optShortVwap: 11.30,
    optUpperWickRatio: 0.18,
    singleMinuteSpikePct: -0.44,
    isUnderlyingConfirming: true,
    isBaseMomentumOk: false,
  });
  assert.equal(dipAllowed, true);

  // Micro-option (<₹15) normal 9% tick bounce (+₹0.65 on ₹7.05) with 34% wick must be allowed when underlying confirms
  const microContinuationAllowed = evaluateOptionDipMomentum({
    liveOptLtp: 7.70,
    chainSnapshotLtp: 7.40,
    optLowestBase: 6.75,
    optOpen0: 7.05,
    optShortVwap: 7.15,
    optUpperWickRatio: 0.34,
    singleMinuteSpikePct: 9.22,
    isUnderlyingConfirming: true,
    isBaseMomentumOk: false,
  });
  assert.equal(microContinuationAllowed, true);

  // Flash crash (-15% drop vs snapshot) must be rejected
  const crashBlocked = evaluateOptionDipMomentum({
    liveOptLtp: 9.75,
    chainSnapshotLtp: 11.50,
    optLowestBase: 9.70,
    optOpen0: 11.25,
    optShortVwap: 11.00,
    optUpperWickRatio: 0.10,
    singleMinuteSpikePct: -13.3,
    isUnderlyingConfirming: true,
    isBaseMomentumOk: false,
  });
  assert.equal(crashBlocked, false);

  // Extreme vertical spike (+22% in 1m) on micro option still blocked
  const extremeSpikeBlocked = evaluateOptionDipMomentum({
    liveOptLtp: 8.60,
    chainSnapshotLtp: 7.40,
    optLowestBase: 6.75,
    optOpen0: 7.05,
    optShortVwap: 7.15,
    optUpperWickRatio: 0.15,
    singleMinuteSpikePct: 22.0,
    isUnderlyingConfirming: true,
    isBaseMomentumOk: false,
  });
  assert.equal(extremeSpikeBlocked, false);
});

test('calculateTradeCharges accurately models ₹30/order Upstox F&O brokerage (~₹72 round-trip) and rejects 16% fee-drag penny contracts', () => {
  // Actual live trade today: NIFTY 25650 CE BUY 65 @ ₹6.70 -> SELL @ ₹7.30 = +₹39 gross, ~₹72 charges = net loss
  const deepOtmCharges = calculateTradeCharges(6.70, 65, true, 7.30);
  assert.equal(deepOtmCharges.buyBrokerage, 30);
  assert.equal(deepOtmCharges.sellBrokerage, 30);
  assert.ok(deepOtmCharges.roundTripCharges >= 70 && deepOtmCharges.roundTripCharges <= 76);

  const microTier = getCapitalTierOptionConstraints(781.45, false);
  const deepOtmDragPct = deepOtmCharges.roundTripCharges / deepOtmCharges.tradeValue;
  assert.ok(deepOtmDragPct > microTier.maxBrokerageDragPct, '16.5% brokerage drag must be blocked');

  // Healthy near-ATM option (₹22.50 x 65 = ₹1,462.50): round-trip drag is ~5.1% <= 8%
  const qualityCharges = calculateTradeCharges(22.50, 65, true, 29.0);
  const qualityDragPct = qualityCharges.roundTripCharges / qualityCharges.tradeValue;
  assert.ok(qualityDragPct <= microTier.maxBrokerageDragPct, 'Quality option keeps fee drag <= 8%');
});

test('analyzeTradingSignals rejects narrow 12-bar sideways chop box as HOLD instead of triggering 0DTE chop entries', () => {
  // Reproduces NIFTY 12:00-12:25 25-pt (<0.10%) sideways chop box with EMA21 crossbacks & ADX ~17
  const baseTs = Date.UTC(2026, 10, 17, 6, 30, 0); // 12:00 IST
  const chopPrices = [
    25488, 25494, 25485, 25492, 25483, 25491, 25486, 25495, 25484, 25493,
    25487, 25494, 25485, 25491, 25486, 25492, 25488, 25493, 25487, 25492,
    25486, 25491, 25488, 25493, 25487, 25492, 25488, 25491, 25489, 25493,
  ];
  const candles: CandleData[] = chopPrices.map((close, idx) => ({
    time: new Date(baseTs + idx * 60_000).toISOString(),
    timestamp: baseTs + idx * 60_000,
    open: idx === 0 ? 25486 : chopPrices[idx - 1],
    high: Math.max(close, idx === 0 ? 25486 : chopPrices[idx - 1]) + 2.5,
    low: Math.min(close, idx === 0 ? 25486 : chopPrices[idx - 1]) - 2.5,
    close,
    volume: 1000,
    ema9: 25489,
    ema21: 25489.5,
    ema50: 25482,
    rsi: 54,
    supertrend: 25478,
    supertrendDir: 'BUY',
    macdHist: 0.45,
    adx: 17.5,
  }));

  const sig = analyzeTradingSignals('NIFTY 50', 'NIFTY 50', 'NSE_INDEX|Nifty 50', candles, 25493);
  assert.ok(sig);
  assert.equal(sig!.signalType, 'HOLD', 'Narrow 25-pt (<0.14%) chop box must stay HOLD to stop 0DTE theta chop losses');
});

test('analyzeTradingSignals vetoes counter-trend CE bounce below rolling 30m VWAP during midday crash & fires clean trend breakout', () => {
  // Morning rally from 25280 -> 25500 followed by 35-bar crash down to 25395 (still near old morning session VWAP,
  // but well below rolling 30-minute VWAP and with bearish clock-aligned 15m/5m bars).
  const startTs = Date.UTC(2026, 10, 17, 3, 45, 0); // 09:15 IST
  const candles: CandleData[] = [];
  for (let i = 0; i < 65; i++) {
    const ts = startTs + i * 60_000;
    let close: number;
    if (i < 30) {
      close = 25280 + i * 7.5; // +220pt rally -> 25505
    } else if (i < 63) {
      close = 25505 - (i - 29) * 3.5; // -115pt steady crash -> 25389.5
    } else {
      close = i === 63 ? 25392 : 25396; // Tiny +6.5pt dead-cat bounce
    }
    const prevC = i === 0 ? 25278 : candles[i - 1].close;
    const isCrash = i >= 30;
    candles.push({
      time: new Date(ts).toISOString(),
      timestamp: ts,
      open: prevC,
      high: Math.max(prevC, close) + 3,
      low: Math.min(prevC, close) - 3,
      close,
      volume: 10000,
      ema9: isCrash ? close + 6 : close - 5,
      ema21: isCrash ? close + 16 : close - 14,
      ema50: isCrash ? close + 28 : close - 25,
      rsi: isCrash ? 38 : 66,
      supertrend: isCrash ? close + 22 : close - 22,
      supertrendDir: isCrash ? 'SELL' : 'BUY',
      macdHist: isCrash ? -1.4 : 1.4,
      adx: 28,
    });
  }

  const counterTrendCeBounce = analyzeTradingSignals(
    'NIFTY 50',
    'NIFTY 50',
    'NSE_INDEX|Nifty 50',
    candles,
    25396,
  );
  assert.ok(counterTrendCeBounce);
  assert.notEqual(
    counterTrendCeBounce!.signalType,
    'BUY',
    'Tiny bounce inside a -115pt crash below rolling 30m VWAP must NEVER fire BUY (CE)',
  );

  // Now simulate clean breakdown continuation (last bar closes red at 25382 breaking lows) -> should allow high-conviction SELL (PE)
  const breakdownCandles = candles.slice(0, -2);
  breakdownCandles.push({
    ...candles[candles.length - 3],
    time: new Date(startTs + 63 * 60_000).toISOString(),
    timestamp: startTs + 63 * 60_000,
    open: 25393,
    high: 25394,
    low: 25384,
    close: 25385,
    ema9: 25392,
    ema21: 25405,
    ema50: 25420,
    rsi: 34,
    supertrend: 25410,
    supertrendDir: 'SELL',
    macdHist: -1.9,
    adx: 31,
  });
  breakdownCandles.push({
    ...candles[candles.length - 3],
    time: new Date(startTs + 64 * 60_000).toISOString(),
    timestamp: startTs + 64 * 60_000,
    open: 25385,
    high: 25386,
    low: 25374,
    close: 25376,
    ema9: 25386,
    ema21: 25400,
    ema50: 25418,
    rsi: 32,
    supertrend: 25405,
    supertrendDir: 'SELL',
    macdHist: -2.2,
    adx: 32,
  });

  const cleanBearBreakdown = analyzeTradingSignals(
    'NIFTY 50',
    'NIFTY 50',
    'NSE_INDEX|Nifty 50',
    breakdownCandles,
    25376,
  );
  assert.ok(cleanBearBreakdown);
  assert.equal(cleanBearBreakdown!.signalType, 'SELL', 'Aligned clock-MTF + rolling VWAP + breakdown must fire SELL (PE)');
  assert.ok(cleanBearBreakdown!.confidence >= 68);
});

test('computeOpenFifoPositionsFromOrders & normalizeUpstoxShortTermPositionsWithOrders isolate true open cost basis on re-entered strikes and separate D vs I products', () => {
  const dayOrders = [
    { order_id: '101', instrument_token: 'NSE_FO|45412', trading_symbol: 'NIFTY26N1725550CE', product: 'D', transaction_type: 'BUY', quantity: 65, average_price: 6.05, status: 'complete', tag: 'bot_auto_entry', order_timestamp: '2026-11-17 14:03:31' },
    { order_id: '102', instrument_token: 'NSE_FO|45412', trading_symbol: 'NIFTY26N1725550CE', product: 'D', transaction_type: 'SELL', quantity: 65, average_price: 8.55, status: 'complete', tag: 'bot_target_profit', order_timestamp: '2026-11-17 14:08:44' },
    { order_id: '103', instrument_token: 'NSE_FO|45412', trading_symbol: 'NIFTY26N1725550CE', product: 'D', transaction_type: 'BUY', quantity: 65, average_price: 8.20, status: 'complete', tag: 'bot_auto_entry', order_timestamp: '2026-11-17 14:09:40' },
    { order_id: '104', instrument_token: 'NSE_FO|45412', trading_symbol: 'NIFTY26N1725550CE', product: 'D', transaction_type: 'SELL', quantity: 65, average_price: 8.55, status: 'complete', tag: 'bot_stop_loss', order_timestamp: '2026-11-17 14:10:33' },
    { order_id: '105', instrument_token: 'NSE_FO|45412', trading_symbol: 'NIFTY26N1725550CE', product: 'D', transaction_type: 'BUY', quantity: 65, average_price: 8.65, status: 'complete', tag: 'bot_auto_entry', order_timestamp: '2026-11-17 14:11:28' },
    { order_id: '106', instrument_token: 'NSE_FO|45412', trading_symbol: 'NIFTY26N1725550CE', product: 'D', transaction_type: 'SELL', quantity: 65, average_price: 6.25, status: 'complete', tag: 'bot_stop_loss', order_timestamp: '2026-11-17 14:13:29' },
    { order_id: '107', instrument_token: 'NSE_FO|45412', trading_symbol: 'NIFTY26N1725550CE', product: 'D', transaction_type: 'BUY', quantity: 65, average_price: 5.65, status: 'complete', tag: null, order_timestamp: '2026-11-17 14:23:28' },
    // Same strike 25600CE closed in D earlier, then opened fresh in I
    { order_id: '108', instrument_token: 'NSE_FO|45414', trading_symbol: 'NIFTY26N1725600CE', product: 'D', transaction_type: 'BUY', quantity: 65, average_price: 6.60, status: 'complete', tag: 'bot_auto_entry', order_timestamp: '2026-11-17 12:52:36' },
    { order_id: '109', instrument_token: 'NSE_FO|45414', trading_symbol: 'NIFTY26N1725600CE', product: 'D', transaction_type: 'SELL', quantity: 65, average_price: 5.20, status: 'complete', tag: 'bot_stop_loss', order_timestamp: '2026-11-17 13:00:18' },
    { order_id: '110', instrument_token: 'NSE_FO|45414', trading_symbol: 'NIFTY26N1725600CE', product: 'I', transaction_type: 'BUY', quantity: 65, average_price: 2.00, status: 'complete', tag: null, order_timestamp: '2026-11-17 14:27:34' },
  ];

  const openLots = computeOpenFifoPositionsFromOrders(dayOrders);
  assert.equal(openLots['NSE_FO|45412|D']?.openAvgBuyPrice, 5.65);
  assert.equal(openLots['NSE_FO|45412|D']?.isBotManaged, false);
  assert.equal(openLots['NSE_FO|45414|D'], undefined);
  assert.equal(openLots['NSE_FO|45414|I']?.openAvgBuyPrice, 2.00);

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
      realised: 124.80,
      pnl: 47.75,
    },
    {
      instrument_token: 'NSE_FO|45414',
      trading_symbol: 'NIFTY26N1725600CE',
      product: 'I',
      quantity: 65,
      overnight_quantity: 0,
      day_buy_price: 2.00,
      buy_price: 2.00,
      last_price: 2.15,
      realised: 0,
      pnl: 9.75,
    },
  ];

  const normalized = normalizeUpstoxShortTermPositionsWithOrders(rawPositions, dayOrders);
  assert.equal(normalized.length, 2);
  const pos25550 = normalized.find((p) => p.symbol === 'NIFTY26N1725550CE')!;
  assert.equal(pos25550.buyPrice, 5.65, 'Must use true open FIFO cost basis (₹5.65), NEVER Upstox cumulative ₹7.14');
  assert.equal(pos25550.pnl, 19.5, 'Unrealized PnL at 5.95 vs 5.65 open lot must be +₹19.50');
  assert.equal(pos25550.realizedPnL, 124.80, 'Realized PnL from prior closed legs remains preserved');

  const pos25600 = normalized.find((p) => p.symbol === 'NIFTY26N1725600CE')!;
  assert.equal(pos25600.buyPrice, 2.00);
  assert.equal(pos25600.productType, 'INTRADAY');
});

test('analyzeTradingSignals preserves BUY signal when 5m/15m SuperTrend & VWAP uptrend confirm despite mild -33 sector divergence', () => {
  const startTs = Date.UTC(2026, 10, 19, 3, 45, 0); // 09:15 IST
  const candles: CandleData[] = [];
  for (let i = 0; i < 32; i++) {
    const close = 81900 + i * 6.5;
    const prevC = i === 0 ? 81895 : candles[i - 1].close;
    candles.push({
      time: new Date(startTs + i * 60_000).toISOString(),
      timestamp: startTs + i * 60_000,
      open: prevC,
      high: close + 5,
      low: prevC - 3,
      close,
      volume: 10000,
      ema9: close - 20,
      ema21: close - 45,
      ema50: close - 70,
      rsi: 64,
      supertrend: close - 55,
      supertrendDir: 'BUY',
      macdHist: 12.5,
      adx: 24,
    });
  }
  const sig = analyzeTradingSignals('SENSEX', 'SENSEX', 'BSE_INDEX|SENSEX', candles, candles[candles.length - 1].close, 'PROFIT_MAX_100_PERCENT_MATRIX', 6.7, {
    strikePrice: 83300,
    optionType: 'CE',
    ltp: 6.7,
    expiry: '2026-11-19',
    lotSize: 20,
    delta: 0.0289,
    gamma: 0.0001,
    theta: -6,
    iv: 18,
    corporateHeavyweightScore: -33,
    availableCapital: 182.39,
  });
  assert.ok(sig);
  assert.equal(sig!.signalType, 'BUY', 'Strong aligned 5m/15m uptrend above VWAP must not be vetoed by mild -33 divergence');
  assert.ok(sig!.confidenceScore >= 78, `Expected >=78 confidence for micro/nano option setup, got ${sig!.confidenceScore}`);
});

test('calculateTradeCharges matches exact Upstox live BSE SENSEX vs NSE NIFTY statutory charges (0.15% STT, BSE 0.005% vs NSE 0.03503% txn)', () => {
  // BSE SENSEX 83400 CE: Buy 20 @ 6.60 -> Sell 20 @ 5.55 (matches live Upstox ₹70.97 round-trip)
  const bse = calculateTradeCharges(6.60, 20, true, 5.55, 'BSE_FO|823041');
  assert.equal(bse.buyBrokerage, 30);
  assert.equal(bse.sellBrokerage, 30);
  assert.equal(bse.buyCharges, 35.41);
  assert.ok(bse.sellCharges >= 35.54 && bse.sellCharges <= 35.60, `Expected BSE sellCharges ~35.56, got ${bse.sellCharges}`);
  assert.ok(bse.roundTripCharges >= 70.94 && bse.roundTripCharges <= 71.02, `Expected BSE round-trip ~70.97, got ${bse.roundTripCharges}`);

  // NSE NIFTY Option: Buy 65 @ 10.00 -> Sell 65 @ 12.00 uses NSE 0.03503% txn fee & 0.15% STT
  const nse = calculateTradeCharges(10.0, 65, true, 12.0, 'NSE_FO|NIFTY26N2325500CE');
  assert.equal(nse.stt, Number((12.0 * 65 * 0.0015).toFixed(2))); // ₹1.17
  assert.ok(nse.exchangeTxnCharge > bse.exchangeTxnCharge, 'NSE txn fee (0.03503%) must exceed BSE txn fee (0.005%)');
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
      average_price: 4.90,
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
      average_price: 4.50,
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
      average_price: 6.60,
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
  assert.equal(paired.length, 2, 'Must produce strictly 2 closed round-trip trades (never a 3rd phantom trade from open lot)');
  const closedGross = Number(paired.reduce((s, t) => s + Number(t.realizedPnL || 0), 0).toFixed(2));
  assert.equal(closedGross, -29.0);
  const totalBrokerage = Number(paired.reduce((s, t) => s + Number(t.brokerageCharges || 0), 0).toFixed(2));
  assert.ok(totalBrokerage >= 141.80 && totalBrokerage <= 142.20, `2 BSE round-trips must sum to ~₹141.94, got ${totalBrokerage}`);

  const openLots = computeOpenFifoPositionsFromOrders(sensexOrders);
  assert.equal(openLots['BSE_FO|823041|D']?.openAvgBuyPrice, 4.35, 'Open lot must isolate 4.35 entry, not Upstox weighted average 5.40');
});

test('validatePaperOrderInput allows Futures and valid paper Option Chain trades while blocking dummy ₹100 option fallback orders', () => {
  // 1. Futures orders (NIFTY FUT, CRUDEOIL FUT) must never be blocked by FO substring
  const niftyFut = validatePaperOrderInput({
    symbol: 'NIFTY FUT',
    resolvedKey: 'NSE_FO|NIFTY24NOVFUT',
    price: 25420.5,
  });
  assert.equal(niftyFut.valid, true);
  assert.equal(niftyFut.isOption, false, 'Futures contract must not be classified as option');

  const crudeFut = validatePaperOrderInput({
    symbol: 'CRUDEOIL FUT',
    resolvedKey: 'MCX_FO|CRUDEOIL24NOVFUT',
    price: 5890.0,
  });
  assert.equal(crudeFut.valid, true);
  assert.equal(crudeFut.isOption, false);

  // 2. Dummy ₹100 option orders lacking Upstox numeric contract ID must be rejected
  const dummyOption = validatePaperOrderInput({
    symbol: 'NIFTY 25500 CE',
    resolvedKey: 'NSE_FO|NIFTY 25500 CE',
    price: 100,
  });
  assert.equal(dummyOption.valid, false);
  assert.equal(dummyOption.isOption, true);
  assert.match(dummyOption.error || '', /Blocked dummy ₹100 option order/);

  // 3. Valid paper option chain orders with real LTP must be accepted
  const validOptionChain = validatePaperOrderInput({
    symbol: 'NIFTY 25500 CE',
    resolvedKey: 'NSE_FO|NIFTY 25500 CE',
    price: 142.5,
  });
  assert.equal(validOptionChain.valid, true);
  assert.equal(validOptionChain.isOption, true);

  // 4. Invalid prices <= 0 must be rejected
  const zeroPrice = validatePaperOrderInput({
    symbol: 'RELIANCE',
    resolvedKey: 'NSE_EQ|INE002A01018',
    price: 0,
  });
  assert.equal(zeroPrice.valid, false);
  assert.match(zeroPrice.error || '', /greater than ₹0/);
});




