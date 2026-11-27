// Option-position exit engine: live option candle tracking, peak-lock trailing stops,
// theta-decay exits and paper/live square-off execution for long option positions.
import {
  botConfig,
  botLogs,
  paperPositions,
  optionIntradayCandleCache,
  pendingClosedPositions,
  recentClosedStrikes,
  setLastTradeExitTime,
} from '../../../state';
import { resilientFetchJson } from '../../../lib/http';
import { sendTelegramNotification } from '../../notifications';
import { calculateTradeCharges } from '../../../../src/utils/indicators';
import { fetchLiveUpstoxCharges } from '../../../lib/charges';
import { decideOptionExit } from './optionExit/decideExit';
import { closePaperOptionPosition } from './optionExit/closePaperOptionPosition';
import { executeLiveOptionExit } from './optionExit/executeLiveOptionExit';

const recentLiveExitOrderMs: Record<string, number> = {};

export interface OptionExitContext {
  token: string;
  isEodSquareOff: boolean;
  isBtstHoldRecommended: boolean;
  quoteObj: any;
  latestUnderlyingSig: any;
  activePositions: any[];
}

export async function monitorOptionPosition(
  pos: any,
  {
    token,
    isEodSquareOff,
    isBtstHoldRecommended,
    quoteObj,
    latestUnderlyingSig,
    activePositions,
  }: OptionExitContext,
): Promise<void> {
  const openedMs =
    Number(pos.openedAtMs || 0) ||
    (String(pos.id || '').startsWith('POS') ? Number(String(pos.id).replace(/\D+/g, '')) : 0);

  // Fetch 1-minute candles of this active option contract FIRST (cached 2.5s)
  // so that if quotes/ltp ever had a network hiccup, c0[4] (latest 1m close) and c[2] (post-entry 1m high)
  // IMMEDIATELY update pos.currentLTP and pos.highestLTP!
  let optCandlesActive: any[] = [];

  if (token && pos.instrumentKey) {
    try {
      const cachedOpt = optionIntradayCandleCache[pos.instrumentKey];
      if (cachedOpt && Date.now() - cachedOpt.timestamp < 2500) {
        optCandlesActive = cachedOpt.raw;
      } else {
        const cJson: any = await resilientFetchJson(
          `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(pos.instrumentKey)}/1minute`,
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
        if (
          cJson?.status === 'success' &&
          Array.isArray(cJson?.data?.candles) &&
          cJson.data.candles.length > 0
        ) {
          optCandlesActive = cJson.data.candles;
          optionIntradayCandleCache[pos.instrumentKey] = {
            timestamp: Date.now(),
            raw: optCandlesActive,
          };
        } else if (cachedOpt?.raw?.length > 0) {
          optCandlesActive = cachedOpt.raw;
        }
      }

      if (optCandlesActive.length > 0) {
        const c0 = optCandlesActive[0];
        const candleLatestClose = Number(c0?.[4] || 0);
        const candleLatestLow = Number(c0?.[3] || candleLatestClose);
        const c0TimeMs = new Date(c0?.[0]).getTime();
        // Synchronize from 1m candle ONLY as fallback when live market quote LTP is missing or zero,
        // so a 10–40s stale historical candle close never overwrites a live quote bounce and triggers a phantom SL!
        if (
          candleLatestClose > 0 &&
          candleLatestClose < pos.buyPrice * 50 &&
          (!quoteObj || Number(quoteObj.last_price) <= 0)
        ) {
          pos.currentLTP = candleLatestClose;
          const isShortPos = pos.type === 'SELL' || pos.transactionType === 'SELL';
          pos.pnl = Number(
            (
              (isShortPos ? pos.buyPrice - pos.currentLTP : pos.currentLTP - pos.buyPrice) *
              pos.quantity
            ).toFixed(2),
          );
        }
        // Capture true post-entry 1m candle highs ONLY from candles strictly starting after entry timestamp
        // (never pull in pre-entry spike highs from the entry minute before entry fill!).
        for (const c of optCandlesActive.slice(0, 15)) {
          const cTimeMs = new Date(c[0]).getTime();
          const cHigh = Number(c[2] || 0);
          if (cHigh > 0 && cHigh < pos.buyPrice * 50 && openedMs > 0 && cTimeMs > openedMs) {
            pos.highestLTP = Math.max(pos.highestLTP || pos.buyPrice, cHigh);
          }
        }
      }
    } catch {
      // Ignored
    }
    if (!pos.buyPrice || pos.buyPrice <= 0) {
      return;
    }

    const ltp = Number(pos.currentLTP || pos.buyPrice);
    const { shouldSell, sellReason, dynamicStopLossPrice, qty, posProdCode, posTrackerKey } =
      await decideOptionExit({
        pos,
        isEodSquareOff,
        isBtstHoldRecommended,
        latestUnderlyingSig,
        openedMs,
        optCandlesActive,
      });

    if (shouldSell) {
      const isLiveModeExit =
        !(pos.mode === 'PAPER_TRADING' || paperPositions.some((p) => p.id === pos.id)) &&
        botConfig.mode === 'UPSTOX_LIVE';
      const exitMutexKey = posTrackerKey || `${pos.instrumentKey || pos.symbol}|${posProdCode}`;
      if (
        isLiveModeExit &&
        exitMutexKey &&
        (Date.now() - (recentLiveExitOrderMs[exitMutexKey] || 0) < 30000 ||
          Date.now() - (pendingClosedPositions[exitMutexKey] || 0) < 20000)
      ) {
        return;
      }
      // In Paper Mode, honour exchange SL trigger price; in UPSTOX_LIVE, record conservative live LTP (never inflate above live market!)
      const finalExecExitPrice =
        !isLiveModeExit && ltp <= dynamicStopLossPrice && dynamicStopLossPrice > 0
          ? Number(Math.max(ltp, dynamicStopLossPrice).toFixed(2))
          : Number(ltp.toFixed(2));
      const finalGrossPnL = Number(((finalExecExitPrice - pos.buyPrice) * qty).toFixed(2));
      let finalBrokerage = calculateTradeCharges(
        pos.buyPrice,
        qty,
        true,
        finalExecExitPrice,
      ).roundTripCharges;
      try {
        const liveExitCharges = await fetchLiveUpstoxCharges(
          pos.instrumentKey || pos.symbol,
          qty,
          pos.buyPrice,
          finalExecExitPrice,
          pos.product || pos.productType || 'D',
        );
        if (liveExitCharges && liveExitCharges.totalRoundTrip > 0) {
          finalBrokerage = liveExitCharges.totalRoundTrip;
        }
      } catch {
        // Ignored
      }
      const finalNetPnL = Number((finalGrossPnL - finalBrokerage).toFixed(2));
      const finalPnlPercent =
        pos.buyPrice > 0 ? ((finalExecExitPrice - pos.buyPrice) / pos.buyPrice) * 100 : 0;

      setLastTradeExitTime(Date.now());
      if (pos.instrumentKey) {
        recentClosedStrikes[pos.instrumentKey] = {
          exitTime: Date.now(),
          highestLTP: Math.max(pos.highestLTP || pos.buyPrice, finalExecExitPrice),
          buyPrice: pos.buyPrice,
          sellPrice: finalExecExitPrice,
          netRealizedPnL: finalNetPnL,
        };
      }
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: sellReason,
        type: finalNetPnL > 0 ? 'SUCCESS' : 'ERROR',
      });
      if (botLogs.length > 200) botLogs.length = 200;

      // Send Telegram exit notification
      sendTelegramNotification(
        `${finalNetPnL >= 0 ? '🎉 <b>PROFIT LOCKED & POSITION EXITED</b>' : '⚠️ <b>STOP-LOSS EXIT TRIGGERED</b>'}\n\n` +
          `📊 <b>Symbol:</b> <code>${pos.symbol}</code>\n` +
          `💵 <b>Gross PnL:</b> ${finalGrossPnL >= 0 ? '+' : ''}₹${finalGrossPnL.toFixed(2)} | <b>Net PnL:</b> ${finalNetPnL >= 0 ? '+' : ''}₹${finalNetPnL.toFixed(2)} (${finalPnlPercent.toFixed(2)}%)\n` +
          `🛡️ <b>Exit Reason:</b> ${sellReason}\n` +
          `⏰ <b>Time:</b> ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
      ).catch(() => {
        /* ignore */
      });
      const isPaperExit =
        pos.mode === 'PAPER_TRADING' || paperPositions.some((p) => p.id === pos.id);
      if (isPaperExit) {
        closePaperOptionPosition({
          pos,
          finalExecExitPrice,
          finalGrossPnL,
          finalBrokerage,
          finalNetPnL,
          sellReason,
        });
      } else if (botConfig.mode === 'UPSTOX_LIVE') {
        await executeLiveOptionExit({
          pos,
          token,
          posProdCode,
          exitMutexKey,
          activePositions,
          finalExecExitPrice,
          finalGrossPnL,
          finalBrokerage,
          finalNetPnL,
          recentLiveExitOrderMs,
        });
      }
    }
  }
}
