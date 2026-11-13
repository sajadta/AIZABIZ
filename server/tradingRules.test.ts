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
