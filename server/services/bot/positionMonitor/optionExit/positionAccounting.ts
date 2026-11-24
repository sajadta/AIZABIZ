// Per-position accounting snapshot: sizing plan, live brokerage and the
// high-water-mark bookkeeping used by every exit rule.
import {
  botConfig,
  paperTradeHistory,
  livePositionStateTracker,
  getCachedUpstoxLiveMargin,
} from '../../../../state';
import { calculateTradeCharges } from '../../../../../src/utils/indicators';
import { fetchLiveUpstoxCharges } from '../../../../lib/charges';
import { computeOptionStopLossPlan } from '../stopLoss';
import { getPaperInitialCapital } from '../../../persistence';

export interface OptionPositionAccounting {
  qty: number;
  isMicroDeployedOpt: boolean;
  staticStopLossPrice: number;
  maxAllowedRupeeLoss: number;
  roundTripTax: number;
  posPnL: number;
  posNetPnL: number;
  posProdCode: string;
  posTrackerKey: string;
  activeTracker: any;
  isSmallCapitalSafeZone: boolean;
}

export async function resolveOptionPositionAccounting(
  pos: any,
  ltp: number,
): Promise<OptionPositionAccounting> {
  // Capital base drives the small-account harvest thresholds.
  const liveOrPaperCapital =
    botConfig.mode === 'UPSTOX_LIVE'
      ? getCachedUpstoxLiveMargin().margin > 0
        ? getCachedUpstoxLiveMargin().margin
        : 2000
      : Math.max(
          500,
          getPaperInitialCapital() +
            paperTradeHistory.reduce(
              (sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0),
              0,
            ),
        );
  const isSmallCapitalSafeZone = liveOrPaperCapital <= 4000;

  const { qty, isMicroDeployedOpt, staticStopLossPrice, maxAllowedRupeeLoss } =
    computeOptionStopLossPlan(pos.buyPrice, pos.quantity, botConfig.stopLossPercent);

  // 1. DYNAMIC TREND-RIDING & TARGET-RUNWAY MAXIMUM PROFIT ENGINE
  const posPnL = (ltp - pos.buyPrice) * qty;
  let roundTripTax = calculateTradeCharges(
    pos.buyPrice,
    qty,
    true,
    Math.max(ltp, pos.highestLTP || ltp),
  ).roundTripCharges;
  try {
    const liveChg = await fetchLiveUpstoxCharges(
      pos.instrumentKey || pos.symbol,
      qty,
      pos.buyPrice,
      Math.max(ltp, pos.highestLTP || ltp),
      pos.product || pos.productType || 'D',
    );
    if (liveChg && liveChg.totalRoundTrip > 0) {
      roundTripTax = liveChg.totalRoundTrip;
      (pos as any).brokerageCharges = liveChg.totalRoundTrip;
      (pos as any).brokerageSource = liveChg.source;
    }
  } catch {
    // Ignored
  }
  const posNetPnL = posPnL - roundTripTax;
  const peakGrossPnL = ((pos.highestLTP || ltp) - pos.buyPrice) * qty;
  const peakNetPnL = peakGrossPnL - roundTripTax;
  pos.highestPnl = Math.max(pos.highestPnl || 0, posPnL, peakGrossPnL);
  pos.highestNetPnl = Math.max(pos.highestNetPnl || 0, posNetPnL, peakNetPnL);
  const posProdCode = pos.product || (pos.productType === 'INTRADAY' ? 'I' : 'D');
  const posTrackerKey = pos.instrumentKey ? `${pos.instrumentKey}|${posProdCode}` : '';
  const activeTracker =
    (posTrackerKey && livePositionStateTracker[posTrackerKey]) ||
    (pos.instrumentKey && livePositionStateTracker[pos.instrumentKey]);
  if (activeTracker) {
    activeTracker.highestLTP = pos.highestLTP;
    activeTracker.highestPnl = pos.highestPnl;
    activeTracker.highestNetPnl = pos.highestNetPnl;
    if ((pos as any).brokerageCharges) {
      activeTracker.brokerageCharges = (pos as any).brokerageCharges;
      activeTracker.brokerageSource = (pos as any).brokerageSource;
    }
  }
  return {
    qty,
    isMicroDeployedOpt,
    staticStopLossPrice,
    maxAllowedRupeeLoss,
    roundTripTax,
    posPnL,
    posNetPnL,
    posProdCode,
    posTrackerKey,
    activeTracker,
    isSmallCapitalSafeZone,
  };
}
