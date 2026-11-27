// Capital-adaptive affordability filter for option chain rows.
import { botConfig } from '../../../state';
import {
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from '../../../../src/utils/indicators';

export interface AffordableRowsParams {
  allValidRows: any[];
  optType: 'CE' | 'PE';
  effectiveCapital: number;
  compactCapCeiling: number;
  lotSz: number;
  liveLtp: number;
  tierCfg: any;
  isSecondaryIdx: boolean;
  signal: any;
  isBullish: boolean;
  calcEntryAffordableLots: (ltpVal: number, lotSzVal: number, cashCap: number) => number;
}

/** Rows whose premium, liquidity and charge load fit the account's capital tier. */
export function selectAffordableRows({
  allValidRows,
  optType,
  effectiveCapital,
  compactCapCeiling,
  lotSz,
  liveLtp,
  tierCfg,
  isSecondaryIdx,
  signal,
  isBullish,
  calcEntryAffordableLots,
}: AffordableRowsParams): any[] {
  const affordableRows =
    effectiveCapital > 0
      ? allValidRows
          .filter((r: any) => {
            const optObj = optType === 'CE' ? r.call_options : r.put_options;
            const ltp = Number(optObj?.market_data?.ltp || 0);
            const absDelta = Math.abs(Number(optObj?.option_greeks?.delta ?? 0.35));
            const absGamma = Math.abs(Number(optObj?.option_greeks?.gamma ?? 0.0001));
            const vol = Number(optObj?.market_data?.volume || 0);
            const oiVal = Number(optObj?.market_data?.oi || 0);
            const underlyingAtrVal = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
            const underlyingResVal = Number(
              signal?.institutionalQuantAnalysis?.nearestResistance ||
                liveLtp + underlyingAtrVal * 2.5,
            );
            const underlyingSupVal = Number(
              signal?.institutionalQuantAnalysis?.nearestSupport ||
                liveLtp - underlyingAtrVal * 2.5,
            );
            const runwayPoints = isBullish
              ? Math.max(underlyingAtrVal * 1.8, underlyingResVal - liveLtp)
              : Math.max(underlyingAtrVal * 1.8, liveLtp - underlyingSupVal);
            const gammaGainPts =
              0.5 * absGamma * Math.pow(Math.min(runwayPoints, underlyingAtrVal * 3), 2);
            const expGainPts = Math.max(ltp * 0.25, runwayPoints * absDelta + gammaGainPts);
            const tMult = Math.max(1.25, (ltp + expGainPts) / (ltp || 1));
            const charges = calculateTradeCharges(ltp, lotSz, true, ltp * tMult);
            const lotAfford = calculateAffordableLotsWithBrokerage(
              ltp,
              lotSz,
              compactCapCeiling,
              true,
              5,
            );
            const liveEntryLots =
              botConfig.mode === 'UPSTOX_LIVE'
                ? calcEntryAffordableLots(ltp, lotSz, compactCapCeiling)
                : 0;
            const entryCashNeeded = charges.tradeValue + charges.buyCharges + 3;
            const requiredCapForRow =
              botConfig.mode === 'UPSTOX_LIVE'
                ? entryCashNeeded
                : charges.totalRequiredWithBrokerage;
            const possibleLots = Math.max(
              lotAfford.affordableLots,
              liveEntryLots,
              requiredCapForRow <= compactCapCeiling ? 1 : 0,
            );
            const expNet =
              ltp * (tMult - 1) * lotSz * Math.max(1, possibleLots) - charges.roundTripCharges;
            const strikeDistPct = Math.abs(Number(r.strike_price) - liveLtp) / liveLtp;
            const reqMinProfit = tierCfg.getMinReqNetProfit(
              charges.roundTripCharges,
              botConfig.minOptionProfitAmount,
            );
            const hasLiquidity =
              tierCfg.tier === 'STANDARD' || isSecondaryIdx || effectiveCapital < 300
                ? (vol >= tierCfg.minVolume || oiVal >= tierCfg.minOi) && vol > 0 && oiVal > 0
                : vol >= tierCfg.minVolume && oiVal >= tierCfg.minOi;
            const brokerageDragPct =
              charges.tradeValue > 0 ? charges.roundTripCharges / charges.tradeValue : 1;
            return (
              ltp >= tierCfg.minLtp &&
              strikeDistPct <= tierCfg.maxStrikeDistPct &&
              brokerageDragPct <= tierCfg.maxBrokerageDragPct &&
              possibleLots >= 1 &&
              requiredCapForRow <= compactCapCeiling &&
              absDelta >= tierCfg.minDelta &&
              hasLiquidity &&
              expNet >= reqMinProfit
            );
          })
          .sort((a: any, b: any) => {
            return (
              Math.abs(Number(a.strike_price) - liveLtp) -
              Math.abs(Number(b.strike_price) - liveLtp)
            );
          })
          .slice(0, 8)
      : [];
  return affordableRows;
}
