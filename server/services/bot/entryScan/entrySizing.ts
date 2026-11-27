// Lot sizing, brokerage-aware cash guards and alpha scoring for a new option entry.
import { botConfig } from '../../../state';
import {
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from '../../../../src/utils/indicators';
import { getDynamicLotSize } from '../../../lib/instruments';
import { isStrikeChurnBlocked } from './strikeAntiChurn';
import { computeAlphaScore } from './alphaScore';

export interface SizeOptionEntryParams {
  token: string;
  idx: any;
  signal: any;
  bestCandidate: any;
  optionSymbol: string;
  optionPrice: number;
  optInstrumentKey: string;
  effectiveCapital: number;
  activeSessionTrades: any[];
}

/** Returns the sized candidate, or null when the entry is blocked (anti-churn / capital). */
export async function sizeOptionEntry(p: SizeOptionEntryParams): Promise<any | null> {
  const {
    token,
    idx,
    signal,
    bestCandidate,
    optionSymbol,
    optionPrice,
    optInstrumentKey,
    effectiveCapital,
    activeSessionTrades,
  } = p;

  if (isStrikeChurnBlocked({ optionSymbol, optInstrumentKey, activeSessionTrades })) {
    return null;
  }

  const lotSize = await getDynamicLotSize(optionSymbol, token, optInstrumentKey);
  const lotCalc = calculateAffordableLotsWithBrokerage(
    optionPrice,
    lotSize,
    effectiveCapital,
    true,
    5,
  );
  const oneLotEntryCheck = calculateTradeCharges(
    optionPrice,
    lotSize,
    true,
    signal.target1 || optionPrice * 1.25,
  );
  const oneLotEntryCashNeeded = oneLotEntryCheck.tradeValue + oneLotEntryCheck.buyCharges + 3;
  const canAffordOneLiveLot =
    botConfig.mode === 'UPSTOX_LIVE' &&
    effectiveCapital > 0 &&
    oneLotEntryCashNeeded <= effectiveCapital;

  let liveEntryMaxLots = lotCalc.affordableLots;
  if (botConfig.mode === 'UPSTOX_LIVE' && effectiveCapital > 0 && effectiveCapital <= 6500) {
    for (let l = 1; l <= 3; l++) {
      const lc = calculateTradeCharges(
        optionPrice,
        lotSize * l,
        true,
        signal.target1 || optionPrice * 1.25,
      );
      if (lc.tradeValue + lc.buyCharges + 3 <= effectiveCapital)
        liveEntryMaxLots = Math.max(liveEntryMaxLots, l);
      else break;
    }
  }

  if (
    effectiveCapital <= 0 ||
    (lotCalc.affordableLots < 1 && !canAffordOneLiveLot && liveEntryMaxLots < 1)
  ) {
    return null;
  }

  let affordableLots = Math.max(lotCalc.affordableLots, liveEntryMaxLots, 1);
  if (effectiveCapital > 30000 && (botConfig as any).maxConcurrentTrades === 1) {
    affordableLots = Math.min(affordableLots, 2);
  } else if (effectiveCapital <= 6500) {
    affordableLots = Math.min(affordableLots, 3);
  } else {
    affordableLots = Math.min(affordableLots, 2);
  }

  const targetQuantity = affordableLots * lotSize;
  const multiLotCharges = calculateTradeCharges(
    optionPrice,
    targetQuantity,
    true,
    signal.target1 || optionPrice * 1.25,
  );
  const totalTradeCost = multiLotCharges.tradeValue;
  const totalTradeBrokerage = multiLotCharges.roundTripCharges;
  const totalRequiredCashWithBrokerage = multiLotCharges.totalRequiredWithBrokerage;
  const entryRequiredCash = totalTradeCost + multiLotCharges.buyCharges;
  if (entryRequiredCash > effectiveCapital) {
    return null;
  }

  const isOptionSellingEntry = botConfig.optionStrategyMode === 'OPTION_SELLING';
  const roundToTick = (val: number, tick = 0.05) =>
    Number((Math.round(val / tick) * tick).toFixed(2));
  const limitPriceWithSlippageGuard = isOptionSellingEntry
    ? roundToTick(optionPrice * 0.995)
    : roundToTick(optionPrice * 1.005);
  const effectiveStopLoss = isOptionSellingEntry
    ? Number((optionPrice * 1.28).toFixed(2))
    : signal.stopLoss;
  const effectiveTarget1 = isOptionSellingEntry
    ? Number((optionPrice * 0.55).toFixed(2))
    : signal.target1;

  const { expectedNetProfit, profitYield, alphaOpportunityScore } = computeAlphaScore({
    expectedNetProfit: bestCandidate?.expectedNetProfit,
    effectiveTarget1,
    optionPrice,
    targetQuantity,
    totalTradeBrokerage,
    totalRequiredCash: totalRequiredCashWithBrokerage,
    hasMtfConfirmation: Boolean(signal.mtfConfirmation?.status),
    rvol: signal.indicators?.rvol,
    confidenceScore: signal.confidenceScore,
  });

  return {
    idx,
    signal,
    bestCandidate,
    optionSymbol,
    optionPrice,
    optInstrumentKey,
    lotSize,
    targetQuantity,
    affordableLots,
    totalTradeCost,
    totalTradeBrokerage,
    entryRequiredCash,
    totalRequiredCashWithBrokerage,
    effectiveStopLoss,
    effectiveTarget1,
    isBullish: signal.signalType === 'BUY',
    isOptionSellingEntry,
    execTransactionType: isOptionSellingEntry ? 'SELL' : 'BUY',
    execOrderType: botConfig.limitOrderSlippageGuard ? 'LIMIT' : 'MARKET',
    limitPriceWithSlippageGuard,
    alphaOpportunityScore,
    expectedNetProfit,
    profitYield,
  };
}
