// Option-selling (short CE / short PE / straddle & strangle) theta-decay engine:
// tracks the lowest premium, locks a trailing buy-back stop and squares off when the
// decay target or the capped stop is reached.
import {
  botConfig,
  botLogs,
  paperOrders,
  paperPositions,
  paperTradeHistory,
  livePositionStateTracker,
  pendingClosedPositions,
  recentClosedStrikes,
  setLastTradeExitTime,
  setCachedUpstoxLivePositions,
} from '../../../state';
import { calculateTradeCharges } from '../../../../src/utils/indicators';
import { invalidateCachedLiveDayOrders } from '../../../lib/upstoxHistory';
import { placeUpstoxOrderIpv4 } from '../../upstoxTransport';
import { savePostgresDb } from '../../persistence';

interface ShortOptionContext {
  token: string;
  isEodSquareOff: boolean;
  isBtstHoldRecommended: boolean;
}

// Word-boundary match: `RELIANCE`.includes('CE') must not look like a call option.
const OPTION_SYMBOL_RE = /\b(CE|PE)\b/;

export const isShortOptionPosition = (pos: any): boolean =>
  (pos.type === 'SELL' || pos.transactionType === 'SELL') &&
  (OPTION_SYMBOL_RE.test(String(pos.symbol || '')) || Boolean(pos.isOption));

// Returns true once the position has been squared off.
export async function handleShortOptionExit(
  pos: any,
  { token, isEodSquareOff, isBtstHoldRecommended }: ShortOptionContext,
): Promise<boolean> {
  if (!isShortOptionPosition(pos)) return false;

  const ltpShort = Number(pos.currentLTP || pos.buyPrice);
  pos.lowestLTP = Math.min(pos.lowestLTP || pos.buyPrice, ltpShort);
  const qtyShort = Math.max(1, Number(pos.quantity || 1));
  const shortGrossPnL = (pos.buyPrice - ltpShort) * qtyShort;
  const shortCharges = calculateTradeCharges(pos.buyPrice, qtyShort, true, ltpShort);
  const shortNetPnL = shortGrossPnL - shortCharges.roundTripCharges;
  const peakShortGross = (pos.buyPrice - (pos.lowestLTP || ltpShort)) * qtyShort;
  const peakShortNet = peakShortGross - shortCharges.roundTripCharges;
  pos.highestPnl = Math.max(pos.highestPnl || 0, shortGrossPnL, peakShortGross);
  pos.highestNetPnl = Math.max(pos.highestNetPnl || 0, shortNetPnL, peakShortNet);

  // For Option Selling: Profit increases as Option Premium decays toward ₹0!
  // Cap max loss at ₹400 or +15% premium spike; once net profit >= ₹160, lock trailing buy-back stop below entry price!
  const maxShortLossCap = 400;
  const staticShortStopPrice = Math.min(
    pos.buyPrice * 1.15,
    pos.buyPrice + maxShortLossCap / qtyShort,
  );
  const breakEvenShortPrice = pos.buyPrice - (shortCharges.roundTripCharges + 35) / qtyShort;
  let dynamicShortStopPrice = staticShortStopPrice;
  if (pos.highestNetPnl >= 350) {
    const lockRatio = pos.highestNetPnl >= 800 ? 0.85 : 0.72;
    dynamicShortStopPrice = Math.min(
      breakEvenShortPrice,
      pos.buyPrice - (pos.buyPrice - (pos.lowestLTP || ltpShort)) * lockRatio,
    );
  } else if (pos.highestNetPnl >= 160) {
    dynamicShortStopPrice = breakEvenShortPrice;
  }
  const prevShortStop = Number(pos.lockedStopLossPrice || staticShortStopPrice);
  dynamicShortStopPrice = Number(Math.min(prevShortStop, dynamicShortStopPrice).toFixed(2));
  pos.lockedStopLossPrice = dynamicShortStopPrice;
  pos.stopLoss = dynamicShortStopPrice;
  const shortTargetPrice = Number(Math.max(1, pos.buyPrice * 0.55).toFixed(2));
  pos.target = shortTargetPrice;

  pos.liveTrajectoryRadar = {
    nextMomentState:
      ltpShort >= dynamicShortStopPrice
        ? 'REVERSING_EXIT'
        : ltpShort <= shortTargetPrice * 1.05
          ? 'PEAK_EXHAUSTION'
          : 'ACCELERATING_UP',
    nextMomentLabel: `Option Selling (Theta Decay Active) — Target Decay ₹${shortTargetPrice} | Stop-Loss Cap ₹${dynamicShortStopPrice}`,
    nextMomentLabelMl: `ഓപ്ഷൻ സെല്ലിംഗ് (Theta Time Decay അനുകൂലം) — പ്രീമിയം കുറയുമ്പോൾ ലാഭം കൂടുന്നു (Target ₹${shortTargetPrice} | Auto SL ₹${dynamicShortStopPrice})`,
    holdOrExitVerdict: `SHORT THETA DECAY (Target ₹${shortTargetPrice} | SL ₹${dynamicShortStopPrice})`,
    holdOrExitVerdictMl: `തീറ്റ ഡികെയ് ലാഭം ലോക്ക് ചെയ്യുന്നു (Target ₹${shortTargetPrice} | SL ₹${dynamicShortStopPrice})`,
    dynamicStopLossPrice: dynamicShortStopPrice,
    dynamicTargetPrice: shortTargetPrice,
    protectedNetFloor:
      pos.highestNetPnl >= 160
        ? Math.round(
            (pos.buyPrice - dynamicShortStopPrice) * qtyShort - shortCharges.roundTripCharges,
          )
        : -maxShortLossCap,
    forecastedMaxOptionPrice: shortTargetPrice,
    option1mTrendIntact: ltpShort <= pos.buyPrice,
    underlyingAligned: true,
    updatedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };

  if (
    (isEodSquareOff && !isBtstHoldRecommended) ||
    ltpShort >= dynamicShortStopPrice ||
    ltpShort <= shortTargetPrice
  ) {
    // Honour the stop-loss cap price (dynamicShortStopPrice) in Paper Mode so 1-second tick jumps never exceed the ₹400 max loss cap!

    const exitPx =
      ltpShort >= dynamicShortStopPrice && dynamicShortStopPrice > 0
        ? Number(Math.min(ltpShort, dynamicShortStopPrice).toFixed(2))
        : Number(ltpShort.toFixed(2));
    const finalGross = Number(((pos.buyPrice - exitPx) * qtyShort).toFixed(2));
    const finalNet = Number((finalGross - shortCharges.roundTripCharges).toFixed(2));

    // CRITICAL: Stamp getLastTradeExitTime() & recentClosedStrikes so Option Selling exits also enforce the 3-minute cooldown & 30-minute loss re-entry ban!
    setLastTradeExitTime(Date.now());
    if (pos.instrumentKey) {
      recentClosedStrikes[pos.instrumentKey] = {
        exitTime: Date.now(),
        highestLTP: Math.max(pos.buyPrice, exitPx),
        sellPrice: finalGross >= 0 ? pos.buyPrice * 1.01 : pos.buyPrice * 0.95,
      };
    }
    const shortExitReason =
      ltpShort <= shortTargetPrice
        ? `[OPTION SELLING THETA TARGET HIT] ${pos.symbol} decayed from ₹${pos.buyPrice} to ₹${exitPx} -> Locked +₹${finalNet.toFixed(2)} Net Profit!`
        : finalNet >= 0
          ? `[OPTION SELLING TRAILING SL LOCKED] ${pos.symbol} exited at ₹${exitPx} -> Locked +₹${finalNet.toFixed(2)} Net Profit!`
          : `[OPTION SELLING STOP-LOSS CAP] ${pos.symbol} rose to ₹${exitPx} (SL ₹${dynamicShortStopPrice}) -> Capped loss early!`;
    botLogs.unshift({
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      message: shortExitReason,
      type: finalGross >= 0 ? 'SUCCESS' : 'ERROR',
    });
    if (botLogs.length > 200) botLogs.length = 200;

    if (pos.mode === 'PAPER_TRADING' || paperPositions.some((p) => p.id === pos.id)) {
      const closedShort = paperPositions.find((p) => p.id === pos.id);
      if (closedShort) {
        closedShort.sellPrice = exitPx;
        closedShort.realizedPnL = finalGross;
        closedShort.brokerageCharges = shortCharges.roundTripCharges;
        closedShort.netRealizedPnL = finalNet;
        closedShort.exitReason = shortExitReason;
        closedShort.closeTime = new Date().toISOString();
        paperTradeHistory.unshift(closedShort);
      }
      paperPositions.splice(
        0,
        paperPositions.length,
        ...paperPositions.filter((p) => p.id !== pos.id),
      );
      savePostgresDb().catch(() => {
        /* ignore */
      });
    } else if (botConfig.mode === 'UPSTOX_LIVE' && token) {
      try {
        const buyBackRes = await placeUpstoxOrderIpv4(
          {
            quantity: qtyShort,
            product: pos.product || (pos.productType === 'INTRADAY' ? 'I' : 'D'),
            validity: 'DAY',
            price: 0,
            tag: 'bot_short_exit',
            instrument_token: pos.instrumentKey,
            order_type: 'MARKET',
            transaction_type: 'BUY',
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false,
          },
          token,
        );

        if (buyBackRes?.status === 'success') {
          const shortProd = pos.product || (pos.productType === 'INTRADAY' ? 'I' : 'D');
          const shortTrackerKey = `${pos.instrumentKey || pos.id}|${shortProd}`;
          pendingClosedPositions[shortTrackerKey] = Date.now();
          delete livePositionStateTracker[shortTrackerKey];
          delete livePositionStateTracker[pos.instrumentKey || pos.id];
          invalidateCachedLiveDayOrders();
          setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
          paperOrders.unshift({
            id: 'ORD' + Date.now(),
            orderId: buyBackRes.data?.order_id || 'LIVE_' + Date.now().toString().slice(-6),
            symbol: pos.symbol,
            instrumentKey: pos.instrumentKey,
            transactionType: 'BUY',
            type: 'BUY',
            orderType: 'MARKET',
            productType: pos.productType || 'DELIVERY',
            quantity: qtyShort,
            buyPrice: pos.buyPrice,
            sellPrice: exitPx,
            price: exitPx,
            executedPrice: exitPx,
            realizedPnL: finalGross,
            brokerageCharges: shortCharges.roundTripCharges,
            netRealizedPnL: finalNet,
            status: 'COMPLETE',
            timestamp: new Date().toLocaleTimeString('en-IN'),
            time: new Date().toISOString(),
            mode: 'UPSTOX_LIVE',
          });
          if (paperOrders.length > 200) paperOrders.length = 200;
          paperTradeHistory.unshift({
            id: pos.id || 'LIVE_' + Date.now(),
            symbol: pos.symbol,
            instrumentKey: pos.instrumentKey,
            quantity: qtyShort,
            buyPrice: pos.buyPrice,
            sellPrice: exitPx,
            currentLTP: exitPx,
            realizedPnL: finalGross,
            brokerageCharges: shortCharges.roundTripCharges,
            netRealizedPnL: finalNet,
            pnl: finalGross,
            closeTime: new Date().toISOString(),
            mode: 'UPSTOX_LIVE',
            isOption: true,
          });
          if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
          savePostgresDb().catch(() => {
            /* ignore */
          });
        } else {
          let errDetail =
            buyBackRes?.errors?.[0]?.message || buyBackRes?.message || JSON.stringify(buyBackRes);
          if (
            errDetail.includes('static IP') ||
            errDetail.includes('34.96.48') ||
            errDetail.includes('UDAPI1154')
          ) {
            const { getDetectedContainerIp } = await import('../../upstoxTransport');
            const liveIpNow = await getDetectedContainerIp();
            errDetail = `⚠️ Upstox static IP restriction: Whitelist ${liveIpNow ? `34.180.11.27, ${liveIpNow}` : '34.180.11.27'} in Upstox Developer Console. (${errDetail})`;
          }
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: `[UPSTOX LIVE SHORT EXIT REJECTED] Buy-back for ${pos.symbol} rejected: ${errDetail}`,
            type: 'ERROR',
          });
          if (botLogs.length > 200) botLogs.length = 200;
        }
      } catch (e: any) {
        console.error('Error executing live short option exit:', e);
      }
    }
    return true;
  }
  return false;
}
