import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enforceOptionsOnlyConfig,
  evaluateOptionTradeProfitability,
  getCapitalTierOptionConstraints,
  evaluateOptionDipMomentum,
  validatePaperOrderInput,
} from '../lib/optionTradeRules';

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
    delta: 0.5,
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
    delta: 0.5,
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

test('evaluateOptionDipMomentum allows value dip pullbacks when underlying confirms while rejecting sharp crashes', () => {
  // Healthy pullback dip below stale chain snapshot (₹11.20 vs ₹11.50 snapshot) bouncing off ₹11.00 low
  const dipAllowed = evaluateOptionDipMomentum({
    liveOptLtp: 11.2,
    chainSnapshotLtp: 11.5,
    optLowestBase: 11.0,
    optOpen0: 11.25,
    optShortVwap: 11.3,
    optUpperWickRatio: 0.18,
    singleMinuteSpikePct: -0.44,
    isUnderlyingConfirming: true,
    isBaseMomentumOk: false,
  });
  assert.equal(dipAllowed, true);

  // Micro-option (<₹15) normal 9% tick bounce (+₹0.65 on ₹7.05) with 34% wick must be allowed when underlying confirms
  const microContinuationAllowed = evaluateOptionDipMomentum({
    liveOptLtp: 7.7,
    chainSnapshotLtp: 7.4,
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
    chainSnapshotLtp: 11.5,
    optLowestBase: 9.7,
    optOpen0: 11.25,
    optShortVwap: 11.0,
    optUpperWickRatio: 0.1,
    singleMinuteSpikePct: -13.3,
    isUnderlyingConfirming: true,
    isBaseMomentumOk: false,
  });
  assert.equal(crashBlocked, false);

  // Extreme vertical spike (+22% in 1m) on micro option still blocked
  const extremeSpikeBlocked = evaluateOptionDipMomentum({
    liveOptLtp: 8.6,
    chainSnapshotLtp: 7.4,
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
