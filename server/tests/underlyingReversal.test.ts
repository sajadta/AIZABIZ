import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectUnderlyingReversal,
  isCallOptionSymbol,
} from '../services/bot/positionMonitor/underlyingReversal';

const bullishSignal = {
  signalType: 'BUY',
  indicators: {
    emaCross: { ema9: 25100, ema21: 25000 },
    supertrend: { signal: 'BUY' },
    macd: { hist: 12.5 },
  },
  institutionalQuantAnalysis: { corporateHeavyweightScore: 40 },
};

test('isCallOptionSymbol distinguishes CE from PE contracts', () => {
  assert.equal(isCallOptionSymbol('NIFTY 25000 CE'), true);
  assert.equal(isCallOptionSymbol('NIFTY 25000 PE'), false);
  assert.equal(isCallOptionSymbol(undefined), false);
});

test('detectUnderlyingReversal flags a CE when the index flips bearish', () => {
  const bearish = {
    signalType: 'SELL',
    indicators: {
      emaCross: { ema9: 24900, ema21: 25000 },
      supertrend: { signal: 'SELL' },
      macd: { hist: -9.25 },
    },
    institutionalQuantAnalysis: { corporateHeavyweightScore: -35 },
  };
  const res = detectUnderlyingReversal(bearish, true);
  assert.equal(res.isUnderlyingParametersReversing, true);
  assert.match(res.underlyingReversalDetails, /against CE/);
  assert.match(res.underlyingReversalDetails, /Heavyweights -35/);
});

test('detectUnderlyingReversal keeps a CE while the index stays bullish', () => {
  const res = detectUnderlyingReversal(bullishSignal, true);
  assert.equal(res.isUnderlyingParametersReversing, false);
  assert.equal(res.underlyingReversalDetails, '');
});

test('detectUnderlyingReversal flags a PE when the index flips bullish', () => {
  const res = detectUnderlyingReversal(bullishSignal, false);
  assert.equal(res.isUnderlyingParametersReversing, true);
  assert.match(res.underlyingReversalDetails, /against PE/);
  assert.match(res.underlyingReversalDetails, /Heavyweights \+40/);
});

test('detectUnderlyingReversal is neutral without indicators', () => {
  const res = detectUnderlyingReversal(undefined, true);
  assert.equal(res.isUnderlyingParametersReversing, false);
  assert.equal(res.underlyingReversalDetails, '');
});
