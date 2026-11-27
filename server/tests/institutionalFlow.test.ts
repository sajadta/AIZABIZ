import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInstitutionalFlow } from '../services/bot/entryScan/institutionalFlow';

test('computeInstitutionalFlow reports bullish heavyweights when bank constituents rally', () => {
  const quotes: any = {
    'NSE_EQ|INE040A01034': { last_price: 1700, ohlc: { open: 1650 } },
    'NSE_EQ|INE090A01021': { last_price: 1200, ohlc: { open: 1180 } },
    'NSE_EQ|INE062A01020': { last_price: 850, ohlc: { open: 840 } },
    'NSE_EQ|INE238A01034': { last_price: 1150, ohlc: { open: 1140 } },
    'NSE_EQ|INE237A01028': { last_price: 1800, ohlc: { open: 1790 } },
    'NSE_EQ|INE095A01012': { last_price: 1500, ohlc: { open: 1490 } },
    'NSE_INDEX|Nifty 50': { last_price: 25000, ohlc: { open: 24900 } },
    'NSE_INDEX|Nifty Bank': { last_price: 53000, ohlc: { open: 52800 } },
    'NSE_EQ|INE009A01021': { last_price: 1800, ohlc: { open: 1790 } },
    'NSE_EQ|INE467B01029': { last_price: 4000, ohlc: { open: 3980 } },
  };
  const flow = computeInstitutionalFlow('BANKNIFTY', quotes, {});
  assert.equal(flow.corporateHeavyweightScore, 100);
  assert.match(flow.corporateHeavyweightSummary, /Heavyweights Bullish/);
  assert.equal(flow.globalMacroAlignment, 'BULLISH');
  assert.equal(flow.bankQuote.last_price, 53000);
});

test('computeInstitutionalFlow reports bearish heavyweights when constituents fall', () => {
  const quotes: any = {
    'NSE_EQ|INE040A01034': { last_price: 1600, ohlc: { open: 1650 } },
    'NSE_EQ|INE090A01021': { last_price: 1150, ohlc: { open: 1180 } },
    'NSE_EQ|INE062A01020': { last_price: 830, ohlc: { open: 840 } },
    'NSE_EQ|INE238A01034': { last_price: 1100, ohlc: { open: 1140 } },
    'NSE_EQ|INE237A01028': { last_price: 1750, ohlc: { open: 1790 } },
    'NSE_EQ|INE095A01012': { last_price: 1450, ohlc: { open: 1490 } },
    'NSE_INDEX|Nifty 50': { last_price: 24700, ohlc: { open: 24900 } },
    'NSE_INDEX|Nifty Bank': { last_price: 52500, ohlc: { open: 52800 } },
    'NSE_EQ|INE009A01021': { last_price: 1770, ohlc: { open: 1790 } },
    'NSE_EQ|INE467B01029': { last_price: 3950, ohlc: { open: 3980 } },
  };
  const flow = computeInstitutionalFlow('NIFTY', quotes, {});
  assert.equal(flow.corporateHeavyweightScore, -100);
  assert.match(flow.corporateHeavyweightSummary, /Heavyweights Bearish/);
  assert.equal(flow.globalMacroAlignment, 'BEARISH');
});

test('computeInstitutionalFlow returns neutral output without any quotes', () => {
  const flow = computeInstitutionalFlow('NIFTY', {}, {});
  assert.equal(flow.corporateHeavyweightScore, 0);
  assert.match(flow.corporateHeavyweightSummary, /Mixed Heavyweight Flow/);
  assert.equal(flow.globalMacroAlignment, 'MIXED');
  assert.equal(flow.bankQuote, undefined);
});

test('computeInstitutionalFlow falls back to the global quote cache', () => {
  const globalQuotes: any = {
    'NSE_EQ|INE040A01034': { last_price: 1700, net_change: 25 },
    'NSE_EQ|INE002A01018': { last_price: 2900, net_change: 15 },
    'NSE_EQ|INE090A01021': { last_price: 1200, net_change: 12 },
    'NSE_EQ|INE009A01021': { last_price: 1800, net_change: 10 },
    'NSE_EQ|INE467B01029': { last_price: 4000, net_change: 20 },
    'NSE_EQ|INE154A01025': { last_price: 450, net_change: 3 },
    'NSE_EQ|INE018A01030': { last_price: 3600, net_change: 30 },
    'NSE_EQ|INE062A01020': { last_price: 850, net_change: 5 },
  };
  const flow = computeInstitutionalFlow('NIFTY', {}, globalQuotes);
  assert.equal(flow.corporateHeavyweightScore, 100);
  assert.equal(flow.globalMacroAlignment, 'MIXED');
});
