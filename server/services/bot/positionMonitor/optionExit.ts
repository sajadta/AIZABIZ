// Option-position exit engine: live option candle tracking, peak-lock trailing stops,
// theta-decay exits and paper/live square-off execution for long option positions.
import {
  botConfig,
  botLogs,
  paperOrders,
  paperPositions,
  paperTradeHistory,
  livePositionStateTracker,
  pendingClosedPositions,
  optionIntradayCandleCache,
  recentClosedStrikes,
  setLastTradeExitTime,
  setCachedUpstoxLivePositions,
} from '../../../state';
import { resilientFetchJson } from '../../../lib/http';
import { invalidateCachedLiveDayOrders } from '../../../lib/upstoxHistory';
import { placeUpstoxOrderIpv4 } from '../../upstoxTransport';
import { sendTelegramNotification } from '../../notifications';
import { savePostgresDb } from '../../persistence';
import { calculateTradeCharges } from '../../../../src/utils/indicators';
import { fetchLiveUpstoxCharges } from '../../../lib/charges';
import { decideOptionExit } from './optionExit/decideExit';

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
      if (pos.mode === 'PAPER_TRADING' || paperPositions.some((p) => p.id === pos.id)) {
        const closedPos = paperPositions.find((p) => p.id === pos.id);
        if (closedPos) {
          closedPos.currentLTP = finalExecExitPrice;
          closedPos.sellPrice = finalExecExitPrice;
          closedPos.highestLTP = Math.max(
            closedPos.highestLTP || closedPos.buyPrice,
            pos.highestLTP || closedPos.buyPrice,
            finalExecExitPrice,
          );
          closedPos.pnl = finalGrossPnL;
          closedPos.realizedPnL = finalGrossPnL;
          closedPos.brokerageCharges = finalBrokerage;
          closedPos.netRealizedPnL = finalNetPnL;
          closedPos.exitReason = sellReason;
          closedPos.closeTime = new Date().toISOString();
          closedPos.mode = 'PAPER_TRADING';
          paperTradeHistory.unshift(closedPos);
          if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
          paperOrders.unshift({
            id: 'ORD' + Date.now(),
            orderId: 'PAP_' + Date.now().toString().slice(-6),
            positionId: closedPos.id,
            symbol: closedPos.symbol,
            instrumentKey: closedPos.instrumentKey,
            transactionType: 'SELL',
            type: 'SELL',
            orderType: 'MARKET',
            productType: closedPos.productType || 'INTRADAY',
            quantity: closedPos.quantity,
            buyPrice: closedPos.buyPrice,
            sellPrice: finalExecExitPrice,
            price: finalExecExitPrice,
            executedPrice: finalExecExitPrice,
            realizedPnL: finalGrossPnL,
            brokerageCharges: finalBrokerage,
            netRealizedPnL: finalNetPnL,
            status: 'COMPLETE',
            timestamp: new Date().toLocaleTimeString('en-IN'),
            time: new Date().toISOString(),
            mode: 'PAPER_TRADING',
          });
          // Also stamp the corresponding BUY order with the closed trade's exit price and P&L so Orders tab NEVER shows ₹0.00!
          const matchingBuyOrder = paperOrders.find(
            (o) =>
              o.transactionType === 'BUY' &&
              (o.positionId === closedPos.id || (o.symbol === closedPos.symbol && !o.sellPrice)),
          );
          if (matchingBuyOrder) {
            matchingBuyOrder.sellPrice = finalExecExitPrice;
            matchingBuyOrder.realizedPnL = finalGrossPnL;
            matchingBuyOrder.brokerageCharges = finalBrokerage;
            matchingBuyOrder.netRealizedPnL = finalNetPnL;
          }
        }
        paperPositions.splice(
          0,
          paperPositions.length,
          ...paperPositions.filter((p) => p.id !== pos.id),
        );
        savePostgresDb().catch(() => {
          /* ignore */
        });
      } else if (botConfig.mode === 'UPSTOX_LIVE') {
        // Place sell order via Upstox API with 12-second double-sell mutex
        try {
          if (exitMutexKey) recentLiveExitOrderMs[exitMutexKey] = Date.now();
          const sellRes = await placeUpstoxOrderIpv4(
            {
              quantity: pos.quantity,
              product: posProdCode,
              validity: 'DAY',
              price: 0,
              tag: finalNetPnL >= 0 ? 'bot_target_profit' : 'bot_stop_loss',
              instrument_token: pos.instrumentKey,
              order_type: 'MARKET',
              transaction_type: pos.type === 'SELL' ? 'BUY' : 'SELL',
              disclosed_quantity: 0,
              trigger_price: 0,
              is_amo: false,
            },
            token,
          );

          if (sellRes?.status === 'success') {
            pendingClosedPositions[exitMutexKey] = Date.now();
            delete livePositionStateTracker[exitMutexKey];
            delete livePositionStateTracker[pos.instrumentKey || pos.id];
            invalidateCachedLiveDayOrders();
            setCachedUpstoxLivePositions({
              timestamp: Date.now(),
              list: activePositions.filter(
                (p: any) =>
                  !(
                    p.instrumentKey === pos.instrumentKey &&
                    (p.product || (p.productType === 'INTRADAY' ? 'I' : 'D')) === posProdCode
                  ),
              ),
            });
            paperOrders.unshift({
              id: 'ORD' + Date.now(),
              orderId: sellRes.data?.order_id || 'LIVE_' + Date.now().toString().slice(-6),
              symbol: pos.symbol,
              instrumentKey: pos.instrumentKey,
              transactionType: pos.type === 'SELL' ? 'BUY' : 'SELL',
              type: pos.type === 'SELL' ? 'BUY' : 'SELL',
              orderType: 'MARKET',
              productType: pos.productType || 'DELIVERY',
              quantity: pos.quantity,
              buyPrice: pos.buyPrice,
              sellPrice: finalExecExitPrice,
              price: finalExecExitPrice,
              executedPrice: finalExecExitPrice,
              realizedPnL: finalGrossPnL,
              brokerageCharges: finalBrokerage,
              netRealizedPnL: finalNetPnL,
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
              quantity: pos.quantity,
              buyPrice: pos.buyPrice,
              sellPrice: finalExecExitPrice,
              currentLTP: finalExecExitPrice,
              highestLTP: Math.max(pos.highestLTP || pos.buyPrice, finalExecExitPrice),
              realizedPnL: finalGrossPnL,
              brokerageCharges: finalBrokerage,
              netRealizedPnL: finalNetPnL,
              pnl: finalGrossPnL,
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
              sellRes?.errors?.[0]?.message || sellRes?.message || JSON.stringify(sellRes);
            if (
              errDetail.includes('static IP') ||
              errDetail.includes('34.96.48') ||
              errDetail.includes('UDAPI1154')
            ) {
              const { getDetectedContainerIp } = await import('../../upstoxTransport');
              const liveIpNow = await getDetectedContainerIp();
              errDetail = `⚠️ Upstox static IP restriction: Upstox Developer Console-ൽ നിങ്ങളുടെ Static IP-കൾ (34.180.11.27${liveIpNow ? `, ${liveIpNow}` : ''}) കൃത്യമായി നൽകിയിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക. (${errDetail})`;
            }
            const exitErrText = `[UPSTOX LIVE EXIT REJECTED] Exit order for ${pos.symbol} rejected: ${errDetail}`;
            botLogs.unshift({
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              message: exitErrText,
              type: 'ERROR',
            });
            if (botLogs.length > 200) botLogs.length = 200;
            sendTelegramNotification(
              `🔴 <b>UPSTOX LIVE EXIT FAILED</b>\n\n` +
                `⚠️ Could not exit position: <code>${pos.symbol}</code>\n` +
                `❌ Reason: ${errDetail}\n` +
                `👉 Please ensure your live outbound IP is whitelisted in Upstox Developer Console!`,
            ).catch(() => {
              /* ignore */
            });
          }
        } catch (e: any) {
          console.error('Error executing live exit order:', e);
        }
      }
    }
  }
}
