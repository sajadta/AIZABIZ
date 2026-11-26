// Live Upstox entry: double-order guard, order placement, cache invalidation and
// rejection reporting for the top-ranked candidate.
import {
  botLogs,
  paperOrders,
  setCachedUpstoxLiveMargin,
  setCachedUpstoxLivePositions,
  getCachedUpstoxLiveMargin,
  FIXED_PRIMARY_IP,
} from '../../../state';
import { strikeDailyEntryCount } from '../antiChurn';
import { invalidateCachedLiveDayOrders } from '../../../lib/upstoxHistory';
import { placeUpstoxOrderIpv4, getDetectedContainerIp } from '../../upstoxTransport';
import { sendTelegramNotification } from '../../notifications';
import { savePostgresDb } from '../../persistence';

let lastLiveOrderPlacedAtMs = 0;
const recentLiveStrikeOrderMs: Record<string, number> = {};

export interface LiveEntryParams {
  token: string;
  cand: any;
  liveAvailableMargin: number;
  activePositions: any[];
}

export async function executeLiveEntry({
  token,
  cand,
  liveAvailableMargin,
  activePositions,
}: LiveEntryParams): Promise<void> {
  // Live Double-Order Guard: Never place another live order within 10s of a prior placement while Upstox settles positions & margin!
  if (
    Date.now() - lastLiveOrderPlacedAtMs < 10000 ||
    (cand.optInstrumentKey &&
      Date.now() - (recentLiveStrikeOrderMs[cand.optInstrumentKey] || 0) < 15000)
  ) {
    return;
  }
  try {
    lastLiveOrderPlacedAtMs = Date.now();
    if (cand.optInstrumentKey) {
      recentLiveStrikeOrderMs[cand.optInstrumentKey] = Date.now();
    }
    const orderJson = await placeUpstoxOrderIpv4(
      {
        quantity: cand.targetQuantity,
        product: cand.isEquityTrade ? 'D' : 'D',
        validity: 'DAY',
        price: cand.execOrderType === 'LIMIT' ? cand.limitPriceWithSlippageGuard : 0,
        tag: cand.isEquityTrade
          ? 'bot_equity_buy'
          : cand.isOptionSellingEntry
            ? 'bot_auto_short'
            : 'bot_auto_entry',
        instrument_token: cand.optInstrumentKey,
        order_type: cand.execOrderType,
        transaction_type: cand.execTransactionType,
        disclosed_quantity: 0,
        trigger_price: 0,
        is_amo: false,
      },
      token,
    );
    if (orderJson?.status === 'success') {
      if (cand.optInstrumentKey) {
        strikeDailyEntryCount[cand.optInstrumentKey] =
          (strikeDailyEntryCount[cand.optInstrumentKey] || 0) + 1;
      }
      // Immediately invalidate cached live positions/orders & deduct estimated used cash so the very next 1s tick NEVER double-orders!
      invalidateCachedLiveDayOrders();
      setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
      const prevMarginCache = getCachedUpstoxLiveMargin();
      setCachedUpstoxLiveMargin({
        ...prevMarginCache,
        timestamp: 0,
        margin: Math.max(
          0,
          Number((liveAvailableMargin - cand.totalRequiredCashWithBrokerage).toFixed(2)),
        ),
      });
      activePositions.push({
        id: 'PENDING_' + Date.now(),
        symbol: cand.optionSymbol,
        instrumentKey: cand.optInstrumentKey,
        underlyingInstrumentKey: cand.signal.underlyingInstrumentKey,
        quantity: cand.targetQuantity,
        buyPrice: cand.optionPrice,
        currentLTP: cand.optionPrice,
        type: cand.execTransactionType,
        mode: 'UPSTOX_LIVE',
        isOption: !cand.isEquityTrade,
      });
      paperOrders.unshift({
        id: 'ORD' + Date.now(),
        orderId: orderJson.data?.order_id || 'LIVE_' + Date.now().toString().slice(-6),
        symbol: cand.optionSymbol,
        instrumentKey: cand.optInstrumentKey,
        transactionType: cand.execTransactionType,
        type: cand.execTransactionType,
        orderType: cand.execOrderType,
        productType: 'DELIVERY',
        quantity: cand.targetQuantity,
        buyPrice: cand.optionPrice,
        price: cand.optionPrice,
        executedPrice: cand.optionPrice,
        status: 'COMPLETE',
        timestamp: new Date().toLocaleTimeString('en-IN'),
        time: new Date().toISOString(),
        mode: 'UPSTOX_LIVE',
        isOption: !cand.isEquityTrade,
      });
      if (paperOrders.length > 200) paperOrders.length = 200;
      savePostgresDb().catch(() => {
        /* ignore */
      });
      const liveLogMsg = cand.isEquityTrade
        ? `[UPSTOX LIVE MICRO-CAPITAL] Top Setup Executed (${cand.signal.confidenceScore}%): Bought ${cand.targetQuantity} Shares of ${cand.stockSymbol} @ ₹${cand.optionPrice} (Trade Value: ₹${cand.totalTradeCost.toLocaleString('en-IN')}, Est. Brokerage: ₹${cand.totalTradeBrokerage.toFixed(2)}). Live Capital Compounding Active!`
        : `[UPSTOX LIVE] Top Alpha Order Executed (${cand.signal.confidenceScore}%): ${cand.isOptionSellingEntry ? 'Short Sold' : 'Bought'} ${cand.optionSymbol} [${cand.affordableLots} Lot = ${cand.targetQuantity} Qty @ ₹${cand.optionPrice} (${cand.execOrderType}) | Premium: ₹${cand.totalTradeCost.toLocaleString('en-IN')} + Brokerage & Taxes: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total Cash Used: ₹${cand.totalRequiredCashWithBrokerage.toLocaleString('en-IN')} | Est. Net Profit: +₹${cand.expectedNetProfit}].`;

      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: liveLogMsg,
        type: 'TRADE',
      });
      if (botLogs.length > 200) botLogs.length = 200;

      sendTelegramNotification(
        `🟢 <b>UPSTOX LIVE ENTRY EXECUTED (${cand.isEquityTrade ? 'EQUITY COMPOUNDING' : cand.isOptionSellingEntry ? 'OPTION SELLING' : 'OPTION BUYING'})</b>\n\n` +
          `📊 <b>Symbol / Contract:</b> <code>${cand.optionSymbol}</code>\n` +
          `🏆 <b>Rank:</b> #1 Most Profitable Setup (Alpha Score: ${cand.alphaOpportunityScore})\n` +
          `🎯 <b>Direction:</b> ${cand.isEquityTrade ? 'BUY STOCK (CASH DELIVERY/INTRADAY)' : cand.isOptionSellingEntry ? 'SHORT OPTION' : cand.isBullish ? 'CE (Bullish Call)' : 'PE (Bearish Put)'}\n` +
          `📦 <b>Quantity:</b> ${cand.targetQuantity} ${cand.isEquityTrade ? 'Shares' : `Qty (${cand.affordableLots} Lot)`}\n` +
          `💰 <b>Price:</b> ₹${cand.optionPrice} (₹${cand.totalTradeCost.toLocaleString('en-IN')})\n` +
          `🧾 <b>Est. Brokerage & Taxes:</b> ₹${cand.totalTradeBrokerage.toFixed(2)}\n` +
          `💳 <b>Total Cash Used:</b> ₹${cand.totalRequiredCashWithBrokerage.toLocaleString('en-IN')}\n` +
          `📈 <b>Est. Net Profit:</b> +₹${cand.expectedNetProfit}\n` +
          `🛡️ <b>Mode:</b> UPSTOX_LIVE\n` +
          `⏰ <b>Time:</b> ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
      ).catch(() => {
        /* ignore */
      });
    } else {
      let errDetail =
        orderJson?.errors?.[0]?.message || orderJson?.message || JSON.stringify(orderJson);
      if (
        errDetail.includes('static IP') ||
        errDetail.includes('34.96.48') ||
        errDetail.includes('UDAPI1154')
      ) {
        const liveIpNow = await getDetectedContainerIp();
        errDetail = `⚠️ Upstox static IP restriction: Upstox Developer Console-ൽ നിങ്ങളുടെ Static IP-കൾ (${FIXED_PRIMARY_IP}${liveIpNow ? `, ${liveIpNow}` : ''}) കൃത്യമായി നൽകിയിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക. (${errDetail})`;
      }
      const liveErrText = `[UPSTOX LIVE REJECTED] Order for ${cand.optionSymbol} rejected: ${errDetail}`;
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: liveErrText,
        type: 'ERROR',
      });
      if (botLogs.length > 200) botLogs.length = 200;
    }
  } catch (err: any) {
    console.error('Error placing live auto buy order:', err);
  }
}
