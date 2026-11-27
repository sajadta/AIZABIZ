// Paper-mode entry: records the synthetic order and open position, then alerts.
import { botLogs, paperOrders, paperPositions } from '../../../state';
import { strikeDailyEntryCount } from '../antiChurn';
import { sendTelegramNotification } from '../../notifications';
import { savePostgresDb } from '../../persistence';

export function executePaperEntry(cand: any): void {
  const logMsg = cand.isEquityTrade
    ? `[PAPER MICRO-CAPITAL COMPOUNDING] Top Setup Confirmed (${cand.signal.confidenceScore}%): BUY ${cand.stockSymbol} [${cand.targetQuantity} Shares @ ₹${cand.optionPrice} | Value: ₹${cand.totalTradeCost} + Brokerage: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total: ₹${cand.totalRequiredCashWithBrokerage} | Target: ₹${cand.effectiveTarget1} (+₹${cand.expectedNetProfit})]. Capital Compounding Active!`
    : `[PAPER MODE] Top Alpha Setup Confirmed (${cand.signal.confidenceScore}%): ${cand.isOptionSellingEntry ? 'SHORT SELLING' : 'BUYING'} ${cand.optionSymbol} [${cand.affordableLots} Lot = ${cand.targetQuantity} Qty @ ₹${cand.optionPrice} (${cand.execOrderType}) | Premium: ₹${cand.totalTradeCost.toLocaleString('en-IN')} + Est. Brokerage: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total: ₹${cand.totalRequiredCashWithBrokerage.toLocaleString('en-IN')} | Est. Net Profit: +₹${cand.expectedNetProfit}].`;

  botLogs.unshift({
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString(),
    message: logMsg,
    type: 'TRADE',
  });
  if (botLogs.length > 200) botLogs.length = 200;

  const newPosId = 'POS' + Date.now();
  paperOrders.unshift({
    id: 'ORD' + Date.now(),
    orderId: 'PAP_' + Date.now().toString().slice(-6),
    positionId: newPosId,
    symbol: cand.optionSymbol,
    instrumentKey: cand.optInstrumentKey,
    transactionType: cand.execTransactionType,
    type: cand.execTransactionType,
    orderType: cand.execOrderType,
    productType: 'INTRADAY',
    quantity: cand.targetQuantity,
    buyPrice: cand.optionPrice,
    price: cand.optionPrice,
    executedPrice: cand.optionPrice,
    status: 'COMPLETE',
    timestamp: new Date().toLocaleTimeString('en-IN'),
    time: new Date().toISOString(),
    mode: 'PAPER_TRADING',
    isOption: !cand.isEquityTrade,
  });
  if (cand.optInstrumentKey) {
    strikeDailyEntryCount[cand.optInstrumentKey] =
      (strikeDailyEntryCount[cand.optInstrumentKey] || 0) + 1;
  }
  paperPositions.push({
    id: newPosId,
    openedAtMs: Date.now(),
    symbol: cand.optionSymbol,
    instrumentKey: cand.optInstrumentKey,
    underlyingInstrumentKey: cand.signal.underlyingInstrumentKey,
    productType: 'INTRADAY',
    quantity: cand.targetQuantity,
    buyPrice: cand.optionPrice,
    currentLTP: cand.optionPrice,
    pnl: 0,
    pnlPercent: 0,
    stopLoss: cand.effectiveStopLoss,
    target: cand.effectiveTarget1,
    target2: cand.signal.target2,
    target3: cand.signal.target3,
    estimatedMaxOptionPrice:
      cand.signal.institutionalQuantAnalysis?.estimatedMaxOptionPrice ||
      cand.signal.target2 ||
      cand.signal.target1,
    estimatedMinutesToTarget: cand.signal.institutionalQuantAnalysis?.estimatedMinutesToTarget,
    type: cand.execTransactionType,
    optionStrategyType: cand.isOptionSellingEntry ? 'OPTION_SELLING' : 'OPTION_BUYING',
    mode: 'PAPER_TRADING',
    openedAt: new Date().toLocaleTimeString('en-IN'),
    isOption: !cand.isEquityTrade,
  });
  savePostgresDb().catch(() => {
    /* ignore */
  });

  sendTelegramNotification(
    `🟢 <b>PAPER BOT ENTRY TRIGGERED (${cand.isEquityTrade ? 'EQUITY COMPOUNDING' : cand.isOptionSellingEntry ? 'OPTION SELLING' : 'OPTION BUYING'})</b>\n\n` +
      `📊 <b>Symbol / Contract:</b> <code>${cand.optionSymbol}</code>\n` +
      `🏆 <b>Rank:</b> #1 Most Profitable Setup (Alpha Score: ${cand.alphaOpportunityScore})\n` +
      `🎯 <b>Direction:</b> ${cand.isEquityTrade ? 'BUY STOCK (INTRADAY/DELIVERY)' : cand.isOptionSellingEntry ? `SHORT ${cand.isBullish ? 'PE' : 'CE'}` : cand.isBullish ? 'CE (Bullish Call)' : 'PE (Bearish Put)'}\n` +
      `📦 <b>Quantity:</b> ${cand.targetQuantity} ${cand.isEquityTrade ? 'Shares' : `Qty (${cand.affordableLots} Lot)`}\n` +
      `💰 <b>Entry Price:</b> ₹${cand.optionPrice} (${cand.execOrderType} | Capital: ₹${cand.totalTradeCost.toLocaleString('en-IN')})\n` +
      `📈 <b>Est. Net Profit:</b> +₹${cand.expectedNetProfit}\n` +
      `🛡️ <b>Mode:</b> PAPER_TRADING\n` +
      `⏰ <b>Time:</b> ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
  ).catch(() => {
    /* ignore */
  });
}
