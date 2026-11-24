// Live-mode option exit: places the Upstox square-off order behind a double-sell
// mutex, records the order/trade, and reports IP-restriction rejections.
import {
  botLogs,
  livePositionStateTracker,
  paperOrders,
  paperTradeHistory,
  pendingClosedPositions,
  setCachedUpstoxLivePositions,
} from '../../../../state';
import { invalidateCachedLiveDayOrders } from '../../../../lib/upstoxHistory';
import { placeUpstoxOrderIpv4 } from '../../../upstoxTransport';
import { sendTelegramNotification } from '../../../notifications';
import { savePostgresDb } from '../../../persistence';

export interface ExecuteLiveOptionExitParams {
  pos: any;
  token: string;
  posProdCode: string;
  exitMutexKey: string;
  activePositions: any[];
  finalExecExitPrice: number;
  finalGrossPnL: number;
  finalBrokerage: number;
  finalNetPnL: number;
  recentLiveExitOrderMs: Record<string, number>;
}

export async function executeLiveOptionExit(params: ExecuteLiveOptionExitParams): Promise<void> {
  const {
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
  } = params;

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
      let errDetail = sellRes?.errors?.[0]?.message || sellRes?.message || JSON.stringify(sellRes);
      if (
        errDetail.includes('static IP') ||
        errDetail.includes('34.96.48') ||
        errDetail.includes('UDAPI1154')
      ) {
        const { getDetectedContainerIp } = await import('../../../upstoxTransport');
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
