import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUpstoxFundsData,
  shouldUseProxyForUrl,
  evaluateProxyHealthCacheState,
} from '../services/upstoxTransport';

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
  assert.equal(
    shouldUseProxyForUrl('https://api.upstox.com/v2/portfolio/long-term-holdings'),
    true,
  );
  assert.equal(
    shouldUseProxyForUrl('https://api.upstox.com/v2/market-quote/quotes?instrument_key=X'),
    false,
  );
  assert.equal(
    shouldUseProxyForUrl('https://api.upstox.com/v2/historical-candle/intraday/X/1minute'),
    false,
  );
  assert.equal(
    shouldUseProxyForUrl('https://api.upstox.com/v2/option/chain?instrument_key=X'),
    false,
  );
  assert.equal(
    shouldUseProxyForUrl('https://api.upstox.com/v2/option/contract?instrument_key=X'),
    false,
  );
});

test('evaluateProxyHealthCacheState uses stale-while-revalidate when online proxy TTL expires', () => {
  const proxyUrl = 'http://8.234.113.241:8888';
  const now = 1_000_000;
  // Fresh online cache stays online without refresh
  assert.deepEqual(
    evaluateProxyHealthCacheState(
      { url: proxyUrl, online: true, lastChecked: now - 5000 },
      proxyUrl,
      now,
    ),
    { online: true, shouldRefresh: false },
  );
  // Expired online cache keeps routing via last-good proxy while triggering background refresh
  assert.deepEqual(
    evaluateProxyHealthCacheState(
      { url: proxyUrl, online: true, lastChecked: now - 35000 },
      proxyUrl,
      now,
    ),
    { online: true, shouldRefresh: true },
  );
  // Changed proxy URL or unchecked cache starts offline and triggers refresh
  assert.deepEqual(
    evaluateProxyHealthCacheState(
      { url: 'http://other:8888', online: true, lastChecked: now - 1000 },
      proxyUrl,
      now,
    ),
    { online: false, shouldRefresh: true },
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
