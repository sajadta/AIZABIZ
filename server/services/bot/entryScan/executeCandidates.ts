// PASS 2 of the entry scan: rank every verified candidate by institutional alpha
// and execute the single most profitable setup in paper or live mode.
import {
  botConfig,
  botLogs,
  paperOrders,
  paperPositions,
  paperTradeHistory,
  setCachedUpstoxLiveMargin,
  setCachedUpstoxLivePositions,
  getCachedUpstoxLiveMargin,
  FIXED_PRIMARY_IP,
} from '../../../state';
import { invalidateCachedLiveDayOrders } from '../../../lib/upstoxHistory';
import { placeUpstoxOrderIpv4, getDetectedContainerIp } from '../../upstoxTransport';
import { sendTelegramNotification } from '../../notifications';
import { savePostgresDb, getPaperInitialCapital } from '../../persistence';
import { strikeDailyEntryCount } from '../antiChurn';

let lastLiveOrderPlacedAtMs = 0;
const recentLiveStrikeOrderMs: Record<string, number> = {};

export interface ExecuteCandidatesContext {
  token: string;
  marketAlphaCandidates: any[];
  activePositions: any[];
  maxAllowedConcurrent: number;
  isDailyTradeLimitReached: boolean;
  isInPostExitCooldown: boolean;
  isTradingDay: boolean;
  isTradingHours: boolean;
  liveAvailableMargin: number;
}

export async function executeTopCandidates({
  token,
  marketAlphaCandidates,
  activePositions,
  maxAllowedConcurrent,
  isDailyTradeLimitReached,
  isInPostExitCooldown,
  isTradingDay,
  isTradingHours,
  liveAvailableMargin,
}: ExecuteCandidatesContext): Promise<void> {
  // PASS 2: Multi-Index Alpha Comparison & Execution of the #1 Most Profitable Setup
  if (
    marketAlphaCandidates.length > 0 &&
    activePositions.length < maxAllowedConcurrent &&
    !botConfig.dailyLossLocked &&
    !isDailyTradeLimitReached &&
    !isInPostExitCooldown &&
    isTradingDay &&
    isTradingHours
  ) {
    // If OPTIONS_ONLY mode is active, strictly filter out any equity trade candidates
    if (botConfig.tradeMode === 'OPTIONS_ONLY') {
      for (let i = marketAlphaCandidates.length - 1; i >= 0; i--) {
        if (marketAlphaCandidates[i].isEquityTrade) {
          marketAlphaCandidates.splice(i, 1);
        }
      }
    }

    // Sort all index candidates by alphaOpportunityScore descending!
    marketAlphaCandidates.sort((a, b) => b.alphaOpportunityScore - a.alphaOpportunityScore);

    const topPick = marketAlphaCandidates[0];
    const summaryIndices = marketAlphaCandidates
      .map(
        (c) =>
          `${c.idx.symbol}: Score ${c.alphaOpportunityScore} (+₹${c.expectedNetProfit.toFixed(0)})`,
      )
      .join(' | ');

    botLogs.unshift({
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      message: `[MULTI-INDEX OPPORTUNITY SCANNER] Scanned 6 Major Indices: ${summaryIndices}. Top Pick: ${topPick.idx.symbol} (${topPick.optionSymbol}) chosen as #1 MOST PROFITABLE opportunity!`,
      type: 'SIGNAL',
    });
    if (botLogs.length > 200) botLogs.length = 200;

    for (const cand of marketAlphaCandidates) {
      if (activePositions.length >= maxAllowedConcurrent) break;

      const isUnderlyingAlreadyOpen = activePositions.some(
        (p: any) =>
          p.underlyingInstrumentKey === cand.idx.key ||
          (p.symbol && p.symbol.startsWith(cand.idx.symbol.split(' ')[0])),
      );
      if (isUnderlyingAlreadyOpen) continue;

      // Capital & Margin verification
      if (botConfig.mode === 'UPSTOX_LIVE') {
        const requiredLiveEntryCash = Number(
          cand.entryRequiredCash || cand.totalRequiredCashWithBrokerage,
        );
        if (liveAvailableMargin <= 0 || requiredLiveEntryCash > liveAvailableMargin) {
          const warnMsg = `[LIVE CAPITAL GUARD] ⚠️ ബാലൻസ് കുറവായതിനാൽ (₹${liveAvailableMargin.toLocaleString('en-IN')}) പുതിയ ട്രേഡ് എടുത്തില്ല. ഗുണനിലവാരമുള്ള ട്രേഡിന് ₹${requiredLiveEntryCash.toLocaleString('en-IN')} ആവശ്യമാണ്. അനാവശ്യ OTM ട്രേഡുകൾ ഒഴിവാക്കി പണം സംരക്ഷിച്ചു.`;
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: warnMsg,
            type: 'ERROR',
          });
          if (botLogs.length > 200) botLogs.length = 200;
          continue;
        }
      } else if (botConfig.mode === 'PAPER_TRADING') {
        // Paper Mode Capital Guard (consistent ₹2000 default paper capital)
        const initialBalance = getPaperInitialCapital();
        const totalRealized = paperTradeHistory
          .filter((t: any) => !t.mode || t.mode === 'PAPER_TRADING')
          .reduce(
            (acc, t) =>
              acc + (t.netRealizedPnL ?? (t.realizedPnL || 0) - (t.brokerageCharges || 0)),
            0,
          );
        const totalInvestedInOpen = paperPositions
          .filter((p: any) => !p.mode || p.mode === 'PAPER_TRADING')
          .reduce((acc, p) => acc + p.buyPrice * p.quantity, 0);
        const currentPaperBalance = initialBalance + totalRealized - totalInvestedInOpen;

        if (cand.totalRequiredCashWithBrokerage > currentPaperBalance) {
          const warnMsg = `[PAPER CAPITAL GUARD] Cannot buy ${cand.optionSymbol}: 1 Lot requires ₹${cand.totalRequiredCashWithBrokerage.toLocaleString('en-IN')}, but virtual balance is only ₹${currentPaperBalance.toFixed(2)}. Trade blocked to prevent overleveraging.`;
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: warnMsg,
            type: 'ERROR',
          });
          if (botLogs.length > 200) botLogs.length = 200;
          continue;
        }
      }

      // Execute Paper Trade or Live Order!
      if (botConfig.mode === 'PAPER_TRADING') {
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
          estimatedMinutesToTarget:
            cand.signal.institutionalQuantAnalysis?.estimatedMinutesToTarget,
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
      } else if (botConfig.mode === 'UPSTOX_LIVE' && token) {
        // Live Double-Order Guard: Never place another live order within 10s of a prior placement while Upstox settles positions & margin!
        if (
          Date.now() - lastLiveOrderPlacedAtMs < 10000 ||
          (cand.optInstrumentKey &&
            Date.now() - (recentLiveStrikeOrderMs[cand.optInstrumentKey] || 0) < 15000)
        ) {
          continue;
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
    }
  }
}
