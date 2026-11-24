// Per-candidate live option momentum check: quote refresh, 1-minute candle
// structure, dip-bounce setup, anti-churn lockout and flash-drop guard.
import { globalLiveQuotes, optionIntradayCandleCache, recentClosedStrikes } from '../../../state';
import { resilientFetchJson } from '../../../lib/http';
import { evaluateOptionDipMomentum } from '../../../lib/optionTradeRules';
import { STRIKE_LOCKOUT_MS } from '../antiChurn';
import { evaluateOptionEntrySetup } from './optionEntrySetup';

export interface CandidateMomentumParams {
  token: string;
  cand: any;
  enriched: any;
  liveLtp: number;
  isBullish: boolean;
  isOptionSellingMode: boolean;
}

export interface CandidateMomentumResult {
  liveOptLtp: number;
  momentumOk: boolean;
}

export async function evaluateCandidateMomentum(
  params: CandidateMomentumParams,
): Promise<CandidateMomentumResult> {
  const { token, cand, enriched, liveLtp, isBullish, isOptionSellingMode } = params;

  let liveOptLtp = Number(globalLiveQuotes[cand.instrumentKey]?.last_price || cand.ltp);
  try {
    const optQJson: any = await resilientFetchJson(
      `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(cand.instrumentKey)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Api-Version': '2.0',
        },
      },
      1,
      3500,
    );
    const qItem = optQJson?.data?.[cand.instrumentKey] || Object.values(optQJson?.data || {})[0];
    if ((qItem as any)?.last_price > 0) {
      liveOptLtp = Number((qItem as any).last_price);
      globalLiveQuotes[cand.instrumentKey] = {
        ...(globalLiveQuotes[cand.instrumentKey] || {}),
        ...(qItem as any),
      };
    }
  } catch {
    // Ignored
  }

  const chainSnapshotLtp = Number(cand.ltp || liveOptLtp);
  cand.ltp = liveOptLtp;

  let candMomentumOk = false;
  try {
    let optRawCandles: any[] = [];
    const cachedOptC = optionIntradayCandleCache[cand.instrumentKey];
    if (cachedOptC && Date.now() - cachedOptC.timestamp < 5000) {
      optRawCandles = cachedOptC.raw;
    } else {
      const optCJson: any = await resilientFetchJson(
        `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(cand.instrumentKey)}/1minute`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Api-Version': '2.0',
          },
        },
        1,
        4000,
      );
      if (
        optCJson?.status === 'success' &&
        Array.isArray(optCJson?.data?.candles) &&
        optCJson.data.candles.length > 0
      ) {
        optRawCandles = optCJson.data.candles;
        optionIntradayCandleCache[cand.instrumentKey] = {
          timestamp: Date.now(),
          raw: optRawCandles,
        };
      }
    }

    if (optRawCandles.length >= 2) {
      // Upstox returns newest candle first at index 0
      const c0 = optRawCandles[0]; // current 1m candle: [time, open, high, low, close, vol]
      const c1 = optRawCandles[1]; // 1m ago
      const c2 = optRawCandles[2] || c1; // 2m ago
      const optOpen0 = Number(c0[1] || liveOptLtp);
      const optHigh0 = Math.max(Number(c0[2] || liveOptLtp), liveOptLtp);
      const optLow0 = Math.min(Number(c0[3] || liveOptLtp), liveOptLtp);
      const optOpen1 = Number(c1[1] || liveOptLtp);
      const optHigh1 = Number(c1[2] || liveOptLtp);
      const optLow1 = Number(c1[3] || liveOptLtp);
      const optClose1 = Number(c1[4] || liveOptLtp);
      const optClose2 = Number(c2[4] || liveOptLtp);
      const optLow2 = Number(c2[3] || liveOptLtp);
      const recentOpt3mHigh = Math.max(optHigh0, optHigh1, Number(c2[2] || 0));
      // Evaluate across combined 2-candle window (c1 + c0) so a brand-new 1-minute candle with a ₹0.50 range never gets falsely rejected
      const combined2mHigh = Math.max(optHigh0, optHigh1);
      const combined2mLow = Math.min(optLow0, optLow1);
      const isFlatRangeBar = combined2mHigh - combined2mLow <= (liveOptLtp < 15 ? 0.05 : 0.15);
      const combined2mRange = Math.max(liveOptLtp < 6 ? 0.15 : 0.5, combined2mHigh - combined2mLow);
      const optClosePos = isFlatRangeBar ? 0.65 : (liveOptLtp - combined2mLow) / combined2mRange;
      const optUpperWickRatio = isFlatRangeBar
        ? 0.15
        : (combined2mHigh - liveOptLtp) / combined2mRange;

      // Compute Option 3-minute VWAP / Typical Price Floor
      const tp0 = (optHigh0 + optLow0 + liveOptLtp) / 3;
      const tp1 = (optHigh1 + optLow1 + optClose1) / 3;
      const tp2 = (Number(c2[2] || liveOptLtp) + optLow2 + optClose2) / 3;
      const v0 = Math.max(1, Number(c0[5] || 1));
      const v1 = Math.max(1, Number(c1[5] || 1));
      const v2 = Math.max(1, Number(c2[5] || 1));
      const optShortVwap = (tp0 * v0 + tp1 * v1 + tp2 * v2) / (v0 + v1 + v2);

      // Verify Underlying Index's current 1m/2m trend is moving in the trade direction
      const idxLastCandle = enriched[enriched.length - 1];
      const idxPrevCandle = enriched[enriched.length - 2] || idxLastCandle;
      const isUnderlying1mConfirmingNow = isBullish
        ? liveLtp >= idxLastCandle.open * 0.9997 || liveLtp >= idxPrevCandle.close * 0.9997
        : liveLtp <= idxLastCandle.open * 1.0003 || liveLtp <= idxPrevCandle.close * 1.0003;

      const singleMinuteSpikePct = optOpen0 > 0 ? ((liveOptLtp - optOpen0) / optOpen0) * 100 : 0;
      // Allow either current 1m candle rising OR holding firm after a strong green c1/c2 impulse
      const isOptionRisingNow =
        (liveOptLtp >= optOpen0 && liveOptLtp >= optClose1 * 0.99) ||
        (liveOptLtp >= optClose1 * 0.994 && optClose1 >= optOpen1) ||
        (liveOptLtp > optClose2 && liveOptLtp >= optOpen0 * 0.992);

      const setup = evaluateOptionEntrySetup({
        liveOptLtp,
        optLow0,
        optLow1,
        optLow2,
        optOpen0,
        optClose1,
        optClose2,
        optShortVwap,
        optClosePos,
        optUpperWickRatio,
        singleMinuteSpikePct,
        isFlatRangeBar,
        isOptionRisingNow,
        isUnderlyingConfirming: isUnderlying1mConfirmingNow,
      });
      const { optLowestBase } = setup;

      if (isOptionSellingMode) {
        if (
          isUnderlying1mConfirmingNow &&
          liveOptLtp <= optOpen0 * 1.005 &&
          liveOptLtp <= optClose1 * 1.005 &&
          liveOptLtp <= optShortVwap * 1.008
        ) {
          candMomentumOk = true;
        }
      } else {
        // STRICT ANTI-CHASE ENTRY: Never bypass spike/wick limits just because 1m green tick fired!
        // Must satisfy genuine dip bounce, early base reversal, or controlled non-extended breakout.
        const baseOk = setup.baseOk;
        candMomentumOk = evaluateOptionDipMomentum({
          liveOptLtp,
          chainSnapshotLtp,
          optLowestBase,
          optOpen0,
          optShortVwap,
          optUpperWickRatio,
          singleMinuteSpikePct,
          isUnderlyingConfirming: isUnderlying1mConfirmingNow,
          isBaseMomentumOk: baseOk,
        });
      }
    } else if (optRawCandles.length === 1) {
      const c0 = optRawCandles[0];
      const optOpen0 = Number(c0[1] || liveOptLtp);
      if (isOptionSellingMode ? liveOptLtp <= optOpen0 * 1.005 : liveOptLtp >= optOpen0 * 0.985) {
        candMomentumOk = true;
      }
    } else if (optRawCandles.length === 0) {
      // Fallback for BSE / new contracts when Upstox 1m historical candles are empty or delayed
      const idxLastCandle = enriched[enriched.length - 1];
      const isUnderlying1mConfirmingNow = isBullish
        ? liveLtp >= idxLastCandle.open * 0.9997
        : liveLtp <= idxLastCandle.open * 1.0003;
      if (isUnderlying1mConfirmingNow && liveOptLtp >= chainSnapshotLtp * 0.98) {
        candMomentumOk = true;
      }
    }
  } catch (optCandleErr) {
    console.error('Option 1m candle eval error:', optCandleErr);
  }

  // Anti-Double-Order Guard (15-second buffer):
  const recentClosed = cand.instrumentKey ? recentClosedStrikes[cand.instrumentKey] : null;
  if (recentClosed) {
    const elapsedSinceExit = Date.now() - recentClosed.exitTime;
    if (elapsedSinceExit < STRIKE_LOCKOUT_MS) {
      candMomentumOk = false;
    }
  }
  // Protect against sudden flash drops (>12% below option chain snapshot), while allowing normal dip pullbacks!
  if (chainSnapshotLtp > 0 && liveOptLtp < chainSnapshotLtp * 0.88) {
    candMomentumOk = false;
  }

  return { liveOptLtp, momentumOk: candMomentumOk };
}
