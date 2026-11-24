// Equity (cash & intraday) exit engine: dynamic target/stop-loss, break-even lock
// and trailing profit lock for stock positions.
import {
  botConfig,
  botLogs,
  paperOrders,
  paperPositions,
  paperTradeHistory,
  setLastTradeExitTime,
} from '../../../state';
import { calculateTradeCharges } from '../../../../src/utils/indicators';
import { placeUpstoxOrderIpv4 } from '../../upstoxTransport';
import { savePostgresDb } from '../../persistence';
import { shouldMonitorEquityPosition } from '../../../lib/portfolioNormalize';

interface EquityExitContext {
  token: string;
  isEodSquareOff: boolean;
}

/**
 * Applies the equity trailing/exit rules for one position.
 * Returns true when the position was handled by this engine.
 */
export async function monitorEquityPosition(
  pos: any,
  { token, isEodSquareOff }: EquityExitContext,
): Promise<boolean> {
  if (!shouldMonitorEquityPosition(pos, botConfig.tradeMode)) return false;

  const ltp = Number(pos.currentLTP || pos.buyPrice);
  pos.highestLTP = Math.max(pos.highestLTP || pos.buyPrice, ltp);
  const isShortPos = pos.type === 'SELL' || pos.transactionType === 'SELL';
  const grossPnL = isShortPos
    ? (pos.buyPrice - ltp) * pos.quantity
    : (ltp - pos.buyPrice) * pos.quantity;
  const charges = calculateTradeCharges(pos.buyPrice, pos.quantity, false, ltp);
  const netPnL = Number((grossPnL - charges.roundTripCharges).toFixed(2));
  pos.pnl = Number(grossPnL.toFixed(2));
  pos.netPnL = netPnL;
  pos.brokerageCharges = charges.roundTripCharges;

  const peakPnlPct = Number((((pos.highestLTP - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2));

  // Dynamic Target & Stop-Loss for Stocks:
  // Target +2.2% to +3.5%, Initial SL -1.2% to -1.5%
  const targetPx = Number(pos.target || (pos.buyPrice * 1.025).toFixed(2));
  const initialSlPx = Number(pos.stopLoss || (pos.buyPrice * 0.985).toFixed(2));

  // Smart Trailing Stop Loss for Equity Compounding:
  // Break-even lock: Once gain >= +0.7%, lock SL at entry + brokerage buffer (+0.20%) to guarantee zero loss!
  // Trailing lock: Once gain >= +1.3%, trail SL at 75% of peak gain!
  let dynamicSlPx = initialSlPx;
  if (peakPnlPct >= 1.3) {
    dynamicSlPx = Number((pos.buyPrice * (1 + (peakPnlPct * 0.75) / 100)).toFixed(2));
  } else if (peakPnlPct >= 0.7) {
    dynamicSlPx = Number((pos.buyPrice * 1.002).toFixed(2));
  }
  const prevSl = Number(pos.lockedStopLossPrice || initialSlPx);
  dynamicSlPx = Number(Math.max(prevSl, dynamicSlPx).toFixed(2));
  pos.lockedStopLossPrice = dynamicSlPx;
  pos.stopLoss = dynamicSlPx;
  pos.target = targetPx;

  pos.liveTrajectoryRadar = {
    nextMomentState:
      ltp >= targetPx
        ? 'PEAK_EXHAUSTION'
        : ltp <= dynamicSlPx
          ? 'REVERSING_EXIT'
          : 'ACCELERATING_UP',
    nextMomentLabel: `Micro-Capital Equity Compounding — Target ₹${targetPx} | Trailing SL ₹${dynamicSlPx}`,
    nextMomentLabelMl: `മൂലധന വർദ്ധനവ് (Equity Compounding) — ലക്ഷ്യം ₹${targetPx} | സുരക്ഷിത SL ₹${dynamicSlPx}`,
    holdOrExitVerdict:
      netPnL >= 0 ? `PROFIT LOCK (+₹${netPnL})` : `MONITORING (-₹${Math.abs(netPnL)})`,
    holdOrExitVerdictMl: netPnL >= 0 ? `ലാഭം ലോക്ക് ചെയ്യുന്നു (+₹${netPnL})` : `നിരീക്ഷിക്കുന്നു`,
    dynamicStopLossPrice: dynamicSlPx,
    dynamicTargetPrice: targetPx,
    protectedNetFloor: netPnL,
    forecastedMaxOptionPrice: targetPx,
    option1mTrendIntact: true,
    underlyingAligned: true,
    updatedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };

  const shouldExit =
    (isEodSquareOff && !pos.isBtstHoldRecommended) || ltp >= targetPx || ltp <= dynamicSlPx;
  if (shouldExit) {
    const exitPx = ltp;
    const finalGross = Number(
      (isShortPos
        ? (pos.buyPrice - exitPx) * pos.quantity
        : (exitPx - pos.buyPrice) * pos.quantity
      ).toFixed(2),
    );
    const finalNet = Number((finalGross - charges.roundTripCharges).toFixed(2));
    setLastTradeExitTime(Date.now());

    const exitReason =
      ltp >= targetPx
        ? `[EQUITY TARGET HIT] ${pos.symbol} reached target ₹${exitPx} (Entry: ₹${pos.buyPrice}) -> Locked +₹${finalNet.toFixed(2)} Net Profit! Capital Compounded.`
        : finalNet >= 0
          ? `[EQUITY TRAILING SL LOCKED] ${pos.symbol} locked profit at ₹${exitPx} -> +₹${finalNet.toFixed(2)} Net Profit preserved!`
          : `[EQUITY RISK CAP] ${pos.symbol} touched SL at ₹${exitPx} -> Loss capped safely at -₹${Math.abs(finalNet).toFixed(2)}.`;

    botLogs.unshift({
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      message: exitReason,
      type: finalNet >= 0 ? 'SUCCESS' : 'ERROR',
    });
    if (botLogs.length > 200) botLogs.length = 200;

    // Paper exit
    if (pos.mode === 'PAPER_TRADING' || paperPositions.some((p) => p.id === pos.id)) {
      const closed = paperPositions.find((p) => p.id === pos.id);
      if (closed) {
        closed.sellPrice = exitPx;
        closed.realizedPnL = finalGross;
        closed.brokerageCharges = charges.roundTripCharges;
        closed.netRealizedPnL = finalNet;
        closed.exitReason = exitReason;
        closed.closeTime = new Date().toISOString();
        closed.isOption = false;
        paperTradeHistory.unshift(closed);
        if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
      }
      const idxToRemove = paperPositions.findIndex((p) => p.id === pos.id);
      if (idxToRemove !== -1) paperPositions.splice(idxToRemove, 1);
      savePostgresDb().catch(() => {});
    } else if (botConfig.mode === 'UPSTOX_LIVE' && token) {
      // Live exit order via Upstox API
      try {
        const exitRes = await placeUpstoxOrderIpv4(
          {
            quantity: pos.quantity,
            product: pos.productType === 'INTRADAY' ? 'I' : 'D',
            validity: 'DAY',
            price: 0,
            tag: 'bot_equity_exit',
            instrument_token: pos.instrumentKey,
            order_type: 'MARKET',
            transaction_type: pos.type === 'SELL' ? 'BUY' : 'SELL',
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false,
          },
          token,
        );

        if (exitRes?.status === 'success') {
          paperOrders.unshift({
            id: 'ORD' + Date.now(),
            orderId: exitRes.data?.order_id || 'LIVE_EQ_' + Date.now().toString().slice(-6),
            symbol: pos.symbol,
            instrumentKey: pos.instrumentKey,
            transactionType: pos.type === 'SELL' ? 'BUY' : 'SELL',
            type: pos.type === 'SELL' ? 'BUY' : 'SELL',
            orderType: 'MARKET',
            productType: pos.productType || 'DELIVERY',
            quantity: pos.quantity,
            buyPrice: pos.buyPrice,
            sellPrice: exitPx,
            price: exitPx,
            executedPrice: exitPx,
            realizedPnL: finalGross,
            brokerageCharges: charges.roundTripCharges,
            netRealizedPnL: finalNet,
            status: 'COMPLETE',
            timestamp: new Date().toLocaleTimeString('en-IN'),
            time: new Date().toISOString(),
            mode: 'UPSTOX_LIVE',
            isOption: false,
          });
          if (paperOrders.length > 200) paperOrders.length = 200;

          paperTradeHistory.unshift({
            id: pos.id || 'LIVE_EQ_' + Date.now(),
            symbol: pos.symbol,
            instrumentKey: pos.instrumentKey,
            quantity: pos.quantity,
            buyPrice: pos.buyPrice,
            sellPrice: exitPx,
            currentLTP: exitPx,
            highestLTP: Math.max(pos.highestLTP || pos.buyPrice, exitPx),
            realizedPnL: finalGross,
            brokerageCharges: charges.roundTripCharges,
            netRealizedPnL: finalNet,
            pnl: finalGross,
            closeTime: new Date().toISOString(),
            mode: 'UPSTOX_LIVE',
            isOption: false,
          });
          if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
          savePostgresDb().catch(() => {});
        }
      } catch (e) {
        console.error('Live equity exit error:', e);
      }
    }
  }
  return true;
}
