import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTradeCharges } from '../../src/utils/indicators/tradeMath';
import { getInstrumentKey, MICRO_CAPITAL_EQUITY_UNIVERSE } from '../lib/instruments';
import {
  enforceOptionsOnlyConfig,
  evaluateOptionTradeProfitability,
  getCapitalTierOptionConstraints,
  evaluateOptionDipMomentum,
  validatePaperOrderInput,
} from '../lib/optionTradeRules';

test('calculateTradeCharges ensures micro equity trades pay < ₹1 brokerage so ₹524 margin compounds profitably', () => {
  // 14 shares of TRIDENT @ ₹35 = ₹490 trade value
  const eqCharges = calculateTradeCharges(35, 14, false, 36);
  assert.ok(
    eqCharges.roundTripCharges < 1.5,
    'Micro equity round-trip brokerage must be under ₹1.50',
  );
  assert.ok(
    eqCharges.totalRequiredWithBrokerage < 500,
    'Total required must fit comfortably in ₹524.59 margin',
  );

  // Conversely, option trades charge full F&O rates
  const optCharges = calculateTradeCharges(50, 65, true, 60);
  assert.ok(
    optCharges.roundTripCharges >= 40,
    'Option round-trip brokerage includes F&O statutory minimums',
  );
});

test('getInstrumentKey resolves liquid momentum stocks for micro-capital trading', () => {
  assert.equal(getInstrumentKey('TRIDENT'), 'NSE_EQ|INE064C01022');
  assert.equal(getInstrumentKey('SUZLON'), 'NSE_EQ|INE040H01021');
  assert.equal(getInstrumentKey('TATASTEEL'), 'NSE_EQ|INE081A01020');
  assert.ok(
    MICRO_CAPITAL_EQUITY_UNIVERSE.length >= 10,
    'Must have at least 10 liquid stocks in micro-capital universe',
  );
});

test('getCapitalTierOptionConstraints adapts thresholds smoothly for Micro (<₹1250), Compact (₹1250–₹3500), and Standard capital without brokerage bleed', () => {
  const micro = getCapitalTierOptionConstraints(781.45, false);
  assert.equal(micro.tier, 'MICRO');
  assert.ok(micro.minLtp >= 8 && micro.minDelta >= 0.09);
  assert.ok(micro.maxBrokerageDragPct <= 0.14);
  assert.ok(micro.minVolume >= 100000);
  assert.ok(micro.getMinReqNetProfit(72) >= 110);

  const sub750Micro = getCapitalTierOptionConstraints(550.7, false);
  assert.equal(sub750Micro.tier, 'MICRO');
  assert.equal(sub750Micro.minLtp, 4.0);
  assert.equal(sub750Micro.minDelta, 0.06);
  assert.equal(sub750Micro.maxBrokerageDragPct, 0.25);
  assert.ok(sub750Micro.getMinReqNetProfit(72) >= 100);

  const bseMicro = getCapitalTierOptionConstraints(781.45, true);
  assert.equal(bseMicro.tier, 'MICRO');
  assert.equal(
    bseMicro.minVolume,
    25000,
    'BSE SENSEX 20-lot contracts scale minVolume down proportionally',
  );
  assert.equal(bseMicro.minOi, 15000);

  const compact = getCapitalTierOptionConstraints(2000, false);
  assert.equal(compact.tier, 'COMPACT');
  assert.ok(compact.minLtp >= 10 && compact.minDelta >= 0.1);
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
  assert.ok(
    nanoBankNifty.minVolume <= 5000 &&
      nanoFinNifty.minVolume <= 5000 &&
      nanoMidcp.minVolume <= 5000 &&
      nanoBankex.minVolume <= 5000,
  );

  const sensexCharges = calculateTradeCharges(5.0, 20, true, 11.0);
  const niftyNanoCharges = calculateTradeCharges(2.0, 65, true, 4.0);
  assert.ok(
    sensexCharges.tradeValue + sensexCharges.buyCharges <= 182.39,
    'SENSEX ₹5x20 entry cash fits ₹182.39 margin',
  );
  assert.ok(
    niftyNanoCharges.tradeValue + niftyNanoCharges.buyCharges <= 182.39,
    'NIFTY ₹2x65 entry cash fits ₹182.39 margin',
  );
  assert.ok(
    (11 - 5) * 20 - sensexCharges.roundTripCharges >=
      nanoSensex.getMinReqNetProfit(sensexCharges.roundTripCharges),
  );
  assert.ok(
    (4 - 2) * 65 - niftyNanoCharges.roundTripCharges >=
      nanoNifty.getMinReqNetProfit(niftyNanoCharges.roundTripCharges),
  );
});

test('calculateTradeCharges accurately models ₹30/order Upstox F&O brokerage (~₹72 round-trip) and rejects 16% fee-drag penny contracts', () => {
  // Actual live trade today: NIFTY 25650 CE BUY 65 @ ₹6.70 -> SELL @ ₹7.30 = +₹39 gross, ~₹72 charges = net loss
  const deepOtmCharges = calculateTradeCharges(6.7, 65, true, 7.3);
  assert.equal(deepOtmCharges.buyBrokerage, 30);
  assert.equal(deepOtmCharges.sellBrokerage, 30);
  assert.ok(deepOtmCharges.roundTripCharges >= 70 && deepOtmCharges.roundTripCharges <= 76);

  const microTier = getCapitalTierOptionConstraints(781.45, false);
  const deepOtmDragPct = deepOtmCharges.roundTripCharges / deepOtmCharges.tradeValue;
  assert.ok(deepOtmDragPct > microTier.maxBrokerageDragPct, '16.5% brokerage drag must be blocked');

  // Healthy near-ATM option (₹22.50 x 65 = ₹1,462.50): round-trip drag is ~5.1% <= 8%
  const qualityCharges = calculateTradeCharges(22.5, 65, true, 29.0);
  const qualityDragPct = qualityCharges.roundTripCharges / qualityCharges.tradeValue;
  assert.ok(qualityDragPct <= microTier.maxBrokerageDragPct, 'Quality option keeps fee drag <= 8%');
});

test('calculateTradeCharges matches exact Upstox live BSE SENSEX vs NSE NIFTY statutory charges (0.15% STT, BSE 0.005% vs NSE 0.03503% txn)', () => {
  // BSE SENSEX 83400 CE: Buy 20 @ 6.60 -> Sell 20 @ 5.55 (matches live Upstox ₹70.97 round-trip)
  const bse = calculateTradeCharges(6.6, 20, true, 5.55, 'BSE_FO|823041');
  assert.equal(bse.buyBrokerage, 30);
  assert.equal(bse.sellBrokerage, 30);
  assert.equal(bse.buyCharges, 35.41);
  assert.ok(
    bse.sellCharges >= 35.54 && bse.sellCharges <= 35.6,
    `Expected BSE sellCharges ~35.56, got ${bse.sellCharges}`,
  );
  assert.ok(
    bse.roundTripCharges >= 70.94 && bse.roundTripCharges <= 71.02,
    `Expected BSE round-trip ~70.97, got ${bse.roundTripCharges}`,
  );

  // NSE NIFTY Option: Buy 65 @ 10.00 -> Sell 65 @ 12.00 uses NSE 0.03503% txn fee & 0.15% STT
  const nse = calculateTradeCharges(10.0, 65, true, 12.0, 'NSE_FO|NIFTY26N2325500CE');
  assert.equal(nse.stt, Number((12.0 * 65 * 0.0015).toFixed(2))); // ₹1.17
  assert.ok(
    nse.exchangeTxnCharge > bse.exchangeTxnCharge,
    'NSE txn fee (0.03503%) must exceed BSE txn fee (0.005%)',
  );
});
