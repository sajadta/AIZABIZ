// Bot tick position phase: trailing stops, peak-lock, theta-decay exits and live
// square-off order execution for every active position.
import {
  botConfig,
  botLogs,
  botSignals,
  paperOrders,
  paperPositions,
  paperTradeHistory,
  livePositionStateTracker,
  pendingClosedPositions,
  optionIntradayCandleCache,
  recentClosedStrikes,
  getLastTradeExitTime,
  setLastTradeExitTime,
  setCachedUpstoxLivePositions,
  getCachedUpstoxLiveMargin,
} from '../../state';
import { calculateTradeCharges } from '../../../src/utils/indicators';
import { resilientFetchJson } from '../../lib/http';
import { fetchLiveUpstoxCharges } from '../../lib/charges';
import { getUnderlyingOptionInstrumentKey, shouldHoldOvernightBTST } from '../../lib/instruments';
import { invalidateCachedLiveDayOrders } from '../../lib/upstoxHistory';
import { placeUpstoxOrderIpv4 } from '.././upstoxTransport';
import { computeOptionStopLossPlan } from './positionMonitor/stopLoss';
import { sendTelegramNotification } from '.././notifications';
import { savePostgresDb, getPaperInitialCapital } from '.././persistence';
import { shouldMonitorEquityPosition } from '../../lib/portfolioNormalize';

const recentLiveExitOrderMs: Record<string, number> = {};

export async function monitorActivePositions(ctx: {
  token: string;
  activePositions: any[];
  liveQuotesMap: any;
  isEodSquareOff: boolean;
}): Promise<void> {
  const { token, activePositions, liveQuotesMap, isEodSquareOff } = ctx;
  for (const pos of activePositions) {
    let quoteObj = liveQuotesMap[pos.instrumentKey];
    if (!quoteObj) {
      quoteObj = Object.values(liveQuotesMap).find(
        (q: any) => q && q.instrument_token === pos.instrumentKey,
      );
    }
    if (quoteObj && Number(quoteObj.last_price) > 0) {
      // Fix: Do not update currentLTP if it is ridiculously higher than buyPrice for options (to prevent 5 lakh profit glitch)
      if (pos.isOption && quoteObj.last_price > pos.buyPrice * 50) {
        // Probably underlying index price instead of option premium
      } else {
        pos.currentLTP = Number(quoteObj.last_price);
        const isShortPos = pos.type === 'SELL' || pos.transactionType === 'SELL';
        pos.pnl = Number(
          (
            (isShortPos ? pos.buyPrice - pos.currentLTP : pos.currentLTP - pos.buyPrice) *
            pos.quantity
          ).toFixed(2),
        );
      }
    }

    const underlyingKeyForPos =
      pos.underlyingInstrumentKey || getUnderlyingOptionInstrumentKey(pos.symbol || '');
    const latestUnderlyingSig = botSignals.find(
      (s) =>
        s.underlyingInstrumentKey === underlyingKeyForPos ||
        getUnderlyingOptionInstrumentKey(s.symbol || '') === underlyingKeyForPos,
    );
    const isBtstHoldRecommended =
      pos.productType === 'DELIVERY' && shouldHoldOvernightBTST(pos, latestUnderlyingSig);
    pos.isBtstHoldRecommended = isBtstHoldRecommended;

    // Dedicated Option Selling (Short CE / Short PE / Multi-Leg Straddle & Strangle) Theta Decay & Lowest-LTP Peak Lock Engine
    if (
      (pos.type === 'SELL' || pos.transactionType === 'SELL') &&
      (pos.symbol.includes('CE') || pos.symbol.includes('PE') || pos.isOption)
    ) {
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
                buyBackRes?.errors?.[0]?.message ||
                buyBackRes?.message ||
                JSON.stringify(buyBackRes);
              if (
                errDetail.includes('static IP') ||
                errDetail.includes('34.96.48') ||
                errDetail.includes('UDAPI1154')
              ) {
                const { getDetectedContainerIp } = await import('.././upstoxTransport');
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
      }
      continue;
    }

    if (
      (pos.type === 'BUY' && (pos.symbol.includes('CE') || pos.symbol.includes('PE'))) ||
      pos.isOption
    ) {
      const openedMs =
        Number(pos.openedAtMs || 0) ||
        (String(pos.id || '').startsWith('POS') ? Number(String(pos.id).replace(/\D+/g, '')) : 0);

      // Fetch 1-minute candles of this active option contract FIRST (cached 2.5s)
      // so that if quotes/ltp ever had a network hiccup, c0[4] (latest 1m close) and c[2] (post-entry 1m high)
      // IMMEDIATELY update pos.currentLTP and pos.highestLTP!
      let isOption1mTrendIntact = true;
      let isOptionClimaxReversal = false;
      let isOption1mBreakingDown = false;
      let prev1mCandleLow = 0;
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
          continue;
        }

        const ltp = Number(pos.currentLTP || pos.buyPrice);
        pos.highestLTP = Math.max(pos.highestLTP || pos.buyPrice, ltp);

        const rawForecast = Number(
          pos.estimatedMaxOptionPrice ||
            pos.target2 ||
            pos.target ||
            pos.buyPrice * (1 + (botConfig.targetProfitPercent || 30) / 100),
        );
        const estQty = Math.max(1, Number(pos.quantity || 1));
        const estRoundTripBrok = calculateTradeCharges(
          pos.buyPrice,
          estQty,
          true,
          pos.buyPrice * 1.6,
          pos.instrumentKey || pos.symbol,
        ).roundTripCharges;
        const minNetTargetRupees = pos.buyPrice * estQty <= 300 ? 55 : 110;
        const minProfitableForecast = Number(
          (pos.buyPrice + (estRoundTripBrok + minNetTargetRupees) / estQty).toFixed(2),
        );
        const isShortPosition = pos.type === 'SELL' || pos.optionStrategyType === 'OPTION_SELLING';
        const forecastedMaxPrice = isShortPosition
          ? rawForecast < pos.buyPrice
            ? rawForecast
            : Number((pos.buyPrice * 0.45).toFixed(2))
          : Math.max(
              minProfitableForecast,
              rawForecast > pos.buyPrice * 1.35
                ? rawForecast
                : Number(
                    (
                      pos.buyPrice *
                      (1 + Math.max(40, botConfig.targetProfitPercent || 50) / 100)
                    ).toFixed(2),
                  ),
            );

        let avgOptionAtr = Math.max(0.35, pos.buyPrice * 0.025);
        if (optCandlesActive.length >= 3) {
          const recentRanges = optCandlesActive
            .slice(0, 5)
            .map((c: any) => Math.max(0.05, Number(c[2] || 0) - Number(c[3] || 0)));
          avgOptionAtr = Number(
            (
              recentRanges.reduce((a: number, b: number) => a + b, 0) /
              Math.max(1, recentRanges.length)
            ).toFixed(2),
          );
          const c0 = optCandlesActive[0]; // current 1m candle
          const c1 = optCandlesActive[1]; // previous closed 1m candle
          const c2 = optCandlesActive[2]; // 2m ago closed candle
          prev1mCandleLow = Number(c1[3] || 0);
          const prev2mCandleLow = Number(c2[3] || 0);
          const c1Open = Number(c1[1] || ltp);
          const c1Close = Number(c1[4] || ltp);
          const c0High = Math.max(Number(c0[2] || ltp), ltp);
          const c0Low = Math.min(Number(c0[3] || ltp), ltp);
          const c0Open = Number(c0[1] || ltp);
          const c0UpperWick = c0High - Math.max(c0Open, ltp);
          const c0Range = Math.max(0.05, c0High - c0Low);

          // Option 1m trend is INTACT as long as live price holds above the previous closed 1m candle's low (Higher-Low structure)
          if (prev1mCandleLow > 0 && ltp < prev1mCandleLow && ltp < c0Open) {
            isOption1mTrendIntact = false;
          }
          // True structural breakdown if it breaks below both the last 2 closed 1-minute candle lows
          if (
            prev1mCandleLow > 0 &&
            prev2mCandleLow > 0 &&
            ltp < Math.min(prev1mCandleLow, prev2mCandleLow)
          ) {
            isOption1mTrendIntact = false;
          }
          // Option 1m candle is actively breaking down ONLY if current LTP is genuinely below buyPrice AND broke below both c1 and c2 lows
          if (
            ltp < pos.buyPrice * 0.988 &&
            c1Close < c1Open &&
            ltp < c0Open &&
            prev1mCandleLow > 0 &&
            prev2mCandleLow > 0 &&
            ltp < Math.min(prev1mCandleLow, prev2mCandleLow)
          ) {
            isOption1mBreakingDown = true;
          }
          // Universal Climax Shooting-Star / Upper Wick Rejection:
          // A climax rejection occurs whenever:
          // 1) The trade is in profit (ltp >= pos.buyPrice * 1.035 or ltp >= forecastedMaxPrice * 0.93), AND
          // 2) The 1m candle has a significant upper wick (>= 35% of total candle range), showing institutional rejection near the top,
          // 3) Price is failing or turning red (ltp < c0Open || ltp <= c0High - c0UpperWick * 0.40).
          const isShootingStarPattern =
            c0Range >= 0.2 &&
            c0UpperWick / c0Range >= 0.35 &&
            (ltp < c0Open || ltp <= c0High - c0UpperWick * 0.4);

          if (
            (ltp >= pos.buyPrice * 1.035 ||
              (forecastedMaxPrice > 0 && ltp >= forecastedMaxPrice * 0.93)) &&
            isShootingStarPattern
          ) {
            isOptionClimaxReversal = true;
          }
        }

        const pnlPercent = pos.buyPrice > 0 ? ((ltp - pos.buyPrice) / pos.buyPrice) * 100 : 0;
        let shouldSell = false;
        let sellReason = '';

        if (isEodSquareOff) {
          if (isBtstHoldRecommended) {
            if (!pos.btstHoldLogged) {
              botLogs.unshift({
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                message: `[DELIVERY BTST HOLD] ${pos.symbol} നിലവിൽ ലാഭകരമാകാൻ സാധ്യതയുള്ളതിനാൽ നാളത്തേക്ക് ഹോൾഡ് ചെയ്യുന്നു. (Sentiment: ${latestUnderlyingSig?.sentiment || 'BULLISH'})`,
                type: 'INFO',
              });
              pos.btstHoldLogged = true;
            }
          } else {
            shouldSell = true;
            sellReason = `End of day Auto Square-Off at 15:25 IST for ${pos.symbol}.`;
          }
        }

        // Static Stop and Target values based on BUY price (see positionMonitor/stopLoss)
        const liveOrPaperCapital =
          botConfig.mode === 'UPSTOX_LIVE'
            ? getCachedUpstoxLiveMargin().margin > 0
              ? getCachedUpstoxLiveMargin().margin
              : 2000
            : Math.max(
                500,
                getPaperInitialCapital() +
                  paperTradeHistory.reduce(
                    (sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0),
                    0,
                  ),
              );
        const isSmallCapitalSafeZone = liveOrPaperCapital <= 4000;
        const {
          qty,
          deployedValue,
          isMicroDeployedOpt,
          optionSlPoints,
          staticStopLossPrice,
          maxAllowedRupeeLoss,
        } = computeOptionStopLossPlan(pos.buyPrice, pos.quantity, botConfig.stopLossPercent);

        // 1. DYNAMIC TREND-RIDING & TARGET-RUNWAY MAXIMUM PROFIT ENGINE
        const posPnL = (ltp - pos.buyPrice) * qty;
        let roundTripTax = calculateTradeCharges(
          pos.buyPrice,
          qty,
          true,
          Math.max(ltp, pos.highestLTP || ltp),
        ).roundTripCharges;
        try {
          const liveChg = await fetchLiveUpstoxCharges(
            pos.instrumentKey || pos.symbol,
            qty,
            pos.buyPrice,
            Math.max(ltp, pos.highestLTP || ltp),
            pos.product || pos.productType || 'D',
          );
          if (liveChg && liveChg.totalRoundTrip > 0) {
            roundTripTax = liveChg.totalRoundTrip;
            (pos as any).brokerageCharges = liveChg.totalRoundTrip;
            (pos as any).brokerageSource = liveChg.source;
          }
        } catch {
          // Ignored
        }
        const posNetPnL = posPnL - roundTripTax;
        const peakGrossPnL = ((pos.highestLTP || ltp) - pos.buyPrice) * qty;
        const peakNetPnL = peakGrossPnL - roundTripTax;
        pos.highestPnl = Math.max(pos.highestPnl || 0, posPnL, peakGrossPnL);
        pos.highestNetPnl = Math.max(pos.highestNetPnl || 0, posNetPnL, peakNetPnL);
        const posProdCode = pos.product || (pos.productType === 'INTRADAY' ? 'I' : 'D');
        const posTrackerKey = pos.instrumentKey ? `${pos.instrumentKey}|${posProdCode}` : '';
        const activeTracker =
          (posTrackerKey && livePositionStateTracker[posTrackerKey]) ||
          (pos.instrumentKey && livePositionStateTracker[pos.instrumentKey]);
        if (activeTracker) {
          activeTracker.highestLTP = pos.highestLTP;
          activeTracker.highestPnl = pos.highestPnl;
          activeTracker.highestNetPnl = pos.highestNetPnl;
          if ((pos as any).brokerageCharges) {
            activeTracker.brokerageCharges = (pos as any).brokerageCharges;
            activeTracker.brokerageSource = (pos as any).brokerageSource;
          }
        }

        // LIVE UNDERLYING INDEX PARAMETER RADAR (Checks live signal & indicators for the underlying index of this option!)
        const isCallOption = /\bCE\b/i.test(pos.symbol || '');
        let isUnderlyingParametersReversing = false;
        let underlyingReversalDetails = '';
        if (latestUnderlyingSig && latestUnderlyingSig.indicators) {
          const ind = latestUnderlyingSig.indicators;
          const corpScoreLive =
            latestUnderlyingSig.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;
          if (isCallOption) {
            // We hold a CALL (CE): Are underlying index parameters turning Bearish?
            const emaTurnedBear = ind.emaCross?.ema9 < ind.emaCross?.ema21;
            const stTurnedSell = ind.supertrend?.signal === 'SELL';
            const macdTurnedBear = ind.macd?.hist < 0;
            const oppSignal = latestUnderlyingSig.signalType === 'SELL';
            if (
              oppSignal ||
              (emaTurnedBear && macdTurnedBear) ||
              (stTurnedSell && emaTurnedBear) ||
              (emaTurnedBear && corpScoreLive <= -25)
            ) {
              isUnderlyingParametersReversing = true;
              underlyingReversalDetails = `Underlying Index Parameters Reversed against CE (EMA9 < EMA21, MACD ${ind.macd?.hist?.toFixed(2)}, Heavyweights ${corpScoreLive})`;
            }
          } else {
            // We hold a PUT (PE): Are underlying index parameters turning Bullish?
            const emaTurnedBull = ind.emaCross?.ema9 > ind.emaCross?.ema21;
            const stTurnedBuy = ind.supertrend?.signal === 'BUY';
            const macdTurnedBull = ind.macd?.hist > 0;
            const oppSignal = latestUnderlyingSig.signalType === 'BUY';
            if (
              oppSignal ||
              (emaTurnedBull && macdTurnedBull) ||
              (stTurnedBuy && emaTurnedBull) ||
              (emaTurnedBull && corpScoreLive >= 25)
            ) {
              isUnderlyingParametersReversing = true;
              underlyingReversalDetails = `Underlying Index Parameters Reversed against PE (EMA9 > EMA21, MACD +${ind.macd?.hist?.toFixed(2)}, Heavyweights +${corpScoreLive})`;
            }
          }
        }

        // 1. PEAK-LOCKED AUTO-MOVING STOP-LOSS & AUTO-EXPANDING TARGET ENGINE
        // Exact implementation of User's Rule:
        // - "When maximum profit is reached and parameters suggest next move could be down, DO NOT prematurely close the trade!
        //    Instead, FIX the Stop-Loss right at the Maximum Profit Point! That way, if it drops, the Stop-Loss triggers immediately
        //    and locks maximum profit; if it DOES NOT drop and keeps rising, we capture all that extra profit too!"
        // - "A candle oscillates up and down while forming — NEVER rely on candle color/oscillation alone! Always verify across
        //    ALL live market parameters (EMA9/21, SuperTrend, MACD, RSI, Corporate Heavyweights, Global Macro, Option Bid/Ask & OI)
        //    on every cycle before locking or exiting!"

        const sameContractSignal =
          latestUnderlyingSig &&
          ((latestUnderlyingSig.instrumentKey &&
            pos.instrumentKey &&
            latestUnderlyingSig.instrumentKey === pos.instrumentKey) ||
            (Number(latestUnderlyingSig.price || 0) > 0 &&
              Math.abs(Number(latestUnderlyingSig.price) - pos.buyPrice) <= pos.buyPrice * 0.45));
        const liveUnderlyingForecastPrice = sameContractSignal
          ? Number(latestUnderlyingSig?.institutionalQuantAnalysis?.estimatedMaxOptionPrice || 0)
          : 0;
        let dynamicTargetPrice = Math.max(forecastedMaxPrice, liveUnderlyingForecastPrice);
        if (ltp >= dynamicTargetPrice * 0.98 && !isUnderlyingParametersReversing) {
          // Resistance-Shattering Target Expansion: Automatically move target higher as price climbs!
          dynamicTargetPrice = Number(Math.max(dynamicTargetPrice * 1.08, ltp * 1.1).toFixed(2));
        }
        pos.target = dynamicTargetPrice;
        pos.estimatedMaxOptionPrice = dynamicTargetPrice;

        const perShareBrokerage = roundTripTax / Math.max(1, pos.quantity || 1);
        const breakEvenWithBrokerage = Number((pos.buyPrice + perShareBrokerage).toFixed(2));
        const minZeroLossPrice = Number(
          (breakEvenWithBrokerage + Math.max(0.15, perShareBrokerage * 0.3)).toFixed(2),
        );

        // Scale-Invariant Quantitative Metrics (Independent of capital, quantity, or strike price):
        const peakLtp = Number(pos.highestLTP || ltp);
        const peakGainPct =
          pos.buyPrice > 0
            ? Number((((peakLtp - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2))
            : 0;
        const dropFromPeakPct =
          peakLtp > pos.buyPrice ? Number((((peakLtp - ltp) / peakLtp) * 100).toFixed(2)) : 0;
        // Dynamic Volatility-Adaptive Retracement Threshold (ATR-Normalized):
        // Highly volatile options get up to 3.2% breathing room to avoid false whipsaws; calm options get 1.8%
        const dynamicPeakPullbackPct = Math.max(
          1.8,
          Math.min(3.2, Number((((avgOptionAtr * 1.05) / Math.max(1, peakLtp)) * 100).toFixed(2))),
        );
        const netPeakPoints = Math.max(0, peakLtp - breakEvenWithBrokerage);
        const netCurrentPoints = ltp - breakEvenWithBrokerage;

        // Multi-Parameter Exhaustion / Peak Inflection Detection
        const indLive = latestUnderlyingSig?.indicators;
        const corpScoreNow =
          latestUnderlyingSig?.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;
        const macroNow =
          latestUnderlyingSig?.institutionalQuantAnalysis?.globalMacroAlignment || 'MIXED';
        const isUnderlyingAtExtremeExhaustion = Boolean(
          indLive &&
          ((isCallOption && indLive.rsi?.value >= 78 && indLive.macd?.hist <= 0) ||
            (!isCallOption && indLive.rsi?.value <= 22 && indLive.macd?.hist >= 0)),
        );
        const isCorporateOrMacroTurningAgainst =
          (isCallOption && (corpScoreNow <= -30 || macroNow === 'BEARISH')) ||
          (!isCallOption && (corpScoreNow >= 30 || macroNow === 'BULLISH'));

        // Scale-Invariant Peak Inflection: Triggers when price achieved momentum (>= 5% peak gain)
        // AND underlying parameters actively turn against the position or hit extreme overbought/exhaustion.
        // Genuine Peak Inflection & Top Climax Alert:
        // ONLY triggers when trade has reached SUBSTANTIAL profit (>= 25%) AND encounters major institutional exhaustion or underlying reversal!
        // Strictly prevents premature exits on normal 1-minute consolidation pullbacks.
        const isPeakInflectionAlert =
          peakGainPct >= 25.0 &&
          netCurrentPoints > 0 &&
          ((isOptionClimaxReversal &&
            (isUnderlyingParametersReversing || isCorporateOrMacroTurningAgainst)) ||
            (ltp >= forecastedMaxPrice * 0.96 &&
              (isUnderlyingParametersReversing ||
                isUnderlyingAtExtremeExhaustion ||
                isCorporateOrMacroTurningAgainst)) ||
            (isUnderlyingParametersReversing && dropFromPeakPct >= 7.5));

        // 1. DYNAMIC MAXIMUM PROFIT TREND-RIDING & ASYMMETRIC REWARD ENGINE
        // Mandate: "Labham nashtapedathe maximum profit pidichedukkenam"
        let candidateStopLoss = staticStopLossPrice;

        const tier0NetTrigger = isMicroDeployedOpt ? 45 : 75;
        const tier1NetTrigger = isMicroDeployedOpt ? 85 : 150;
        const slCushion = Math.max(0.25, Number((avgOptionAtr * 0.2).toFixed(2)));
        const maxNonTriggerSlCap = Number(Math.max(staticStopLossPrice, ltp - 0.15).toFixed(2));

        // Tier 0: Only lock Breakeven (incl. Upstox brokerage) AFTER live LTP is cleanly above breakEvenWithBrokerage!
        // Prevents setting SL >= current LTP on cheap options where brokerage is a high % of buyPrice.
        if (
          (peakGainPct >= 8.0 || posNetPnL >= tier0NetTrigger) &&
          ltp >= breakEvenWithBrokerage + slCushion
        ) {
          candidateStopLoss = Math.max(
            candidateStopLoss,
            Math.min(breakEvenWithBrokerage, maxNonTriggerSlCap),
          );
        }

        // Tier 1: Zero-Loss Vault (Only lock guaranteed net profit floor once LTP has cleared minZeroLossPrice + cushion)
        if (
          (peakGainPct >= 15.0 || posNetPnL >= tier1NetTrigger) &&
          ltp >= minZeroLossPrice + slCushion
        ) {
          candidateStopLoss = Math.max(
            candidateStopLoss,
            Math.min(minZeroLossPrice, maxNonTriggerSlCap),
          );
        }

        if (
          peakGainPct >= 25.0 &&
          peakGainPct < 35.0 &&
          netPeakPoints > 0 &&
          ltp >= minZeroLossPrice
        ) {
          const dynamicPeakGainLock = Number((pos.buyPrice + netPeakPoints * 0.65).toFixed(2));
          const breathingRoomPrice = Number((peakLtp * 0.9).toFixed(2));
          candidateStopLoss = Math.max(
            candidateStopLoss,
            minZeroLossPrice,
            Math.max(dynamicPeakGainLock, breathingRoomPrice),
          );
        } else if (
          peakGainPct >= 35.0 &&
          peakGainPct < 55.0 &&
          netPeakPoints > 0 &&
          ltp >= minZeroLossPrice
        ) {
          const dynamicPeakGainLock = Number((pos.buyPrice + netPeakPoints * 0.8).toFixed(2));
          const breathingRoomPrice = Number((peakLtp * 0.92).toFixed(2));
          candidateStopLoss = Math.max(
            candidateStopLoss,
            minZeroLossPrice,
            Math.max(dynamicPeakGainLock, breathingRoomPrice),
          );
        } else if (peakGainPct >= 55.0 && netPeakPoints > 0 && ltp >= minZeroLossPrice) {
          const dynamicPeakGainLock = Number((pos.buyPrice + netPeakPoints * 0.88).toFixed(2));
          const breathingRoomPrice = Number((peakLtp * 0.94).toFixed(2));
          candidateStopLoss = Math.max(
            candidateStopLoss,
            minZeroLossPrice,
            Math.max(dynamicPeakGainLock, breathingRoomPrice),
          );
        }

        const previousLockedStop = Number(
          pos.lockedStopLossPrice || activeTracker?.lockedStopLossPrice || staticStopLossPrice,
        );
        const dynamicStopLossPrice = Number(
          Math.max(previousLockedStop, candidateStopLoss).toFixed(2),
        );
        pos.lockedStopLossPrice = dynamicStopLossPrice;
        pos.stopLoss = dynamicStopLossPrice;
        pos.trailingStopLoss = dynamicStopLossPrice;
        if (activeTracker) {
          activeTracker.lockedStopLossPrice = dynamicStopLossPrice;
        }

        const hasReachedForecastTarget = ltp >= dynamicTargetPrice * 0.99;

        const tradeAgeSeconds = openedMs > 0 ? (Date.now() - openedMs) / 1000 : 999;
        const isInitialWiggleProtected =
          tradeAgeSeconds < 120 && !isUnderlyingParametersReversing && !isOption1mBreakingDown;

        // Multi-tick Stop-Loss Breach Confirmation (3.5s hold below SL) so 1-second flash wicks never shake out winners!
        const slStateKey = posTrackerKey || pos.instrumentKey || pos.id;
        const trackerObj =
          activeTracker || (slStateKey ? livePositionStateTracker[slStateKey] : undefined);
        const isStaticSlBreachedNow = ltp <= staticStopLossPrice;
        let isStaticSlConfirmed = false;
        if (isStaticSlBreachedNow) {
          const breachStart = Number(pos._slBreachAtMs || trackerObj?._slBreachAtMs || 0);
          if (breachStart <= 0) {
            pos._slBreachAtMs = Date.now();
            if (trackerObj) trackerObj._slBreachAtMs = pos._slBreachAtMs;
          } else if (
            Date.now() - breachStart >= 3500 ||
            isUnderlyingParametersReversing ||
            posPnL <= -maxAllowedRupeeLoss * 1.15
          ) {
            isStaticSlConfirmed = true;
          }
        } else {
          pos._slBreachAtMs = 0;
          if (trackerObj) trackerObj._slBreachAtMs = 0;
        }

        // 1. HARD RUPEE STOP-LOSS & RISK CAP + EARLY GENUINE REVERSAL CUT
        // If BOTH underlying parameters reversed against us AND option 1m structure broke down while losing >10%, cut early!
        if (
          !shouldSell &&
          ltp <= pos.buyPrice * 0.9 &&
          isUnderlyingParametersReversing &&
          isOption1mBreakingDown &&
          tradeAgeSeconds >= 45
        ) {
          shouldSell = true;
          sellReason = `[SMART EARLY REVERSAL CUT] ${underlyingReversalDetails} + 1m Option Breakdown at ₹${ltp.toFixed(2)} (${pnlPercent.toFixed(2)}%). Exited small to save capital!`;
        } else if (
          !shouldSell &&
          (isStaticSlConfirmed ||
            (posPnL <= -maxAllowedRupeeLoss &&
              !isInitialWiggleProtected &&
              isStaticSlBreachedNow) ||
            posPnL <= -maxAllowedRupeeLoss * 1.25)
        ) {
          shouldSell = true;
          const execPx = Math.max(ltp, staticStopLossPrice);
          const profitDiff = ((execPx - pos.buyPrice) / pos.buyPrice) * 100;
          sellReason = `[STRICT RISK CAP STOP-LOSS] Max risk threshold (-₹${maxAllowedRupeeLoss}) confirmed at ₹${execPx.toFixed(2)} (${profitDiff.toFixed(2)}%). Auto squared-off to protect account capital!`;
        }

        // 2. Trailing Stop Loss (Universal Ratcheted Dynamic Stop)
        if (!shouldSell && botConfig.trailingStopLoss && ltp <= dynamicStopLossPrice) {
          shouldSell = true;
          const execPx =
            peakGainPct >= 18.0 && dynamicStopLossPrice >= minZeroLossPrice
              ? Math.max(ltp, dynamicStopLossPrice)
              : Math.max(ltp, staticStopLossPrice);
          const profitDiff = ((execPx - pos.buyPrice) / pos.buyPrice) * 100;
          const netLocked = (execPx - pos.buyPrice) * qty - roundTripTax;
          sellReason =
            netLocked > 0
              ? `[MAXIMUM PROFIT RATCHET LOCKED] Price reached peak of ₹${peakLtp.toFixed(2)} (+${peakGainPct.toFixed(1)}%) and hit trailing Stop-Loss at ₹${execPx.toFixed(2)}. Secured +₹${netLocked.toFixed(2)} NET PROFIT (+${profitDiff.toFixed(1)}%) after full brokerage!`
              : `[SMART STOP HIT] Price dropped below Auto-SL ₹${dynamicStopLossPrice.toFixed(2)} (${profitDiff.toFixed(2)}%). Exited early to minimize loss.`;
        }

        // 2b. TOP-CLIMAX PEAK HARVESTER (SELL AT MAXIMUM PEAK):
        // Only triggers after a SUBSTANTIAL RALLY (peakGainPct >= 25.0% AND posNetPnL >= ₹450).
        // Gives runners 14% breathing room so normal intra-candle pullbacks are NOT choked!
        const underlyingIndexLtp = Number(latestUnderlyingSig?.price || 0);
        const underlyingNearestResistance = Number(
          latestUnderlyingSig?.institutionalQuantAnalysis?.nearestResistance || 0,
        );
        const isUnderlyingAtKeyResistance = Boolean(
          isCallOption &&
          underlyingIndexLtp > 0 &&
          underlyingNearestResistance > 0 &&
          underlyingIndexLtp >= underlyingNearestResistance * 0.999,
        );

        const minHarvestNetProfit = isMicroDeployedOpt ? 150 : isSmallCapitalSafeZone ? 350 : 600;
        if (
          !shouldSell &&
          peakGainPct >= 35.0 &&
          posNetPnL >= minHarvestNetProfit &&
          ((dropFromPeakPct >= 20.0 && isOptionClimaxReversal) ||
            dropFromPeakPct >= 25.0 ||
            (isUnderlyingParametersReversing && dropFromPeakPct >= 18.0))
        ) {
          shouldSell = true;
          const topReason = isOptionClimaxReversal
            ? `Top Climax Wick rejection (>=35% shadow) at peak ₹${peakLtp.toFixed(2)}`
            : isUnderlyingParametersReversing
              ? `Underlying parameters reversed against position`
              : `Peak pullback ${dropFromPeakPct.toFixed(1)}% from high`;
          sellReason = `[MAXIMUM PROFIT PEAK HARVESTER] Reached peak of ₹${peakLtp.toFixed(2)} (+${peakGainPct.toFixed(1)}%). ${topReason}. Captured peak profit (+₹${posNetPnL.toFixed(2)})!`;
        }

        // 3. Static Stop Loss (if trailing is off)
        if (!shouldSell && ltp <= staticStopLossPrice) {
          shouldSell = true;
          sellReason = `Strict Stop Loss hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Squaring off to prevent further loss.`;
        }

        // 4. Pre-emptive Underlying Reversal Profit Lock:
        // ONLY activate if position has reached GENUINE profit (>= 22% and scaled rupee net threshold) AND dropped >= 8.5% from high!
        const reversalLockNetMin = isMicroDeployedOpt ? 120 : 400;
        if (
          !shouldSell &&
          peakGainPct >= 22.0 &&
          posNetPnL >= reversalLockNetMin &&
          dropFromPeakPct >= 8.5 &&
          isUnderlyingParametersReversing
        ) {
          shouldSell = true;
          sellReason = `[SUBSTANTIAL PROFIT REVERSAL LOCK] ${underlyingReversalDetails}. Secured +₹${posNetPnL.toFixed(2)} net profit before reversal!`;
        }

        // 5. CORPORATE STRUCTURE PROTECTION:
        // Young positions are allowed to consolidate without being prematurely cut on minor noise.
        // Positions are protected by the Hard Risk Cap Stop-Loss and Trailing SL.

        // 7. Post-Entry Theta Stagnation Shield (Dynamic Expiry-Aware)
        // Strictly prevents premature exit if the trade is in healthy momentum!
        const currentIstHour = (new Date().getUTCHours() + 5.5) % 24;
        const isExpiryAfternoon = currentIstHour >= 13.5;
        const maxStagnationHoldMs = isExpiryAfternoon ? 8 * 60 * 1000 : 18 * 60 * 1000;
        const stagnationMinNet = isMicroDeployedOpt ? 70 : 250;

        if (
          !shouldSell &&
          openedMs > 0 &&
          Date.now() - openedMs >= maxStagnationHoldMs &&
          peakGainPct < 4.0 &&
          posNetPnL >= stagnationMinNet
        ) {
          shouldSell = true;
          sellReason = isExpiryAfternoon
            ? `[0-DTE EXPIRY THETA SHIELD] Position held >8m in afternoon stagnation. Secured +₹${posNetPnL.toFixed(2)} before rapid theta collapse!`
            : `[THETA STAGNATION SHIELD] Position held >18m in low-volatility consolidation. Locked +₹${posNetPnL.toFixed(2)} net profit above brokerage before Theta decay!`;
        }

        // 8. Forecasted Maximum Target Runway Exit (ONLY on genuine massive profit!)
        const targetReachMinPnL = isMicroDeployedOpt ? 160 : 550;
        const isTargetReached = isShortPosition
          ? ltp <= forecastedMaxPrice && posPnL >= (isMicroDeployedOpt ? 160 : 500)
          : ltp >= forecastedMaxPrice && peakGainPct >= 35.0 && posPnL >= targetReachMinPnL;

        if (
          !shouldSell &&
          isTargetReached &&
          (dropFromPeakPct >= 8.5 || isUnderlyingParametersReversing)
        ) {
          shouldSell = true;
          sellReason = `[MAXIMUM RUNNER HARVEST] Target Runway (₹${forecastedMaxPrice.toFixed(1)}) achieved (+${peakGainPct.toFixed(1)}% peak). Secured massive profit at ₹${ltp.toFixed(2)} (+${pnlPercent.toFixed(1)}%) for ${pos.symbol}!`;
        }

        const isFakePullbackHold =
          !shouldSell &&
          ltp > dynamicStopLossPrice &&
          !isUnderlyingParametersReversing &&
          !isOption1mBreakingDown &&
          ltp < (pos.highestLTP || ltp);

        const protectedNetFloorRupees =
          peakGainPct >= 4.5 && netPeakPoints > 0
            ? Math.max(0, Math.round((dynamicStopLossPrice - pos.buyPrice) * qty - roundTripTax))
            : -maxAllowedRupeeLoss;

        const nextMomentState:
          'ACCELERATING_UP' | 'FAKE_DIP_HOLD' | 'PEAK_EXHAUSTION' | 'REVERSING_EXIT' =
          shouldSell ||
          ltp <= dynamicStopLossPrice ||
          ltp <= staticStopLossPrice ||
          (isUnderlyingParametersReversing && !isOption1mTrendIntact)
            ? 'REVERSING_EXIT'
            : isPeakInflectionAlert || hasReachedForecastTarget
              ? 'PEAK_EXHAUSTION'
              : posPnL >= 0 && isOption1mTrendIntact
                ? 'ACCELERATING_UP'
                : 'FAKE_DIP_HOLD';

        pos.liveTrajectoryRadar = {
          nextMomentState,
          nextMomentLabel:
            nextMomentState === 'ACCELERATING_UP'
              ? 'Option In Profit — Riding Toward Target'
              : nextMomentState === 'FAKE_DIP_HOLD'
                ? `Monitoring Risk Above Stop-Loss (₹${dynamicStopLossPrice.toFixed(2)})`
                : nextMomentState === 'PEAK_EXHAUSTION'
                  ? `Peak Target Reached — Stop-Loss Locked @ ₹${dynamicStopLossPrice.toFixed(2)}`
                  : 'Stop-Loss Hit — Exiting Trade',
          nextMomentLabelMl:
            nextMomentState === 'ACCELERATING_UP'
              ? 'ഓപ്ഷൻ ലാഭത്തിൽ — ടാർഗെറ്റിലേക്ക് മുന്നേറുന്നു'
              : nextMomentState === 'FAKE_DIP_HOLD'
                ? `സ്റ്റോപ്പ്-ലോസിന് മുകളിൽ റിസ്ക് നിരീക്ഷിക്കുന്നു (SL: ₹${dynamicStopLossPrice.toFixed(2)})`
                : nextMomentState === 'PEAK_EXHAUSTION'
                  ? `പരമാവധി ലാഭ ലക്ഷ്യം കണ്ടു — Stop-Loss ₹${dynamicStopLossPrice.toFixed(2)}-ൽ ലോക്ക് ചെയ്തു`
                  : 'സ്റ്റോപ്പ്-ലോസ് പരിധി എത്തി — നഷ്ടം തടയാൻ ക്ലോസ് ചെയ്യുന്നു',
          holdOrExitVerdict:
            nextMomentState === 'PEAK_EXHAUSTION'
              ? `PEAK LOCKED @ ₹${dynamicStopLossPrice.toFixed(1)}`
              : nextMomentState === 'ACCELERATING_UP'
                ? `IN PROFIT (Target ₹${dynamicTargetPrice.toFixed(1)} | SL ₹${dynamicStopLossPrice.toFixed(1)})`
                : nextMomentState === 'FAKE_DIP_HOLD'
                  ? `HOLDING (SL ₹${dynamicStopLossPrice.toFixed(1)})`
                  : 'STOP-LOSS HIT — EXITING',
          holdOrExitVerdictMl:
            nextMomentState === 'PEAK_EXHAUSTION'
              ? `Peak Locked @ ₹${dynamicStopLossPrice.toFixed(1)}`
              : nextMomentState === 'ACCELERATING_UP'
                ? `ലാഭത്തിൽ (Target ₹${dynamicTargetPrice.toFixed(1)} | SL ₹${dynamicStopLossPrice.toFixed(1)})`
                : nextMomentState === 'FAKE_DIP_HOLD'
                  ? `ഹോൾഡ് ചെയ്യുന്നു (SL ₹${dynamicStopLossPrice.toFixed(1)})`
                  : 'Stop-Loss എത്തി — ക്ലോസ് ചെയ്യുന്നു',
          dynamicStopLossPrice,
          dynamicTargetPrice,
          protectedNetFloor: protectedNetFloorRupees,
          forecastedMaxOptionPrice: dynamicTargetPrice,
          option1mTrendIntact: isOption1mTrendIntact,
          underlyingAligned: !isUnderlyingParametersReversing,
          updatedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        };

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
            continue;
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
                  (o.positionId === closedPos.id ||
                    (o.symbol === closedPos.symbol && !o.sellPrice)),
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
                    (p) =>
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
                  const { getDetectedContainerIp } = await import('.././upstoxTransport');
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

      // Dedicated Equity Stocks (Cash & Intraday) Position & Trailing Profit Lock Engine
      if (shouldMonitorEquityPosition(pos, botConfig.tradeMode)) {
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

        const peakPnlPct = Number(
          (((pos.highestLTP - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2),
        );

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
          holdOrExitVerdictMl:
            netPnL >= 0 ? `ലാഭം ലോക്ക് ചെയ്യുന്നു (+₹${netPnL})` : `നിരീക്ഷിക്കുന്നു`,
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
        continue;
      }
    }
  }
}
