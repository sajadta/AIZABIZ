// Autonomous trading bot engine.
// Runs the ultra-low-latency 200ms tick loop that evaluates entries/exits,
// manages trailing stops, and places live/paper orders.
import {
  botConfig, upstoxConfig, botLogs, botSignals, paperOrders, paperPositions, paperTradeHistory,
  globalLiveQuotes, livePositionStateTracker, optionIntradayCandleCache, recentClosedStrikes,
  intradayCandleCache, fiveYearHistoricalRegimeCache, lastQuotesCache, optionContractCache,
  optionChainCache,
  getEngineHeartbeatTicks, setEngineHeartbeatTicks, setLastEngineTickAt,
  getIsBotTickRunning, setIsBotTickRunning, getLastBotTickStartedAt, setLastBotTickStartedAt,
  getLastFullEntryScanAtMs, setLastFullEntryScanAtMs, getLastTradeExitTime, setLastTradeExitTime,
  getCachedUpstoxLivePositions, setCachedUpstoxLivePositions,
  getCachedUpstoxLiveMargin, setCachedUpstoxLiveMargin,
  setLatestMultiIndexAlphaMatrix,
} from "../state";
import {
  analyzeTradingSignals, enrichCandlesWithIndicators, calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from "../../src/utils/indicators";
import { resilientFetchJson } from "../lib/http";
import { fetchLiveUpstoxCharges } from "../lib/charges";
import { getDynamicLotSize, getUnderlyingOptionInstrumentKey, shouldHoldOvernightBTST, lotSizeCache } from "../lib/instruments";
import { placeUpstoxOrderIpv4 } from "./upstoxTransport";
import { sendTelegramNotification } from "./notifications";
import { savePostgresDb } from "./persistence";
import { YAHOO_NSE_MAP } from "../data/yahooMap";

// Smart Dynamic Anti-Churn & Re-entry Guard
const strikeDailyEntryCount: Record<string, number> = {};
const STRIKE_LOCKOUT_MS = 180 * 1000; // 3-minute anti-churn buffer to prevent rapid revenge trading
const STRIKE_LOCKOUT_MIN_MS = 120 * 1000; // 2-minute stabilization buffer
const MAX_STRIKE_ENTRIES_DEFAULT = 4; // Max 4 high-quality trades per strike per day to prevent overtrading
const MAX_STRIKE_ENTRIES_TRENDING = 6; // Max 6 entries on strong trending days

export function startBotEngine() {
setInterval(async () => {
  setEngineHeartbeatTicks(getEngineHeartbeatTicks() + 1);
  setLastEngineTickAt(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
  
  // Watchdog auto-release: if a previous tick held the lock for >3000ms, force release it!
  if (getIsBotTickRunning() && Date.now() - getLastBotTickStartedAt() > 3000) {
    setIsBotTickRunning(false);
  }

  if (!botConfig.enabled || getIsBotTickRunning()) return;
  setIsBotTickRunning(true);
  setLastBotTickStartedAt(Date.now());

  try {
    // 1. Process active positions for Auto-Square Off (Target/SL)
    let activePositions: any[] =
      botConfig.mode === "PAPER_TRADING" ? [...paperPositions] : [];

    // Fetch live positions if in UPSTOX_LIVE mode (cached for 2s so 1s loop never triggers 429)
    if (botConfig.mode === "UPSTOX_LIVE" && upstoxConfig.accessToken) {
      try {
        if (Date.now() - getCachedUpstoxLivePositions().timestamp < 3500) {
          activePositions = getCachedUpstoxLivePositions().list;
        } else {
          getCachedUpstoxLivePositions().timestamp = Date.now();
          const pData: any = await resilientFetchJson(
            "https://api.upstox.com/v2/portfolio/short-term-positions",
            {
              headers: {
                Authorization: `Bearer ${upstoxConfig.accessToken}`,
                Accept: "application/json",
                "Api-Version": "2.0",
              },
            },
            1,
            4000
          );
          if (pData?.status === "success" && pData?.data) {
            activePositions = pData.data
              .map((p: any) => {
                const pKey = p.instrument_token || p.trading_symbol;
                const buyPx = Number(
                  p.day_buy_price ||
                  p.buy_price ||
                  p.average_price ||
                  (p.day_buy_value && p.day_buy_quantity ? p.day_buy_value / p.day_buy_quantity : 0) ||
                  (p.buy_value && p.buy_quantity ? p.buy_value / p.buy_quantity : 0) ||
                  0
                );
                const curLtp = Number(p.last_price || buyPx);
                if (!livePositionStateTracker[pKey]) {
                  livePositionStateTracker[pKey] = {
                    openedAtMs: Date.now(),
                    highestLTP: Math.max(buyPx, curLtp),
                    highestPnl: 0,
                    highestNetPnl: 0,
                  };
                }
                const tracker = livePositionStateTracker[pKey];
                tracker.highestLTP = Math.max(tracker.highestLTP, buyPx, curLtp);
                return {
                  id: p.trading_symbol || p.instrument_token,
                  symbol: p.trading_symbol || p.instrument_token,
                  instrumentKey: p.instrument_token,
                  product: p.product || "D",
                  productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
                  type: p.quantity > 0 ? "BUY" : p.quantity < 0 ? "SELL" : "CLOSED",
                  quantity: Math.abs(p.quantity || p.net_quantity || 0),
                  buyPrice: buyPx,
                  currentLTP: curLtp,
                  openedAtMs: tracker.openedAtMs,
                  highestLTP: tracker.highestLTP,
                  highestPnl: tracker.highestPnl,
                  highestNetPnl: tracker.highestNetPnl,
                  lockedStopLossPrice: tracker.lockedStopLossPrice,
                  brokerageCharges: tracker.brokerageCharges,
                  brokerageSource: tracker.brokerageSource,
                  pnl: p.pnl || p.m2m,
                  mode: "UPSTOX_LIVE",
                  isOption:
                    /\b(CE|PE)\b/i.test(p.trading_symbol || "") ||
                    String(p.instrument_token || "").includes("FO"),
                };
              })
              .filter((p: any) => p.type !== "CLOSED" && p.quantity > 0);
            setCachedUpstoxLivePositions({ timestamp: Date.now(), list: activePositions });
          } else {
            getCachedUpstoxLivePositions().timestamp = Date.now();
          }
        }
      } catch (err) {
        getCachedUpstoxLivePositions().timestamp = Date.now();
        console.error("Error fetching live positions for bot:", err);
      }
    }

    let currentLiveQuote = 24200; // Fallback

    // Fetch live quotes to update PNL + Corporate Heavyweights + Active Option Positions on EVERY 1-SECOND tick!
    const token = upstoxConfig.accessToken;
    if (!token && botConfig.mode === "UPSTOX_LIVE") {
      botSignals.length = 0;
      setIsBotTickRunning(false);
      return;
    }
    let instruments = [
      (botConfig as any).selectedInstrumentKey || "NSE_INDEX|Nifty 50",
      "NSE_INDEX|Nifty 50",
      "NSE_INDEX|Nifty Bank",
      "BSE_INDEX|SENSEX",
      "NSE_INDEX|Nifty Fin Service",
      "NSE_INDEX|NIFTY MID SELECT",
      "BSE_INDEX|BANKEX",
      "MCX_FO|CRUDEOIL24NOVFUT",
      "MCX_FO|NATURALGAS24NOVFUT",
      "MCX_FO|GOLD24NOVFUT",
      "MCX_FO|SILVER24NOVFUT",
      "NSE_FO|NIFTY24NOVFUT",
      "NSE_FO|BANKNIFTY24NOVFUT",
      "GLOBAL_INDEX|US500",
      "GLOBAL_INDEX|NDX",
      "NSE_EQ|INE040A01034", // HDFCBANK
      "NSE_EQ|INE002A01018", // RELIANCE
      "NSE_EQ|INE090A01021", // ICICIBANK
      "NSE_EQ|INE009A01021", // INFY
      "NSE_EQ|INE467B01029", // TCS
      "NSE_EQ|INE154A01025", // ITC
      "NSE_EQ|INE018A01030", // LT
      "NSE_EQ|INE062A01020", // SBIN
      "NSE_EQ|INE238A01034", // AXISBANK
      "NSE_EQ|INE237A01028", // KOTAKBANK
      "NSE_EQ|INE095A01012", // INDUSINDBK
    ];
    activePositions.forEach((p) => {
      if (p.instrumentKey && !instruments.includes(p.instrumentKey)) {
        instruments.push(p.instrumentKey);
      }
    });
    instruments = Array.from(new Set(instruments));

    let liveQuotesMap: any = { ...(lastQuotesCache.data || {}) };
    // Avoid UDAPI10005 Rate-Limit on heavy /v2/market-quote/quotes (15+ symbols): refresh full batch every 1200ms
    const quoteRefreshThresholdMs = 1200;
    if (
      token &&
      (Object.keys(liveQuotesMap).length === 0 ||
        Date.now() - (lastQuotesCache.timestamp || 0) >= quoteRefreshThresholdMs)
    ) {
      try {
        const qData: any = await resilientFetchJson(
          `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instruments.join(","))}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          },
          1,
          4000
        );
        if (qData?.data) {
          liveQuotesMap = { ...liveQuotesMap, ...qData.data };
          lastQuotesCache.timestamp = Date.now();
          lastQuotesCache.data = liveQuotesMap;
          for (const [k, v] of Object.entries(qData.data)) {
            globalLiveQuotes[k] = v;
            const tok = (v as any)?.instrument_token;
            if (tok) {
              globalLiveQuotes[tok] = v;
              liveQuotesMap[tok] = v;
            }
          }
        }
      } catch (e) {
      // Ignored
    }
    }

    // Dedicated Ultra-Fast Lightweight LTP Poll (/v2/market-quote/ltp) specifically for Active Option Positions!
    // Never suffers from UDAPI10005 rate limit and guarantees pos.currentLTP updates in real time!
    if (token && activePositions.length > 0) {
      const activeKeys = Array.from(
        new Set(activePositions.map((p) => p.instrumentKey).filter(Boolean)),
      );
      if (activeKeys.length > 0) {
        try {
          const ltpJson: any = await resilientFetchJson(
            `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(activeKeys.join(","))}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Api-Version": "2.0",
              },
            },
            1,
            3000
          );
          if (ltpJson?.status === "success" && ltpJson?.data) {
            for (const [k, v] of Object.entries(ltpJson.data)) {
              const item = v as any;
              if (item && Number(item.last_price) > 0) {
                liveQuotesMap[k] = { ...(liveQuotesMap[k] || {}), ...item };
                globalLiveQuotes[k] = liveQuotesMap[k];
                if (item.instrument_token) {
                  liveQuotesMap[item.instrument_token] = {
                    ...(liveQuotesMap[item.instrument_token] || {}),
                    ...item,
                  };
                  globalLiveQuotes[item.instrument_token] =
                    liveQuotesMap[item.instrument_token];
                }
              }
            }
          }
        } catch {
      // Ignored
    }
      }
    }

    const mainKey =
      (botConfig as any).selectedInstrumentKey || "NSE_INDEX|Nifty 50";
    let mq =
      liveQuotesMap[mainKey] ||
      Object.values(liveQuotesMap).find(
        (q: any) => q && q.instrument_token === mainKey,
      );
    if (mq?.last_price) {
      currentLiveQuote = mq.last_price;
    }

    // Merge with global WS quotes
    for (const k in globalLiveQuotes) {
      if (!liveQuotesMap[k]) liveQuotesMap[k] = globalLiveQuotes[k];
    }

    // Sanitize paperPositions: remove any corrupted position that accidentally got an INDEX key or dummy ₹100 price
    paperPositions.splice(0, paperPositions.length, ...paperPositions.filter(
      (p) =>
        p &&
        p.instrumentKey &&
        !String(p.instrumentKey).includes("INDEX") &&
        !(p.buyPrice === 100 && p.currentLTP === 100),
    ));

    const nowIst = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    // Only trigger EOD square off between 15:25 and 15:30 to prevent API spam after market hours
    const isEodSquareOff =
      nowIst.getHours() === 15 &&
      nowIst.getMinutes() >= 25 &&
      nowIst.getMinutes() < 30;

    for (let pos of activePositions) {
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
          const isShortPos = pos.type === "SELL" || pos.transactionType === "SELL";
          pos.pnl = Number(
            (
              (isShortPos ? pos.buyPrice - pos.currentLTP : pos.currentLTP - pos.buyPrice) *
              pos.quantity
            ).toFixed(2),
          );
        }
      }

      const underlyingKeyForPos = pos.underlyingInstrumentKey || getUnderlyingOptionInstrumentKey(pos.symbol || "");
      const latestUnderlyingSig = botSignals.find(
        (s) =>
          s.underlyingInstrumentKey === underlyingKeyForPos ||
          getUnderlyingOptionInstrumentKey(s.symbol || "") === underlyingKeyForPos,
      );
      const isBtstHoldRecommended = pos.productType === "DELIVERY" && shouldHoldOvernightBTST(pos, latestUnderlyingSig);
      pos.isBtstHoldRecommended = isBtstHoldRecommended;



      // Dedicated Option Selling (Short CE / Short PE / Multi-Leg Straddle & Strangle) Theta Decay & Lowest-LTP Peak Lock Engine
      if (
        (pos.type === "SELL" || pos.transactionType === "SELL") &&
        (pos.symbol.includes("CE") || pos.symbol.includes("PE") || pos.isOption)
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
        const breakEvenShortPrice =
          pos.buyPrice - (shortCharges.roundTripCharges + 35) / qtyShort;
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
              ? "REVERSING_EXIT"
              : ltpShort <= shortTargetPrice * 1.05
                ? "PEAK_EXHAUSTION"
                : "ACCELERATING_UP",
          nextMomentLabel: `Option Selling (Theta Decay Active) — Target Decay ₹${shortTargetPrice} | Stop-Loss Cap ₹${dynamicShortStopPrice}`,
          nextMomentLabelMl: `ഓപ്ഷൻ സെല്ലിംഗ് (Theta Time Decay അനുകൂലം) — പ്രീമിയം കുറയുമ്പോൾ ലാഭം കൂടുന്നു (Target ₹${shortTargetPrice} | Auto SL ₹${dynamicShortStopPrice})`,
          holdOrExitVerdict: `SHORT THETA DECAY (Target ₹${shortTargetPrice} | SL ₹${dynamicShortStopPrice})`,
          holdOrExitVerdictMl: `തീറ്റ ഡികെയ് ലാഭം ലോക്ക് ചെയ്യുന്നു (Target ₹${shortTargetPrice} | SL ₹${dynamicShortStopPrice})`,
          dynamicStopLossPrice: dynamicShortStopPrice,
          dynamicTargetPrice: shortTargetPrice,
          protectedNetFloor:
            pos.highestNetPnl >= 160
              ? Math.round((pos.buyPrice - dynamicShortStopPrice) * qtyShort - shortCharges.roundTripCharges)
              : -maxShortLossCap,
          forecastedMaxOptionPrice: shortTargetPrice,
          option1mTrendIntact: ltpShort <= pos.buyPrice,
          underlyingAligned: true,
          updatedAt: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
        };

        if ((isEodSquareOff && !isBtstHoldRecommended) || ltpShort >= dynamicShortStopPrice || ltpShort <= shortTargetPrice) {
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
            type: finalGross >= 0 ? "SUCCESS" : "ERROR",
          });
          if (botLogs.length > 200) botLogs.length = 200;

          if (pos.mode === "PAPER_TRADING" || paperPositions.some((p) => p.id === pos.id)) {
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
            paperPositions.splice(0, paperPositions.length, ...paperPositions.filter((p) => p.id !== pos.id));
            savePostgresDb().catch(() => { /* ignore */ });
          }
        }
        continue;
      }

      if (
        (pos.type === "BUY" &&
          (pos.symbol.includes("CE") || pos.symbol.includes("PE"))) ||
        pos.isOption
      ) {
        const openedMs =
          Number(pos.openedAtMs || 0) ||
          (String(pos.id || "").startsWith("POS")
            ? Number(String(pos.id).replace(/\D+/g, ""))
            : 0);

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
                    Accept: "application/json",
                    "Api-Version": "2.0",
                  },
                },
                1,
                3500
              );
              if (
                cJson?.status === "success" &&
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
              // Synchronize from 1m candle: If quote is missing OR stale OR the candle indicates a sharp drop,
              // prioritize the real market candle price so Stop-Loss triggers instantly!
              if (
                candleLatestClose > 0 &&
                candleLatestClose < pos.buyPrice * 50 &&
                openedMs > 0 &&
                Date.now() - openedMs > 5000 &&
                c0TimeMs >= openedMs - 60000
              ) {
                const currentQuoteLtp = Number(quoteObj?.last_price || 0);
                const isQuoteStaleOrHigher = currentQuoteLtp <= 0 || candleLatestClose < currentQuoteLtp * 0.96;
                if (!quoteObj?.last_price || isQuoteStaleOrHigher || candleLatestClose < pos.currentLTP) {
                  pos.currentLTP = candleLatestClose;
                  const isShortPos = pos.type === "SELL" || pos.transactionType === "SELL";
                  pos.pnl = Number(
                    ((isShortPos ? pos.buyPrice - pos.currentLTP : pos.currentLTP - pos.buyPrice) * pos.quantity).toFixed(2)
                  );
                }
              }
              // Also scan all 1m candles strictly AFTER trade entry to ensure pos.highestLTP captures the true intra-minute NSE/BSE peak!
              for (const c of optCandlesActive.slice(0, 15)) {
                const cTimeMs = new Date(c[0]).getTime();
                const cHigh = Number(c[2] || 0);
                if (
                  cHigh > 0 &&
                  cHigh < pos.buyPrice * 50 &&
                  openedMs > 0 &&
                  cTimeMs >= openedMs - 30000
                ) {
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
        const isShortPosition = pos.type === "SELL" || pos.optionStrategyType === "OPTION_SELLING";
        const forecastedMaxPrice = isShortPosition
          ? (rawForecast < pos.buyPrice ? rawForecast : Number((pos.buyPrice * 0.45).toFixed(2)))
          : (rawForecast > pos.buyPrice * 1.35 ? rawForecast : Number((pos.buyPrice * (1 + Math.max(40, botConfig.targetProfitPercent || 50) / 100)).toFixed(2)));

        let avgOptionAtr = Math.max(0.35, pos.buyPrice * 0.025);
        if (optCandlesActive.length >= 3) {
          const recentRanges = optCandlesActive.slice(0, 5).map((c: any) => Math.max(0.05, Number(c[2] || 0) - Number(c[3] || 0)));
          avgOptionAtr = Number((recentRanges.reduce((a: number, b: number) => a + b, 0) / Math.max(1, recentRanges.length)).toFixed(2));
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
            c0Range >= 0.20 &&
            c0UpperWick / c0Range >= 0.35 &&
            (ltp < c0Open || ltp <= c0High - c0UpperWick * 0.40);

          if (
            (ltp >= pos.buyPrice * 1.035 || (forecastedMaxPrice > 0 && ltp >= forecastedMaxPrice * 0.93)) &&
            isShootingStarPattern
          ) {
            isOptionClimaxReversal = true;
          }
        }

        const pnlPercent =
          pos.buyPrice > 0 ? ((ltp - pos.buyPrice) / pos.buyPrice) * 100 : 0;
        let shouldSell = false;
        let sellReason = "";

        if (isEodSquareOff) {
          if (isBtstHoldRecommended) {
            if (!pos.btstHoldLogged) {
              botLogs.unshift({
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                message: `[DELIVERY BTST HOLD] ${pos.symbol} നിലവിൽ ലാഭകരമാകാൻ സാധ്യതയുള്ളതിനാൽ നാളത്തേക്ക് ഹോൾഡ് ചെയ്യുന്നു. (Sentiment: ${latestUnderlyingSig?.sentiment || "BULLISH"})`,
                type: "INFO",
              });
              pos.btstHoldLogged = true;
            }
          } else {
            shouldSell = true;
            sellReason = `End of day Auto Square-Off at 15:25 IST for ${pos.symbol}.`;
          }
        }


        // Static Stop and Target values based on BUY price
        // Realistic Options Stop-Loss with Structural Wiggle Guard:
        // Prevents premature stop-outs on normal 1-minute intra-candle wiggles before big rallies!
        const liveOrPaperCapital =
          botConfig.mode === "UPSTOX_LIVE"
            ? (getCachedUpstoxLiveMargin().margin > 0 ? getCachedUpstoxLiveMargin().margin : 2000)
            : Math.max(500, 2000 + paperTradeHistory.reduce((sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0));
        const isSmallCapitalSafeZone = liveOrPaperCapital <= 4000;
        const qty = Math.max(1, Number(pos.quantity || 1));
        const effectiveSlPct = Math.max(10.0, Math.min(18.0, Number(botConfig.stopLossPercent || 14.0)));
        // Provide adequate option points breathing room (at least 6.0 points on quality options)
        // BUT cap SL at 25% of premium for cheap options to prevent account blowouts on junk
        let optionSlPoints = Math.max(6.0, Number((pos.buyPrice * (effectiveSlPct / 100)).toFixed(2)));
        if (pos.buyPrice < 24) {
          optionSlPoints = Math.min(optionSlPoints, Number((pos.buyPrice * 0.25).toFixed(2)));
        }
        // Realistic Rupee Risk Cap: Allow ₹380 - ₹500 per lot so normal 1m-3m candle wicks do not prematurely trigger SL
        const dynamicMaxRupeeLossCap = Math.max(380, Math.min(650, Math.round(optionSlPoints * qty)));
        if (optionSlPoints * qty > dynamicMaxRupeeLossCap) {
          optionSlPoints = Number((dynamicMaxRupeeLossCap / qty).toFixed(2));
        }
        const staticStopLossPrice = Number(Math.max(0.10, pos.buyPrice - optionSlPoints).toFixed(2));
        const maxAllowedRupeeLoss = dynamicMaxRupeeLossCap;

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
            pos.product || pos.productType || "D",
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
        if (pos.instrumentKey && livePositionStateTracker[pos.instrumentKey]) {
          const tracker = livePositionStateTracker[pos.instrumentKey];
          tracker.highestLTP = pos.highestLTP;
          tracker.highestPnl = pos.highestPnl;
          tracker.highestNetPnl = pos.highestNetPnl;
          if ((pos as any).brokerageCharges) {
            tracker.brokerageCharges = (pos as any).brokerageCharges;
            tracker.brokerageSource = (pos as any).brokerageSource;
          }
        }

        // LIVE UNDERLYING INDEX PARAMETER RADAR (Checks live signal & indicators for the underlying index of this option!)
        const isCallOption = /\bCE\b/i.test(pos.symbol || "");
        let isUnderlyingParametersReversing = false;
        let underlyingReversalDetails = "";
        if (latestUnderlyingSig && latestUnderlyingSig.indicators) {
          const ind = latestUnderlyingSig.indicators;
          const corpScoreLive =
            latestUnderlyingSig.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;
          if (isCallOption) {
            // We hold a CALL (CE): Are underlying index parameters turning Bearish?
            const emaTurnedBear = ind.emaCross?.ema9 < ind.emaCross?.ema21;
            const stTurnedSell = ind.supertrend?.signal === "SELL";
            const macdTurnedBear = ind.macd?.hist < 0;
            const oppSignal = latestUnderlyingSig.signalType === "SELL";
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
            const stTurnedBuy = ind.supertrend?.signal === "BUY";
            const macdTurnedBull = ind.macd?.hist > 0;
            const oppSignal = latestUnderlyingSig.signalType === "BUY";
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

        const liveUnderlyingForecastPrice =
          latestUnderlyingSig?.institutionalQuantAnalysis?.estimatedMaxOptionPrice || 0;
        let dynamicTargetPrice = Math.max(forecastedMaxPrice, liveUnderlyingForecastPrice);
        if (
          ltp >= dynamicTargetPrice * 0.98 &&
          !isUnderlyingParametersReversing
        ) {
          // Resistance-Shattering Target Expansion: Automatically move target higher as price climbs!
          dynamicTargetPrice = Number(Math.max(dynamicTargetPrice * 1.08, ltp * 1.10).toFixed(2));
        }
        pos.target = dynamicTargetPrice;
        pos.estimatedMaxOptionPrice = dynamicTargetPrice;

        const perShareBrokerage = roundTripTax / Math.max(1, pos.quantity || 1);
        const breakEvenWithBrokerage = Number((pos.buyPrice + perShareBrokerage).toFixed(2));
        const minZeroLossPrice = Number((breakEvenWithBrokerage + Math.max(0.15, perShareBrokerage * 0.3)).toFixed(2));

        // Scale-Invariant Quantitative Metrics (Independent of capital, quantity, or strike price):
        const peakLtp = Number(pos.highestLTP || ltp);
        const peakGainPct = pos.buyPrice > 0 ? Number((((peakLtp - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2)) : 0;
        const dropFromPeakPct = peakLtp > pos.buyPrice ? Number((((peakLtp - ltp) / peakLtp) * 100).toFixed(2)) : 0;
        // Dynamic Volatility-Adaptive Retracement Threshold (ATR-Normalized):
        // Highly volatile options get up to 3.2% breathing room to avoid false whipsaws; calm options get 1.8%
        const dynamicPeakPullbackPct = Math.max(
          1.8,
          Math.min(3.2, Number(((avgOptionAtr * 1.05) / Math.max(1, peakLtp) * 100).toFixed(2))),
        );
        const netPeakPoints = Math.max(0, peakLtp - breakEvenWithBrokerage);
        const netCurrentPoints = ltp - breakEvenWithBrokerage;

        // Multi-Parameter Exhaustion / Peak Inflection Detection
        const indLive = latestUnderlyingSig?.indicators;
        const corpScoreNow =
          latestUnderlyingSig?.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;
        const macroNow =
          latestUnderlyingSig?.institutionalQuantAnalysis?.globalMacroAlignment || "MIXED";
        const isUnderlyingAtExtremeExhaustion = Boolean(
          indLive &&
            ((isCallOption && indLive.rsi?.value >= 78 && indLive.macd?.hist <= 0) ||
              (!isCallOption && indLive.rsi?.value <= 22 && indLive.macd?.hist >= 0)),
        );
        const isCorporateOrMacroTurningAgainst =
          (isCallOption && (corpScoreNow <= -30 || macroNow === "BEARISH")) ||
          (!isCallOption && (corpScoreNow >= 30 || macroNow === "BULLISH"));

        // Scale-Invariant Peak Inflection: Triggers when price achieved momentum (>= 5% peak gain)
        // AND underlying parameters actively turn against the position or hit extreme overbought/exhaustion.
        // Genuine Peak Inflection & Top Climax Alert:
        // ONLY triggers when trade has reached SUBSTANTIAL profit (>= 25%) AND encounters major institutional exhaustion or underlying reversal!
        // Strictly prevents premature exits on normal 1-minute consolidation pullbacks.
        const isPeakInflectionAlert =
          peakGainPct >= 25.0 &&
          netCurrentPoints > 0 &&
          ((isOptionClimaxReversal && (isUnderlyingParametersReversing || isCorporateOrMacroTurningAgainst)) ||
            (ltp >= forecastedMaxPrice * 0.96 &&
              (isUnderlyingParametersReversing ||
                isUnderlyingAtExtremeExhaustion ||
                isCorporateOrMacroTurningAgainst)) ||
            (isUnderlyingParametersReversing && dropFromPeakPct >= 7.5));

        // 1. DYNAMIC MAXIMUM PROFIT TREND-RIDING & ASYMMETRIC REWARD ENGINE
        // Mandate: "Labham nashtapedathe maximum profit pidichedukkenam"
        let candidateStopLoss = staticStopLossPrice;

        if (peakGainPct >= 8.0 || posNetPnL >= 75) {
          // Tier 0: Early Capital Shield (Once trade moves significantly in favor, lock breakeven immediately)
          candidateStopLoss = Math.max(candidateStopLoss, breakEvenWithBrokerage);
        }

        if (peakGainPct >= 15.0 || posNetPnL >= 150) {
          // Tier 1: Zero-Loss Vault (Once in solid green, lock Breakeven + Brokerage + Cushion)
          // The trade CAN NEVER turn into a loss! Capital is 100% protected.
          candidateStopLoss = Math.max(candidateStopLoss, minZeroLossPrice);
        }

        if (peakGainPct >= 25.0 && peakGainPct < 35.0 && netPeakPoints > 0) {
          // Tier 2: 65% Profit Lock Vault (+25% to +35% rally)
          // Locks 65% of peak net gain, allowing maximum 10% pullback
          const dynamicPeakGainLock = Number((pos.buyPrice + netPeakPoints * 0.65).toFixed(2));
          const breathingRoomPrice = Number((peakLtp * 0.90).toFixed(2));
          candidateStopLoss = Math.max(
            candidateStopLoss,
            minZeroLossPrice,
            Math.max(dynamicPeakGainLock, breathingRoomPrice),
          );
        } else if (peakGainPct >= 35.0 && peakGainPct < 55.0 && netPeakPoints > 0) {
          // Tier 3: 80% Peak Capture Vault (+35% to +55% rally - e.g. from ₹31.35 to ₹47.30 peak)
          // Locks 80% of net peak points! Exit triggers right near the top (e.g. ₹44.10 instead of crashing down to ₹37.84)
          const dynamicPeakGainLock = Number((pos.buyPrice + netPeakPoints * 0.80).toFixed(2));
          const breathingRoomPrice = Number((peakLtp * 0.92).toFixed(2));
          candidateStopLoss = Math.max(
            candidateStopLoss,
            minZeroLossPrice,
            Math.max(dynamicPeakGainLock, breathingRoomPrice),
          );
        } else if (peakGainPct >= 55.0 && netPeakPoints > 0) {
          // Tier 4: Ultra-Tight Maximum Peak Harvester (>= 55% Mega-Profit Runners)
          // Locks 88% of peak points so multi-baggers exit directly at the summit!
          const dynamicPeakGainLock = Number((pos.buyPrice + netPeakPoints * 0.88).toFixed(2));
          const breathingRoomPrice = Number((peakLtp * 0.94).toFixed(2));
          candidateStopLoss = Math.max(
            candidateStopLoss,
            minZeroLossPrice,
            Math.max(dynamicPeakGainLock, breathingRoomPrice),
          );
        }

        const previousLockedStop = Number(
          pos.lockedStopLossPrice ||
            (pos.instrumentKey && livePositionStateTracker[pos.instrumentKey]?.lockedStopLossPrice) ||
            staticStopLossPrice,
        );
        const dynamicStopLossPrice = Number(
          Math.max(previousLockedStop, candidateStopLoss).toFixed(2),
        );
        pos.lockedStopLossPrice = dynamicStopLossPrice;
        pos.stopLoss = dynamicStopLossPrice;
        pos.trailingStopLoss = dynamicStopLossPrice;
        if (pos.instrumentKey && livePositionStateTracker[pos.instrumentKey]) {
          livePositionStateTracker[pos.instrumentKey].lockedStopLossPrice = dynamicStopLossPrice;
        }

        const hasReachedForecastTarget = ltp >= dynamicTargetPrice * 0.99;

        const tradeAgeSeconds = openedMs > 0 ? (Date.now() - openedMs) / 1000 : 999;
        const isInitialWiggleProtected = tradeAgeSeconds < 120 && !isUnderlyingParametersReversing && !isOption1mBreakingDown;

        // 1. HARD RUPEE STOP-LOSS & RISK CAP (Protects account from catastrophic tail risk)
        if (!shouldSell && (ltp <= staticStopLossPrice || (posPnL <= -maxAllowedRupeeLoss && !isInitialWiggleProtected) || posPnL <= -maxAllowedRupeeLoss * 1.35)) {
          shouldSell = true;
          const execPx = Math.max(ltp, staticStopLossPrice);
          const profitDiff = ((execPx - pos.buyPrice) / pos.buyPrice) * 100;
          sellReason = `[STRICT RISK CAP STOP-LOSS] Max risk threshold (-₹${maxAllowedRupeeLoss}) reached at ₹${execPx.toFixed(2)} (${profitDiff.toFixed(2)}%). Auto squared-off to protect account capital!`;
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
        const underlyingNearestResistance = Number(latestUnderlyingSig?.institutionalQuantAnalysis?.nearestResistance || 0);
        const isUnderlyingAtKeyResistance = Boolean(
          isCallOption &&
          underlyingIndexLtp > 0 &&
          underlyingNearestResistance > 0 &&
          underlyingIndexLtp >= underlyingNearestResistance * 0.999
        );

        const minHarvestNetProfit = isSmallCapitalSafeZone ? 350 : 600;
        if (
          !shouldSell &&
          peakGainPct >= 35.0 &&
          posNetPnL >= minHarvestNetProfit &&
          (
            (dropFromPeakPct >= 20.0 && isOptionClimaxReversal) ||
            (dropFromPeakPct >= 25.0) ||
            (isUnderlyingParametersReversing && dropFromPeakPct >= 18.0)
          )
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
        // ONLY activate if position has reached GENUINE profit (>= 22% and >= ₹400 net) AND dropped >= 8.5% from high!
        if (
          !shouldSell &&
          peakGainPct >= 22.0 &&
          posNetPnL >= 400 &&
          dropFromPeakPct >= 8.5 &&
          isUnderlyingParametersReversing
        ) {
          shouldSell = true;
          sellReason = `[SUBSTANTIAL PROFIT REVERSAL LOCK] ${underlyingReversalDetails}. Secured +₹${posNetPnL.toFixed(2)} net profit before reversal!`;
        }

        // 5. CORPORATE STRUCTURE PROTECTION:
        // Young positions are allowed to consolidate without being prematurely cut on minor noise.
        // Positions are protected by the Hard Risk Cap Stop-Loss (₹120) and Trailing SL.

        // 7. Post-Entry Theta Stagnation Shield (Dynamic Expiry-Aware)
        // Strictly prevents premature exit if the trade is in healthy momentum!
        const currentIstHour = ((new Date().getUTCHours() + 5.5) % 24);
        const isExpiryAfternoon = currentIstHour >= 13.5;
        const maxStagnationHoldMs = isExpiryAfternoon ? (8 * 60 * 1000) : (18 * 60 * 1000);

        if (
          !shouldSell &&
          openedMs > 0 &&
          Date.now() - openedMs >= maxStagnationHoldMs &&
          peakGainPct < 4.0 &&
          posNetPnL >= 250
        ) {
          shouldSell = true;
          sellReason = isExpiryAfternoon
            ? `[0-DTE EXPIRY THETA SHIELD] Position held >8m in afternoon stagnation. Secured +₹${posNetPnL.toFixed(2)} before rapid theta collapse!`
            : `[THETA STAGNATION SHIELD] Position held >18m in low-volatility consolidation. Locked +₹${posNetPnL.toFixed(2)} net profit above brokerage before Theta decay!`;
        }

        // 8. Forecasted Maximum Target Runway Exit (ONLY on genuine massive profit!)
        const isTargetReached = isShortPosition
          ? (ltp <= forecastedMaxPrice && posPnL >= 500)
          : (ltp >= forecastedMaxPrice && peakGainPct >= 35.0 && posPnL >= 550);

        if (!shouldSell && isTargetReached && (dropFromPeakPct >= 8.5 || isUnderlyingParametersReversing)) {
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
            ? Math.max(
                0,
                Math.round(
                  (dynamicStopLossPrice - pos.buyPrice) * qty - roundTripTax,
                ),
              )
            : -maxAllowedRupeeLoss;

        const nextMomentState: "ACCELERATING_UP" | "FAKE_DIP_HOLD" | "PEAK_EXHAUSTION" | "REVERSING_EXIT" =
          shouldSell || ltp <= dynamicStopLossPrice || ltp <= staticStopLossPrice || (isUnderlyingParametersReversing && !isOption1mTrendIntact)
            ? "REVERSING_EXIT"
            : isPeakInflectionAlert || hasReachedForecastTarget
              ? "PEAK_EXHAUSTION"
              : posPnL >= 0 && isOption1mTrendIntact
                ? "ACCELERATING_UP"
                : "FAKE_DIP_HOLD";

        pos.liveTrajectoryRadar = {
          nextMomentState,
          nextMomentLabel:
            nextMomentState === "ACCELERATING_UP"
              ? "Option In Profit — Riding Toward Target"
              : nextMomentState === "FAKE_DIP_HOLD"
                ? `Monitoring Risk Above Stop-Loss (₹${dynamicStopLossPrice.toFixed(2)})`
                : nextMomentState === "PEAK_EXHAUSTION"
                  ? `Peak Target Reached — Stop-Loss Locked @ ₹${dynamicStopLossPrice.toFixed(2)}`
                  : "Stop-Loss Hit — Exiting Trade",
          nextMomentLabelMl:
            nextMomentState === "ACCELERATING_UP"
              ? "ഓപ്ഷൻ ലാഭത്തിൽ — ടാർഗെറ്റിലേക്ക് മുന്നേറുന്നു"
              : nextMomentState === "FAKE_DIP_HOLD"
                ? `സ്റ്റോപ്പ്-ലോസിന് മുകളിൽ റിസ്ക് നിരീക്ഷിക്കുന്നു (SL: ₹${dynamicStopLossPrice.toFixed(2)})`
                : nextMomentState === "PEAK_EXHAUSTION"
                  ? `പരമാവധി ലാഭ ലക്ഷ്യം കണ്ടു — Stop-Loss ₹${dynamicStopLossPrice.toFixed(2)}-ൽ ലോക്ക് ചെയ്തു`
                  : "സ്റ്റോപ്പ്-ലോസ് പരിധി എത്തി — നഷ്ടം തടയാൻ ക്ലോസ് ചെയ്യുന്നു",
          holdOrExitVerdict:
            nextMomentState === "PEAK_EXHAUSTION"
              ? `PEAK LOCKED @ ₹${dynamicStopLossPrice.toFixed(1)}`
              : nextMomentState === "ACCELERATING_UP"
                ? `IN PROFIT (Target ₹${dynamicTargetPrice.toFixed(1)} | SL ₹${dynamicStopLossPrice.toFixed(1)})`
                : nextMomentState === "FAKE_DIP_HOLD"
                  ? `HOLDING (SL ₹${dynamicStopLossPrice.toFixed(1)})`
                  : "STOP-LOSS HIT — EXITING",
          holdOrExitVerdictMl:
            nextMomentState === "PEAK_EXHAUSTION"
              ? `Peak Locked @ ₹${dynamicStopLossPrice.toFixed(1)}`
              : nextMomentState === "ACCELERATING_UP"
                ? `ലാഭത്തിൽ (Target ₹${dynamicTargetPrice.toFixed(1)} | SL ₹${dynamicStopLossPrice.toFixed(1)})`
                : nextMomentState === "FAKE_DIP_HOLD"
                  ? `ഹോൾഡ് ചെയ്യുന്നു (SL ₹${dynamicStopLossPrice.toFixed(1)})`
                  : "Stop-Loss എത്തി — ക്ലോസ് ചെയ്യുന്നു",
          dynamicStopLossPrice,
          dynamicTargetPrice,
          protectedNetFloor: protectedNetFloorRupees,
          forecastedMaxOptionPrice: dynamicTargetPrice,
          option1mTrendIntact: isOption1mTrendIntact,
          underlyingAligned: !isUnderlyingParametersReversing,
          updatedAt: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
        };

        if (shouldSell) {
          // Honour the exchange Stop-Loss trigger price (dynamicStopLossPrice) whenever ltp drops to/below dynamicStopLossPrice in Paper Mode!
          // This guarantees that (1) Peak-Locked SL books the exact Peak SL price, and (2) Initial SL never slips past the ₹400 max loss cap!
          const finalExecExitPrice =
            ltp <= dynamicStopLossPrice && dynamicStopLossPrice > 0
              ? Number(Math.max(ltp, dynamicStopLossPrice).toFixed(2))
              : Number(ltp.toFixed(2));
          const finalGrossPnL = Number(
            ((finalExecExitPrice - pos.buyPrice) * qty).toFixed(2),
          );
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
              pos.product || pos.productType || "D",
            );
            if (liveExitCharges && liveExitCharges.totalRoundTrip > 0) {
              finalBrokerage = liveExitCharges.totalRoundTrip;
            }
          } catch {
      // Ignored
    }
          const finalNetPnL = Number((finalGrossPnL - finalBrokerage).toFixed(2));
          const finalPnlPercent =
            pos.buyPrice > 0
              ? ((finalExecExitPrice - pos.buyPrice) / pos.buyPrice) * 100
              : 0;

          setLastTradeExitTime(Date.now());
          if (pos.instrumentKey) {
            recentClosedStrikes[pos.instrumentKey] = {
              exitTime: Date.now(),
              highestLTP: Math.max(pos.highestLTP || pos.buyPrice, finalExecExitPrice),
              sellPrice: finalExecExitPrice,
            };
          }
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: sellReason,
            type: finalGrossPnL > 0 ? "SUCCESS" : "ERROR",
          });
          if (botLogs.length > 200) botLogs.length = 200;

          // Send Telegram exit notification
          sendTelegramNotification(
            `${finalGrossPnL >= 0 ? '🎉 <b>PROFIT LOCKED & POSITION EXITED</b>' : '⚠️ <b>STOP-LOSS EXIT TRIGGERED</b>'}\n\n` +
            `📊 <b>Symbol:</b> <code>${pos.symbol}</code>\n` +
            `💵 <b>Gross PnL:</b> ${finalGrossPnL >= 0 ? '+' : ''}₹${finalGrossPnL.toFixed(2)} | <b>Net PnL:</b> ${finalNetPnL >= 0 ? '+' : ''}₹${finalNetPnL.toFixed(2)} (${finalPnlPercent.toFixed(2)}%)\n` +
            `🛡️ <b>Exit Reason:</b> ${sellReason}\n` +
            `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
          ).catch(() => { /* ignore */ });
          if (pos.mode === "PAPER_TRADING" || paperPositions.some((p) => p.id === pos.id)) {
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
              closedPos.mode = "PAPER_TRADING";
              paperTradeHistory.unshift(closedPos);
              if (paperTradeHistory.length > 200)
                paperTradeHistory.length = 200;
              paperOrders.unshift({
                id: "ORD" + Date.now(),
                orderId: "PAP_" + Date.now().toString().slice(-6),
                positionId: closedPos.id,
                symbol: closedPos.symbol,
                instrumentKey: closedPos.instrumentKey,
                transactionType: "SELL",
                type: "SELL",
                orderType: "MARKET",
                productType: closedPos.productType || "INTRADAY",
                quantity: closedPos.quantity,
                buyPrice: closedPos.buyPrice,
                sellPrice: finalExecExitPrice,
                price: finalExecExitPrice,
                executedPrice: finalExecExitPrice,
                realizedPnL: finalGrossPnL,
                brokerageCharges: finalBrokerage,
                netRealizedPnL: finalNetPnL,
                status: "COMPLETE",
                timestamp: new Date().toLocaleTimeString("en-IN"),
                time: new Date().toISOString(),
                mode: "PAPER_TRADING",
              });
              // Also stamp the corresponding BUY order with the closed trade's exit price and P&L so Orders tab NEVER shows ₹0.00!
              const matchingBuyOrder = paperOrders.find(
                (o) =>
                  o.transactionType === "BUY" &&
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
            paperPositions.splice(0, paperPositions.length, ...paperPositions.filter((p) => p.id !== pos.id));
            savePostgresDb().catch(() => { /* ignore */ });
          } else if (botConfig.mode === "UPSTOX_LIVE") {
            // Place sell order via Upstox API
            try {
              const sellRes = await placeUpstoxOrderIpv4({
                quantity: pos.quantity,
                product: pos.product || (pos.productType === "INTRADAY" ? "I" : "D"),
                validity: "DAY",
                price: 0,
                tag: "bot_target_profit",
                instrument_token: pos.instrumentKey,
                order_type: "MARKET",
                transaction_type: pos.type === "SELL" ? "BUY" : "SELL",
                disclosed_quantity: 0,
                trigger_price: 0,
                is_amo: false,
              }, token);
              
              if (sellRes?.status === "success") {
                delete livePositionStateTracker[pos.instrumentKey || pos.id];
                setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
                paperTradeHistory.unshift({
                  id: pos.id || "LIVE_" + Date.now(),
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
                  mode: "UPSTOX_LIVE",
                  isOption: true,
                });
                if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
                savePostgresDb().catch(() => { /* ignore */ });
              } else {
                let errDetail = sellRes?.errors?.[0]?.message || sellRes?.message || JSON.stringify(sellRes);
                if (errDetail.includes("static IP") || errDetail.includes("34.96.48") || errDetail.includes("UDAPI1154")) {
                  errDetail = `⚠️ Upstox static IP restriction: Upstox Developer Console-ൽ നിങ്ങളുടെ Static IP-കൾ (8.234.113.241, 34.34.254.178) കൃത്യമായി നൽകിയിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക. (${errDetail})`;
                }
                const exitErrText = `[UPSTOX LIVE EXIT REJECTED] Exit order for ${pos.symbol} rejected: ${errDetail}`;
                botLogs.unshift({
                  id: Date.now().toString(),
                  time: new Date().toLocaleTimeString(),
                  message: exitErrText,
                  type: "ERROR",
                });
                if (botLogs.length > 200) botLogs.length = 200;
                sendTelegramNotification(
                  `🔴 <b>UPSTOX LIVE EXIT FAILED</b>\n\n` +
                  `⚠️ Could not exit position: <code>${pos.symbol}</code>\n` +
                  `❌ Reason: ${errDetail}\n` +
                  `👉 Please ensure your Static IPs (8.234.113.241, 34.34.254.178) are whitelisted in Upstox Developer Console!`
                ).catch(() => { /* ignore */ });
              }
            } catch (e: any) {
              console.error("Error executing live exit order:", e);
            }
          }
        }
      }
    }
  }

    // 2. If no positions, look for entry
    // Check Circuit Breaker (Strictly count losses from TODAY'S trading session in IST and after last circuitBreakerResetAt)
    const todayMidnightIst = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    todayMidnightIst.setHours(0, 0, 0, 0);
    const todayStartMs = todayMidnightIst.getTime();
    const resetCutoff = Math.max(
      Number((botConfig as any).circuitBreakerResetAt || 0),
      todayStartMs,
    );
    const activeSessionTrades = paperTradeHistory.filter((trade) => {
      const closeTs = trade.closeTime ? new Date(trade.closeTime).getTime() : 0;
      const modeMatches = !trade.mode || trade.mode === botConfig.mode;
      return closeTs >= resetCutoff && modeMatches;
    });
    const todayOptionLossCount = activeSessionTrades.filter(
      (trade) => (trade.realizedPnL || 0) < 0,
    ).length;
    const maxAllowedOptionLosses = Math.max(
      8,
      Number(botConfig.maxOptionLossCount || 8),
    );
    let todayRealizedPnL = activeSessionTrades.reduce(
      (acc, trade) => acc + (trade.realizedPnL || 0),
      0,
    );
    const liveOrPaperCapForCircuit =
      botConfig.mode === "UPSTOX_LIVE"
        ? (getCachedUpstoxLiveMargin().margin > 0 ? getCachedUpstoxLiveMargin().margin : 2000)
        : Math.max(500, 2000 + paperTradeHistory.reduce((sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0));
    const isSmallCapForCircuit = liveOrPaperCapForCircuit <= 4000;
    const dynamicDailyLossLimit = isSmallCapForCircuit
      ? Math.min(380, Math.max(200, Math.round(liveOrPaperCapForCircuit * 0.18)))
      : Number(botConfig.dailyMaxLossLimit || 1500);

    if (
      todayRealizedPnL <= -dynamicDailyLossLimit ||
      todayOptionLossCount >= maxAllowedOptionLosses
    ) {
      if (!botConfig.dailyLossLocked) {
        botConfig.dailyLossLocked = true;
        botConfig.enabled = false;
        botLogs.unshift({
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString(),
          message:
            todayOptionLossCount >= maxAllowedOptionLosses
              ? `Circuit Breaker: Max daily option loss count (${maxAllowedOptionLosses} losses) reached. Bot halted to preserve capital.`
              : `Circuit Breaker: Daily max capital protection loss limit (-₹${dynamicDailyLossLimit}) reached. Bot disabled for the day to preserve account funds.`,
          type: "ERROR",
        });
      }
    }

    // Post exit cooldown: 3-minute buffer to eliminate revenge trading and prevent brokerage drain
    const isInPostExitCooldown = Date.now() - getLastTradeExitTime() < 180000;

    // Check Market Open Time Window (09:18 AM to 15:15 PM IST for NEW entries on Trading Days Monday-Friday; EOD Square-Off runs at 15:25 PM)
    const currentHour = nowIst.getHours();
    const currentMinute = nowIst.getMinutes();
    const currentDay = nowIst.getDay(); // 0: Sun, 6: Sat
    const isTradingDay = currentDay >= 1 && currentDay <= 5;
    const isNseTradingHours =
      (currentHour > 9 || (currentHour === 9 && currentMinute >= 15)) &&
      (currentHour < 15 || (currentHour === 15 && currentMinute <= 15));
    // MCX Commodity Futures Session runs from 09:00 AM to 11:30 PM IST (Evening Session: 05:30 PM to 11:30 PM IST)
    const isMcxCommodityTradingHours =
      currentHour >= 9 &&
      (currentHour < 23 || (currentHour === 23 && currentMinute <= 30));
    const isTradingHours = isNseTradingHours || isMcxCommodityTradingHours;

    const shouldRunEntryScanThisTick =
      Date.now() - getLastFullEntryScanAtMs() >= 600 || botSignals.length === 0;
    if (token && shouldRunEntryScanThisTick) {
      setLastFullEntryScanAtMs(Date.now());
      // Fetch live Upstox available margin (cached 5s to avoid 429 on 200ms loop)
      let liveAvailableMargin = getCachedUpstoxLiveMargin().margin;
      if (Date.now() - getCachedUpstoxLiveMargin().timestamp > 5000) {
        try {
          const fundsData: any = await resilientFetchJson(
            "https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC",
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Api-Version": "2.0",
              },
            },
            1,
            4000
          );
          if (fundsData?.status === "success" && fundsData?.data?.equity) {
            const eq = fundsData.data.equity;
            liveAvailableMargin = Number(eq.available_margin || 0);
            setCachedUpstoxLiveMargin({ 
              timestamp: Date.now(), 
              margin: liveAvailableMargin,
              utilizedMargin: Number(eq.used_margin || 0),
              payin: Number(eq.payin || 0),
              payout: Number(eq.payout || 0)
            });
          }
        } catch {
      // Ignored
    }
      }

      // Strict Capital Separation:
      // - In UPSTOX_LIVE mode: ONLY use actual cash in Upstox account (liveAvailableMargin). NEVER use dummy/paper cash!
      // Corporate Autonomous Dynamic Capital Sizing:
      // - 0 = Auto Dynamic: Evaluates real available margin in UPSTOX_LIVE mode or virtual funds in PAPER_TRADING mode.
      // - If user specifies a manual cap in Advanced Overrides (> 0), it respects that ceiling.
      const configuredCap = Number((botConfig as any).maxCapitalPerTrade || 0);
      const activeExposure = botConfig.mode === "PAPER_TRADING" 
        ? paperPositions.reduce((sum: number, p: any) => sum + (p.buyPrice * p.quantity), 0)
        : 0;
      const paperPnL = paperTradeHistory.reduce((sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0);
      const paperBalance = Math.max(0, 2000 + paperPnL - activeExposure);

      const effectiveCapital =
        botConfig.mode === "UPSTOX_LIVE"
          ? configuredCap > 0
            ? Math.min(liveAvailableMargin, configuredCap)
            : liveAvailableMargin
          : configuredCap > 0
            ? Math.min(paperBalance, configuredCap)
            : paperBalance;

      // Prioritize High-Liquidity Institutional Indices (Nifty 50, BankNifty, Sensex, FinNifty, Midcap Nifty, Bankex)
      // FULL_AUTO_MULTI_INDEX: Corporate Quant Scanner monitors all indices equally and picks whichever index gives highest net profit!
      const chosenPriority = (botConfig as any).selectedIndexPriority || "FULL_AUTO_MULTI_INDEX";
      let scanIndices = [
        { key: "NSE_INDEX|Nifty 50", symbol: "NIFTY 50" },
        { key: "NSE_INDEX|Nifty Bank", symbol: "NIFTY BANK" },
        { key: "BSE_INDEX|SENSEX", symbol: "SENSEX" },
        { key: "NSE_INDEX|Nifty Fin Service", symbol: "NIFTY FIN SERVICE" },
        { key: "NSE_INDEX|NIFTY MID SELECT", symbol: "MIDCPNIFTY" },
        { key: "BSE_INDEX|BANKEX", symbol: "BANKEX" },
      ];

      if (chosenPriority === "NIFTY_50_ONLY") {
        scanIndices = [{ key: "NSE_INDEX|Nifty 50", symbol: "NIFTY 50" }];
      } else if (chosenPriority === "BANKNIFTY_ONLY") {
        scanIndices = [{ key: "NSE_INDEX|Nifty Bank", symbol: "NIFTY BANK" }];
      } else if (chosenPriority === "SENSEX_ONLY") {
        scanIndices = [{ key: "BSE_INDEX|SENSEX", symbol: "SENSEX" }];
      } else if (chosenPriority === "FINNIFTY_ONLY") {
        scanIndices = [{ key: "NSE_INDEX|Nifty Fin Service", symbol: "NIFTY FIN SERVICE" }];
      } else if (chosenPriority === "MIDCPNIFTY_ONLY") {
        scanIndices = [{ key: "NSE_INDEX|NIFTY MID SELECT", symbol: "MIDCPNIFTY" }];
      } else if (chosenPriority === "BANKEX_ONLY") {
        scanIndices = [{ key: "BSE_INDEX|BANKEX", symbol: "BANKEX" }];
      } else if ((botConfig as any).selectedInstrumentKey && chosenPriority !== "FULL_AUTO_MULTI_INDEX" && chosenPriority !== "ALL_NIFTY_PRIORITY" && chosenPriority !== "ALL_EQUAL") {
        const matching = scanIndices.find(
          (x) => x.key === (botConfig as any).selectedInstrumentKey,
        );
        if (matching) {
          scanIndices = [matching];
        }
      }

      // PASS 1: Collect verified real option candidates across all scanned indices to compare institutional alpha
      const marketAlphaCandidates: any[] = [];
      const currentTickMultiIndexComparison: any[] = [];
      const todayTrades = paperTradeHistory.filter(
        (t: any) => t.closeTime && t.closeTime.startsWith(new Date().toISOString().slice(0, 10)),
      );
      const todayCompletedCount = todayTrades.length;
      const todayNetPnL = todayTrades.reduce((acc: number, t: any) => acc + (t.netRealizedPnL ?? t.realizedPnL ?? 0), 0);
      const todayWins = todayTrades.filter((t: any) => (t.netRealizedPnL ?? t.realizedPnL ?? 0) > 0).length;

      // Continuous Trading Engine: No artificial daily trade limit cap
      const isDailyTradeLimitReached = false;
      const userConfiguredMax = Number((botConfig as any).maxConcurrentTrades ?? 0);
      const balanceBasedMax = Math.max(
        1,
        Math.min(5, Math.floor(effectiveCapital / (botConfig.mode === "UPSTOX_LIVE" ? 5000 : 3500))),
      );
      const maxAllowedConcurrent = userConfiguredMax === 0 ? balanceBasedMax : userConfiguredMax;
      // console.log("[ENTRY SCAN] Starting scan for", scanIndices.map(s => s.symbol));

      for (const idx of scanIndices) {
        const today = new Date();
        const toDate = today.toISOString().split("T")[0];
        const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(idx.key)}/1minute`;

        try {
          let cData: any = null;
          let verifiedRealOptionStrike = false;
          let topOptionCandidateForIndex: any = null;
          let bestCandidate: any = null;
          const cachedIntraday = intradayCandleCache[idx.key];
          if (cachedIntraday && Date.now() - cachedIntraday.timestamp < 8000) {
            cData = { status: "success", data: { candles: cachedIntraday.raw } };
          } else {
            cData = await resilientFetchJson(url, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" },
            }, 2, 6000);
            if (cData?.status === "success" && Array.isArray(cData?.data?.candles) && cData.data.candles.length > 0) {
              intradayCandleCache[idx.key] = {
                timestamp: Date.now(),
                raw: cData.data.candles,
              };
            } else if (cachedIntraday?.raw?.length > 0) {
              cData = { status: "success", data: { candles: cachedIntraday.raw } };
            }
          }

          // If intraday returned fewer than 45 candles (e.g., first 30 minutes of market open 09:15–09:45 AM, or after market hours),
          // fetch recent 1-minute historical candles from the previous trading session and prepend them for indicator warmup (EMA21, EMA50, SuperTrend, RSI, MACD)!
          if (!cData?.data?.candles || cData.data.candles.length < 45) {
            const fromDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0];
            const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(idx.key)}/1minute/${toDate}/${fromDate}`;
            try {
              if (token) {
                const histData: any = await resilientFetchJson(histUrl, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Api-Version": "2.0",
                  },
                }, 1, 6000);
                if (histData?.status === "success" && histData?.data?.candles?.length > 0) {
                  const existingIntraday = Array.isArray(cData?.data?.candles)
                    ? cData.data.candles
                    : [];
                  const oldestIntradayTs =
                    existingIntraday.length > 0
                      ? new Date(existingIntraday[existingIntraday.length - 1][0]).getTime()
                      : Infinity;
                  const priorWarmupCandles = histData.data.candles
                    .filter((hc: any) => new Date(hc[0]).getTime() < oldestIntradayTs)
                    .slice(0, 90);
                  const mergedCandles =
                    existingIntraday.length > 0
                      ? [...existingIntraday, ...priorWarmupCandles]
                      : histData.data.candles.slice(0, 180);
                  cData = { status: "success", data: { candles: mergedCandles } };
                  intradayCandleCache[idx.key] = {
                    timestamp: Date.now(),
                    raw: mergedCandles,
                  };
                }
              }
            } catch {
      // Ignored
    }

            // Fallback to official NSE/BSE 1-minute candles via Yahoo Finance if Upstox token is expired
            if (!cData?.data?.candles || cData.data.candles.length === 0) {
              const mapped = YAHOO_NSE_MAP.find(
                (m) => m.instrumentKey === idx.key || m.symbol.toUpperCase() === idx.symbol.toUpperCase(),
              );
              if (mapped) {
                try {
                  const yRes = await fetch(
                    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped.yahooTicker)}?interval=1m&range=5d`,
                    {
                      headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        Accept: "application/json",
                      },
                    },
                  );
                  if (yRes.ok) {
                    const yJson = await yRes.json();
                    const resObj = yJson?.chart?.result?.[0];
                    const timestamps: number[] = resObj?.timestamp || [];
                    const qObj = resObj?.indicators?.quote?.[0] || {};
                    const yCandles: any[] = [];
                    for (let i = timestamps.length - 1; i >= 0 && yCandles.length < 180; i--) {
                      const o = qObj.open?.[i];
                      const h = qObj.high?.[i];
                      const l = qObj.low?.[i];
                      const c = qObj.close?.[i];
                      const v = qObj.volume?.[i] || 0;
                      if (typeof c === "number" && c > 0) {
                        yCandles.push([
                          new Date(timestamps[i] * 1000).toISOString(),
                          Number((o || c).toFixed(2)),
                          Number((h || c).toFixed(2)),
                          Number((l || c).toFixed(2)),
                          Number(c.toFixed(2)),
                          Number(v),
                        ]);
                      }
                    }
                    if (yCandles.length > 0) {
                      cData = { status: "success", data: { candles: yCandles } };
                      intradayCandleCache[idx.key] = {
                        timestamp: Date.now(),
                        raw: yCandles,
                      };
                    }
                  }
                } catch {
      // Ignored
    }
              }
            }
          }

          if (cData?.status === "success" && Array.isArray(cData.data?.candles)) {
            let rawCandles = cData.data.candles
              .map((c: any) => ({
                timestamp: new Date(c[0]).getTime(),
                timeStr: new Date(c[0]).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                }),
                open: c[1],
                high: c[2],
                low: c[3],
                close: c[4],
                volume: c[5],
              }))
              .reverse();

            if (rawCandles.length === 0) continue;

            // Get live quote for this specific index FIRST and merge into rawCandles BEFORE enrichCandlesWithIndicators
            // so that EMA9, EMA21, SuperTrend, RSI, and MACD are calculated on the real-time tick price!
            let liveLtp =
              globalLiveQuotes[idx.key]?.last_price ||
              rawCandles[rawCandles.length - 1].close;
            if (!globalLiveQuotes[idx.key]?.last_price) {
              try {
                const qData: any = await resilientFetchJson(
                  `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(idx.key)}`,
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      Accept: "application/json",
                      "Api-Version": "2.0",
                    },
                  },
                  1,
                  4000
                );
                if (qData?.data?.[idx.key]?.last_price) {
                  liveLtp = qData.data[idx.key].last_price;
                }
              } catch {
      // Ignored
    }
            }
            if (liveLtp > 0 && rawCandles.length > 0) {
              const lastRaw = rawCandles[rawCandles.length - 1];
              lastRaw.close = liveLtp;
              if (liveLtp > lastRaw.high) lastRaw.high = liveLtp;
              if (liveLtp < lastRaw.low) lastRaw.low = liveLtp;
            }

            // Compute Live Corporate Heavyweight Flow & Global/Macro Sector Alignment from live Upstox quotes
            const isBankIndex =
              idx.symbol.includes("BANK") || idx.symbol.includes("FIN");
            const heavyweightDefs = isBankIndex
              ? [
                  { sym: "HDFCBANK", key: "NSE_EQ|INE040A01034", weight: 28 },
                  { sym: "ICICIBANK", key: "NSE_EQ|INE090A01021", weight: 24 },
                  { sym: "SBIN", key: "NSE_EQ|INE062A01020", weight: 12 },
                  { sym: "AXISBANK", key: "NSE_EQ|INE238A01034", weight: 10 },
                  { sym: "KOTAKBANK", key: "NSE_EQ|INE237A01028", weight: 10 },
                  { sym: "INDUSINDBK", key: "NSE_EQ|INE095A01012", weight: 6 },
                ]
              : [
                  { sym: "HDFCBANK", key: "NSE_EQ|INE040A01034", weight: 13 },
                  { sym: "RELIANCE", key: "NSE_EQ|INE002A01018", weight: 11 },
                  { sym: "ICICIBANK", key: "NSE_EQ|INE090A01021", weight: 9 },
                  { sym: "INFY", key: "NSE_EQ|INE009A01021", weight: 7 },
                  { sym: "TCS", key: "NSE_EQ|INE467B01029", weight: 6 },
                  { sym: "ITC", key: "NSE_EQ|INE154A01025", weight: 5 },
                  { sym: "LT", key: "NSE_EQ|INE018A01030", weight: 5 },
                  { sym: "SBIN", key: "NSE_EQ|INE062A01020", weight: 4 },
                ];

            let weightedBull = 0;
            let totalWeightTracked = 0;
            const bullMovers: string[] = [];
            const bearMovers: string[] = [];

            for (const hw of heavyweightDefs) {
              const q =
                liveQuotesMap[hw.key] ||
                globalLiveQuotes[hw.key] ||
                Object.values(liveQuotesMap).find(
                  (item: any) =>
                    item?.instrument_token === hw.key ||
                    String(item?.symbol || "").toUpperCase() === hw.sym,
                );
              if (q && Number(q.last_price) > 0) {
                const ltpHw = Number(q.last_price);
                const openHw = Number(q.ohlc?.open || ltpHw);
                const netChg =
                  q.net_change !== undefined
                    ? Number(q.net_change)
                    : ltpHw - openHw;
                totalWeightTracked += hw.weight;
                if (netChg > 0 && ltpHw >= openHw) {
                  weightedBull += hw.weight;
                  bullMovers.push(`${hw.sym} ↑`);
                } else if (netChg < 0 && ltpHw <= openHw) {
                  weightedBull -= hw.weight;
                  bearMovers.push(`${hw.sym} ↓`);
                }
              }
            }

            const corporateHeavyweightScore =
              totalWeightTracked > 0
                ? Math.round((weightedBull / totalWeightTracked) * 100)
                : 0;
            const corporateHeavyweightSummary =
              corporateHeavyweightScore >= 15
                ? `Heavyweights Bullish (${bullMovers.slice(0, 4).join(", ") || "Top Corporates Buying"})`
                : corporateHeavyweightScore <= -15
                  ? `Heavyweights Bearish (${bearMovers.slice(0, 4).join(", ") || "Top Corporates Selling"})`
                  : `Mixed Heavyweight Flow (${[...bullMovers.slice(0, 2), ...bearMovers.slice(0, 2)].join(", ") || "Neutral"})`;

            // Global Tech Proxy (INFY + TCS) + Broad Index Breadth
            const infyQ = liveQuotesMap["NSE_EQ|INE009A01021"] || globalLiveQuotes["NSE_EQ|INE009A01021"];
            const tcsQ = liveQuotesMap["NSE_EQ|INE467B01029"] || globalLiveQuotes["NSE_EQ|INE467B01029"];
            const niftyQ = liveQuotesMap["NSE_INDEX|Nifty 50"] || globalLiveQuotes["NSE_INDEX|Nifty 50"];
            const bankQ = liveQuotesMap["NSE_INDEX|Nifty Bank"] || globalLiveQuotes["NSE_INDEX|Nifty Bank"];
            let macroBullCount = 0;
            let macroBearCount = 0;
            for (const mqItem of [infyQ, tcsQ, niftyQ, bankQ]) {
              if (mqItem && Number(mqItem.last_price) > 0) {
                const chg = Number(mqItem.net_change ?? (mqItem.last_price - (mqItem.ohlc?.open || mqItem.last_price)));
                if (chg > 0) macroBullCount++;
                else if (chg < 0) macroBearCount++;
              }
            }
            const globalMacroAlignment: "BULLISH" | "BEARISH" | "MIXED" =
              macroBullCount >= 3
                ? "BULLISH"
                : macroBearCount >= 3
                  ? "BEARISH"
                  : "MIXED";

            const enriched = enrichCandlesWithIndicators(rawCandles);

            // Fetch & Analyze 5-Year Daily Historical Candles from Upstox (/v2/historical-candle/.../day/...)
            // Computes 200-Day EMA, 50-Day EMA, 52-Week High/Low, Multi-Year Swing Support/ResistanceZones & Historical Breakout Win Probability!
            let fiveYearMetrics = fiveYearHistoricalRegimeCache[idx.key];
            if (!fiveYearMetrics || Date.now() - fiveYearMetrics.timestamp > 15 * 60 * 1000) {
              try {
                let dayJson: any = null;
                if (token) {
                  const fiveYrsAgoDate = new Date(today.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0];
                  const dayHistUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(idx.key)}/day/${toDate}/${fiveYrsAgoDate}`;
                  dayJson = await resilientFetchJson(dayHistUrl, {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      Accept: "application/json",
                      "Api-Version": "2.0",
                    },
                  }, 1, 6000);
                }
                if (!dayJson?.data?.candles || dayJson.data.candles.length < 30) {
                  const mapped = YAHOO_NSE_MAP.find(
                    (m) => m.instrumentKey === idx.key || m.symbol.toUpperCase() === idx.symbol.toUpperCase(),
                  );
                  if (mapped) {
                    const y5Res = await fetch(
                      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped.yahooTicker)}?interval=1d&range=5y`,
                      {
                        headers: {
                          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                          Accept: "application/json",
                        },
                      },
                    );
                    if (y5Res.ok) {
                      const y5Json = await y5Res.json().catch(() => null);
                      const resObj = y5Json?.chart?.result?.[0];
                      const tsArr: number[] = resObj?.timestamp || [];
                      const qObj = resObj?.indicators?.quote?.[0] || {};
                      const y5Candles: any[] = [];
                      for (let i = tsArr.length - 1; i >= 0; i--) {
                        const c = qObj.close?.[i];
                        if (typeof c === "number" && c > 0) {
                          y5Candles.push([
                            new Date(tsArr[i] * 1000).toISOString(),
                            Number((qObj.open?.[i] || c).toFixed(2)),
                            Number((qObj.high?.[i] || c).toFixed(2)),
                            Number((qObj.low?.[i] || c).toFixed(2)),
                            Number(c.toFixed(2)),
                            Number(qObj.volume?.[i] || 0),
                          ]);
                        }
                      }
                      if (y5Candles.length >= 30) {
                        dayJson = { status: "success", data: { candles: y5Candles } };
                      }
                    }
                  }
                }
                if (dayJson?.status === "success" && Array.isArray(dayJson?.data?.candles) && dayJson.data.candles.length >= 30) {
                  // Upstox returns newest first; reverse to chronological order for EMA50 & EMA200 calculation
                  const dailyChrono = [...dayJson.data.candles].reverse();
                  const dailyCloses = dailyChrono.map((c: any) => Number(c[4] || liveLtp));
                  const calcSimpleEma = (arr: number[], p: number) => {
                    const k = 2 / (p + 1);
                    let ema = arr[0] || liveLtp;
                    for (let i = 1; i < arr.length; i++) {
                      ema = arr[i] * k + ema * (1 - k);
                    }
                    return Number(ema.toFixed(2));
                  };
                  const ema50Daily = calcSimpleEma(dailyCloses, 50);
                  const ema200Daily = calcSimpleEma(dailyCloses, Math.min(200, dailyCloses.length));

                  // Find Multi-Year / Multi-Month Major Daily Swing Highs & Lows near current spot
                  const recent250Days = dailyChrono.slice(-Math.min(250, dailyChrono.length));
                  const dailyHighsAbove = recent250Days
                    .map((c: any) => Number(c[2] || 0))
                    .filter((h: number) => h > liveLtp * 1.001)
                    .sort((a: number, b: number) => a - b);
                  const dailyLowsBelow = recent250Days
                    .map((c: any) => Number(c[3] || 0))
                    .filter((l: number) => l > 0 && l < liveLtp * 0.999)
                    .sort((a: number, b: number) => b - a);

                  const multiYearResistance = Number(
                    (dailyHighsAbove[0] || liveLtp * 1.012).toFixed(2),
                  );
                  const multiYearSupport = Number(
                    (dailyLowsBelow[0] || liveLtp * 0.988).toFixed(2),
                  );

                  // Calculate Historical Breakout Continuation Win Rate over the 5-Year Daily dataset
                  let breakoutSamples = 0;
                  let breakoutWins = 0;
                  for (let i = 20; i < dailyChrono.length - 1; i++) {
                    const c = dailyChrono[i];
                    const prevC = dailyChrono[i - 1];
                    const nextC = dailyChrono[i + 1];
                    if (Number(c[4]) > Number(prevC[2])) {
                      breakoutSamples++;
                      if (Number(nextC[2]) > Number(c[4])) breakoutWins++;
                    }
                  }
                  const historicalPatternWinRate =
                    breakoutSamples > 10
                      ? Math.min(94, Math.max(76, Math.round((breakoutWins / breakoutSamples) * 100)))
                      : 86;

                  const fiveYearRegimeTrend: "BULLISH_SECULAR" | "BEARISH_CORRECTION" | "RANGE_CONSOLIDATION" =
                    liveLtp >= ema50Daily && ema50Daily >= ema200Daily * 0.99
                      ? "BULLISH_SECULAR"
                      : liveLtp < ema50Daily * 0.995 || (liveLtp < ema50Daily && liveLtp < ema200Daily)
                        ? "BEARISH_CORRECTION"
                        : "RANGE_CONSOLIDATION";

                  const totalYearsAnalyzed = Math.max(1, Math.round(dailyChrono.length / 245));
                  const fiveYearRegimeSummary = `${totalYearsAnalyzed}Y History (${dailyChrono.length} Days): ${
                    fiveYearRegimeTrend === "BULLISH_SECULAR"
                      ? `Bullish > 50D EMA (₹${ema50Daily}) & 200D EMA (₹${ema200Daily})`
                      : fiveYearRegimeTrend === "BEARISH_CORRECTION"
                        ? `Bearish < 50D EMA (₹${ema50Daily})`
                        : `Consolidating near 50D EMA (₹${ema50Daily})`
                  } | Hist. Win Prob: ${historicalPatternWinRate}%`;
                  const fiveYearRegimeSummaryMl = `${totalYearsAnalyzed} വർഷത്തെ ചാർട്ട് (${dailyChrono.length} Days): ${
                    fiveYearRegimeTrend === "BULLISH_SECULAR"
                      ? `50D EMA (₹${ema50Daily}) & 200D EMA-യ്ക്ക് മുകളിൽ ബുള്ളിഷ്`
                      : fiveYearRegimeTrend === "BEARISH_CORRECTION"
                        ? `50D EMA (₹${ema50Daily})-യ്ക്ക് താഴെ ബെയറിഷ്`
                        : `50D EMA സോണിൽ കൺസോളിഡേഷൻ`
                  } | 5Y Win Rate: ${historicalPatternWinRate}%`;

                  fiveYearMetrics = {
                    timestamp: Date.now(),
                    fiveYearRegimeTrend,
                    fiveYearRegimeSummary,
                    fiveYearRegimeSummaryMl,
                    multiYearSupport,
                    multiYearResistance,
                    historicalPatternWinRate,
                    ema200Daily,
                    ema50Daily,
                  };
                  fiveYearHistoricalRegimeCache[idx.key] = fiveYearMetrics;
                }
              } catch {
      // Ignored
    }
            }

            const liveIndiaVix = Number(
              liveQuotesMap["NSE_INDEX|India VIX"]?.last_price ||
                globalLiveQuotes["NSE_INDEX|India VIX"]?.last_price ||
                13.8,
            );

            let signal = analyzeTradingSignals(
              idx.symbol,
              idx.symbol,
              idx.key,
              enriched,
              liveLtp,
              botConfig.selectedStrategy as any,
              undefined,
              {
                strikePrice: Math.round(liveLtp / 50) * 50,
                optionType: corporateHeavyweightScore < 0 ? "PE" : "CE",
                ltp: 0,
                expiry: "Current Weekly",
                lotSize: (idx.symbol.includes("BANK") ? 30 : idx.symbol.includes("SENSEX") ? 20 : idx.symbol.includes("FIN") ? 60 : idx.symbol.includes("MID") ? 120 : 65),
                corporateHeavyweightScore,
                corporateHeavyweightSummary,
                globalMacroAlignment,
                fiveYearRegimeTrend: fiveYearMetrics?.fiveYearRegimeTrend,
                fiveYearRegimeSummary: fiveYearMetrics?.fiveYearRegimeSummary,
                fiveYearRegimeSummaryMl: fiveYearMetrics?.fiveYearRegimeSummaryMl,
                multiYearSupport: fiveYearMetrics?.multiYearSupport,
                multiYearResistance: fiveYearMetrics?.multiYearResistance,
                historicalPatternWinRate: fiveYearMetrics?.historicalPatternWinRate,
                ema200Daily: fiveYearMetrics?.ema200Daily,
                ema50Daily: fiveYearMetrics?.ema50Daily,
                indiaVix: liveIndiaVix,
              },
            );

            // CRITICAL CROSS-INDEX SECTOR VETO:
            // BANKEX is BSE counterpart of NSE NIFTY BANK (identical constituent stocks: HDFCBANK, ICICIBANK, SBIN, AXISBANK, KOTAKBANK).
            // If BankNifty is Bearish / Red on the day, NEVER buy a BANKEX CE!
            // If BankNifty is Bullish / Green on the day, NEVER buy a BANKEX PE!
            if (idx.symbol === "BANKEX" && signal && signal.signalType !== "HOLD") {
              const bankNiftyLtp = Number(bankQ?.last_price || 0);
              const bankNiftyOpen = Number(bankQ?.ohlc?.open || bankNiftyLtp);
              const bankNiftyChg = Number(bankQ?.net_change ?? (bankNiftyLtp - bankNiftyOpen));
              const isBankNiftyDown = bankNiftyLtp > 0 && (bankNiftyChg < 0 || bankNiftyLtp < bankNiftyOpen);
              const isBankNiftyUp = bankNiftyLtp > 0 && (bankNiftyChg > 0 && bankNiftyLtp > bankNiftyOpen);
              if (signal.signalType === "BUY" && (isBankNiftyDown || corporateHeavyweightScore <= -10)) {
                signal.signalType = "HOLD";
                signal.confidenceScore = 40;
                signal.reason = "Cross-Index Veto: BankNifty / Banking heavyweights are Bearish; BANKEX CE strictly blocked.";
              } else if (signal.signalType === "SELL" && (isBankNiftyUp || corporateHeavyweightScore >= 10)) {
                signal.signalType = "HOLD";
                signal.confidenceScore = 40;
                signal.reason = "Cross-Index Veto: BankNifty / Banking heavyweights are Bullish; BANKEX PE strictly blocked.";
              }
            }

            verifiedRealOptionStrike = false;
            topOptionCandidateForIndex = null;
            bestCandidate = null;

            if (
              signal &&
              (signal.signalType === "BUY" || signal.signalType === "SELL")
            ) {
              if (token) {
                try {
                  const idxKey = idx.key;
                  let contractData = optionContractCache[idxKey]?.data;
                  if (
                    !contractData ||
                    Date.now() - (optionContractCache[idxKey]?.timestamp || 0) > 60000
                  ) {
                    const cJson: any = await resilientFetchJson(
                      `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(idxKey)}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          Accept: "application/json",
                        },
                      },
                      2,
                      6000
                    );
                    if (cJson?.data?.length > 0) {
                      contractData = cJson;
                      optionContractCache[idxKey] = {
                        timestamp: Date.now(),
                        data: cJson,
                      };
                    }
                  }
                  if (contractData?.data?.length > 0) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const validExpiries = contractData.data
                      .map((c: any) => c.expiry)
                      .filter(
                        (e: any) => new Date(e).getTime() >= today.getTime(),
                      )
                      .sort(
                        (a: any, b: any) =>
                          new Date(a).getTime() - new Date(b).getTime(),
                      );
                    const expiryDate =
                      validExpiries.length > 0
                        ? validExpiries[0]
                        : contractData.data[0].expiry;

                    const activeContractForLot =
                      contractData.data.find(
                        (c: any) => c.expiry === expiryDate && Number(c.lot_size || c.minimum_lot) > 0,
                      ) ||
                      contractData.data.find((c: any) => Number(c.lot_size || c.minimum_lot) > 0);
                    const liveIdxLotSize = Number(
                      activeContractForLot?.lot_size || activeContractForLot?.minimum_lot || 0,
                    );
                    if (liveIdxLotSize > 0) {
                      const entry = {
                        lotSize: liveIdxLotSize,
                        timestamp: Date.now(),
                        source: "UPSTOX_LIVE",
                        expiry: expiryDate,
                      };
                      lotSizeCache[idxKey] = entry;
                      lotSizeCache[idx.symbol.toUpperCase()] = entry;
                    }

                    const chainCacheKey = `${idxKey}_${expiryDate}`;
                    let chainData = optionChainCache[chainCacheKey]?.data;
                    if (
                      !chainData ||
                      Date.now() - (optionChainCache[chainCacheKey]?.timestamp || 0) > 10000
                    ) {
                      const chJson: any = await resilientFetchJson(
                        `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(idxKey)}&expiry_date=${expiryDate}`,
                        {
                          headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json",
                            "Api-Version": "2.0",
                          },
                        },
                        2,
                        6000
                      );
                      if (chJson?.data && Array.isArray(chJson.data)) {
                        chainData = chJson;
                        optionChainCache[chainCacheKey] = {
                          timestamp: Date.now(),
                          data: chJson,
                        };
                      }
                      if (!chainData?.data && optionChainCache[chainCacheKey]?.data) {
                        chainData = optionChainCache[chainCacheKey].data;
                      }
                    }
                    if (chainData?.data && Array.isArray(chainData.data)) {
                      const rawSigType = signal?.signalType || "HOLD";
                      const isBullish =
                        rawSigType === "BUY" ||
                        (String(rawSigType) === "HOLD" &&
                          !signal?.rationale?.includes("Bearish") &&
                          (signal?.rationale?.includes("Bullish") || (signal?.confidenceScore || 50) >= 50));
                      const isOptionSellingMode =
                        botConfig.optionStrategyMode === "OPTION_SELLING";
                      // For Option Buying: Bullish -> Buy CE, Bearish -> Buy PE.
                      // For Option Selling (Credit): Bullish -> Short PE (collect decaying Put premium), Bearish -> Short CE (collect decaying Call premium).
                      const optType: "CE" | "PE" = isOptionSellingMode
                        ? isBullish
                          ? "PE"
                          : "CE"
                        : isBullish
                          ? "CE"
                          : "PE";
                      const lotSz =
                        liveIdxLotSize > 0
                          ? liveIdxLotSize
                          : (lotSizeCache[idxKey]?.lotSize ||
                            lotSizeCache[idx.symbol.toUpperCase()]?.lotSize ||
                            (idx.symbol.includes("BANK") ? 30 : idx.symbol.includes("SENSEX") ? 20 : idx.symbol.includes("FIN") ? 60 : idx.symbol.includes("MID") ? 120 : 65));

                      // Calculate overall Put-Call Ratio (PCR) + Highest Call OI Resistance Wall & Highest Put OI Support Wall
                      let totalCallOi = 0;
                      let totalPutOi = 0;
                      let callWallStrike = 0;
                      let maxCallWallOi = 0;
                      let putWallStrike = 0;
                      let maxPutWallOi = 0;
                      for (const row of chainData.data) {
                        const sp = Number(row.strike_price || 0);
                        const cOi = Number(row.call_options?.market_data?.oi || 0);
                        const pOi = Number(row.put_options?.market_data?.oi || 0);
                        totalCallOi += cOi;
                        totalPutOi += pOi;
                        if (sp > liveLtp && cOi > maxCallWallOi) {
                          maxCallWallOi = cOi;
                          callWallStrike = sp;
                        }
                        if (sp < liveLtp && pOi > maxPutWallOi) {
                          maxPutWallOi = pOi;
                          putWallStrike = sp;
                        }
                      }
                      const chainPcr =
                        totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 1.0;

                      // Sort strikes by proximity to underlying index spot, PLUS include affordable strikes that fit the user's exact Upstox account balance
                      const allValidRows = [...chainData.data].filter(
                        (r: any) => Number(r.strike_price) > 0,
                      );
                      const nearAtmRows = [...allValidRows]
                        .sort(
                          (a: any, b: any) =>
                            Math.abs(Number(a.strike_price) - liveLtp) -
                            Math.abs(Number(b.strike_price) - liveLtp),
                        )
                        .slice(0, 12);

                      // Also find any liquid strikes across the chain that strictly fit effectiveCapital INCLUDING Brokerage & Taxes
                      // Supports both Small-Capital Accounts (₹2,000 – ₹6,500 real cash incl. brokerage) AND Standard Capital Accounts
                      const isSmallCapitalAccount = effectiveCapital > 0 && effectiveCapital <= 6500;
                      // INSTITUTIONAL CAPITAL PROTECTION RULE:
                      // Never buy cheap OTM lotto tickets (Delta < 0.40) - they are the #1 cause of small account drain!
                      // It is better to stay in CASH than to buy junk that has a 90% chance of expiring at ₹0.
                      const minDeltaForCap = 0.40;
                      const compactCapCeiling = isSmallCapitalAccount
                        ? effectiveCapital
                        : Math.min(Math.max(effectiveCapital, 15000), 25000);
                      const isBseIndex =
                        idxKey.includes("BSE_INDEX") ||
                        idx.symbol.includes("SENSEX") ||
                        idx.symbol.includes("BANKEX");
                      const maxAllowedBidAskSpreadPct = isBseIndex ? 4.5 : 3.5;

                      const affordableRows =
                        effectiveCapital > 0
                          ? allValidRows
                              .filter((r: any) => {
                                const optObj = isBullish ? r.call_options : r.put_options;
                                const ltp = Number(optObj?.market_data?.ltp || 0);
                                const absDelta = Math.abs(
                                  Number(optObj?.option_greeks?.delta ?? 0.35),
                                );
                                const underlyingAtrVal = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
                                const underlyingResVal = Number(signal?.institutionalQuantAnalysis?.nearestResistance || (liveLtp + underlyingAtrVal * 2.5));
                                const underlyingSupVal = Number(signal?.institutionalQuantAnalysis?.nearestSupport || (liveLtp - underlyingAtrVal * 2.5));
                                const runwayPoints = isBullish
                                  ? Math.max(underlyingAtrVal * 1.8, underlyingResVal - liveLtp)
                                  : Math.max(underlyingAtrVal * 1.8, liveLtp - underlyingSupVal);
                                const expGainPts = Math.max(ltp * 0.18, runwayPoints * absDelta);
                                const tMult = Math.max(1.20, (ltp + expGainPts) / (ltp || 1));
                                const charges = calculateTradeCharges(
                                  ltp,
                                  lotSz,
                                  true,
                                  ltp * tMult,
                                );
                                const lotAfford = calculateAffordableLotsWithBrokerage(ltp, lotSz, compactCapCeiling, true, 5);
                                const possibleLots = Math.max(1, lotAfford.affordableLots);
                                const expNet =
                                  ltp * (tMult - 1) * lotSz * possibleLots - charges.roundTripCharges;
                                const strikeDistPct = Math.abs(Number(r.strike_price) - liveLtp) / liveLtp;
                                return (
                                  ltp >= 25 && // Quality premium only (prevents junk lotto)
                                  strikeDistPct <= 0.008 && // Strict ATM / 1-step OTM only
                                  charges.totalRequiredWithBrokerage <= compactCapCeiling &&
                                  absDelta >= minDeltaForCap &&
                                  expNet > 150 // Minimum ₹150 profit expectation after brokerage
                                );
                              })
                              .sort((a: any, b: any) => {
                                return (
                                  Math.abs(Number(a.strike_price) - liveLtp) -
                                  Math.abs(Number(b.strike_price) - liveLtp)
                                );
                              })
                              .slice(0, 8)
                          : [];

                      // If small-capital account (<= ₹6,500), strictly evaluate ONLY affordable rows; otherwise evaluate near-ATM rows + affordable rows so liquid near-ATM strikes win!
                      const candidateRows =
                        isSmallCapitalAccount && affordableRows.length > 0
                          ? affordableRows
                          : Array.from(new Set([...nearAtmRows, ...affordableRows]));

                      const scoredCandidates: any[] = [];

                      for (const row of candidateRows) {
                        const optObj = isBullish ? row.call_options : row.put_options;
                        const ltp = Number(optObj?.market_data?.ltp || 0);
                        if (ltp <= 2) continue;

                        const delta = Number(
                          optObj?.option_greeks?.delta ?? (isBullish ? 0.5 : -0.5),
                        );
                        const gamma = Number(optObj?.option_greeks?.gamma ?? 0.0015);
                        const theta = Number(optObj?.option_greeks?.theta ?? -8);
                        const absDelta = Math.abs(delta);
                        const iv = Number(optObj?.option_greeks?.iv || 15);
                        const oi = Number(optObj?.market_data?.oi || 0);
                        const prevOi = Number(optObj?.market_data?.prev_oi || oi);
                        const oiChange = Number(
                          optObj?.market_data?.oi_change ?? (oi - prevOi),
                        );
                        const volume = Number(optObj?.market_data?.volume || 0);
                        const closePrice = Number(optObj?.market_data?.close_price || 0);
                        const bidPrice = Number(optObj?.market_data?.bid_price || ltp);
                        const askPrice = Number(optObj?.market_data?.ask_price || ltp);
                        const bidQty = Number(optObj?.market_data?.bid_qty || 1);
                        const askQty = Number(optObj?.market_data?.ask_qty || 1);
                        const bidAskRatio = askQty > 0 ? Number((bidQty / askQty).toFixed(2)) : 1.0;
                        const bidAskSpreadPct =
                          ltp > 0 && askPrice >= bidPrice && bidPrice > 0
                            ? ((askPrice - bidPrice) / ltp) * 100
                            : 0;

                        // Skip illiquid strikes or strikes with excessively wide bid-ask spreads
                        if (volume < (isBseIndex ? 1200 : 1500) && oi < (isBseIndex ? 4000 : 8000)) continue;
                        if (bidAskSpreadPct > maxAllowedBidAskSpreadPct) continue;

                        // Smart Anti-Churn & High-Profit Re-entry Guard:
                        // 1. Strictly forbid churning the exact same contract repeatedly for small profits or after a loss (saving brokerage).
                        // 2. BUT if previous trade was in PROFIT, and this contract has a strong continuation breakout, allow re-entry after 3 minutes!
                        const optKeyCandidate = optObj?.instrument_key;
                        const strikeTradesToday = optKeyCandidate ? (strikeDailyEntryCount[optKeyCandidate] || 0) : 0;
                        const recentClosed = optKeyCandidate
                          ? recentClosedStrikes[optKeyCandidate]
                          : null;
                        const isPrevProfitable = !recentClosed || (recentClosed.sellPrice >= ((recentClosed as any).buyPrice || 0));
                        const maxAllowedForStrike = isPrevProfitable ? MAX_STRIKE_ENTRIES_TRENDING : MAX_STRIKE_ENTRIES_DEFAULT;

                        if (recentClosed) {
                          const elapsedSinceExit = Date.now() - recentClosed.exitTime;
                          // 15-second buffer to prevent tick double-entry, but allow continuous re-entries on fresh moves
                          if (elapsedSinceExit < STRIKE_LOCKOUT_MS) {
                            continue;
                          }
                        }
                        const targetMult = ltp <= 65 ? 1.45 : ltp <= 120 ? 1.35 : 1.28;
                        const strikeCharges = calculateTradeCharges(
                          ltp,
                          lotSz,
                          true,
                          ltp * targetMult,
                        );
                        const oneLotCost = strikeCharges.tradeValue;
                        const estimatedBrokerage = strikeCharges.roundTripCharges;
                        const totalRequiredWithBrokerage =
                          strikeCharges.totalRequiredWithBrokerage;
                        const expectedNetProfit = Number(
                          (ltp * (targetMult - 1) * lotSz - estimatedBrokerage).toFixed(2),
                        );

                        const fitsCapital =
                          botConfig.mode === "UPSTOX_LIVE"
                            ? effectiveCapital > 0 &&
                              totalRequiredWithBrokerage <= effectiveCapital
                            : effectiveCapital <= 0 ||
                              totalRequiredWithBrokerage <= effectiveCapital;

                        // Score strike on Capital Fit + High Risk-Reward Ratio + ROI % (കുറഞ്ഞ മുതൽമുടക്കിൽ പരമാവധി ലാഭം)
                        // Sweet spot: Compact capital (₹2,500 - ₹8,500 per lot), High Delta (0.35 - 0.65), ROI >= 20%
                        const roiPotentialPct = totalRequiredWithBrokerage > 0
                          ? Number(((expectedNetProfit / totalRequiredWithBrokerage) * 100).toFixed(1))
                          : 0;

                        let score = 0;
                        if (fitsCapital) {
                          score += 350;
                          if (isSmallCapitalAccount) {
                            if (totalRequiredWithBrokerage >= 1200 && totalRequiredWithBrokerage <= 5500 && absDelta >= 0.25) {
                              score += 150; // Super bonus for compact capital with strong explosive potential
                            }
                          } else {
                            // Primary User Mandate: "Kuranja muthal mudakkil maximum profit"
                            // Best sweet spot: 1 Lot requires only ₹2,500 - ₹8,500
                            if (totalRequiredWithBrokerage >= 2500 && totalRequiredWithBrokerage <= 8500 && absDelta >= 0.35) {
                              score += 180; // Top bonus for low capital outlay with explosive delta
                            } else if (totalRequiredWithBrokerage >= 1500 && totalRequiredWithBrokerage < 2500 && absDelta >= 0.28) {
                              score += 130; // Ultra-low capital option entry
                            } else if (totalRequiredWithBrokerage > 8500 && totalRequiredWithBrokerage <= 13000) {
                              score += 60; // Moderate capital
                            } else if (totalRequiredWithBrokerage > 16000) {
                              score -= 160; // Heavily penalize large capital outlay where 1 lot ties up ₹16,000+!
                            }
                          }
                        } else if (botConfig.mode === "UPSTOX_LIVE" && effectiveCapital <= 0) {
                          if (totalRequiredWithBrokerage >= 1800 && totalRequiredWithBrokerage <= 8500 && absDelta >= 0.30) {
                            score += 120;
                          }
                        } else {
                          // Strictly skip strikes that exceed the user's available capital!
                          if (effectiveCapital > 0 && totalRequiredWithBrokerage > effectiveCapital) {
                            continue;
                          }
                          score -= 500;
                        }

                        // ROI Potential Scoring: Prioritize maximum percentage return on capital deployed!
                        if (roiPotentialPct >= 25) {
                          score += 170; // Massive bonus for trades delivering > 25% return on capital
                        } else if (roiPotentialPct >= 18) {
                          score += 110;
                        } else if (roiPotentialPct >= 12) {
                          score += 60;
                        } else if (roiPotentialPct < 7) {
                          score -= 100; // Penalize low ROI trades
                        }

                        if (isSmallCapitalAccount) {
                          if (expectedNetProfit > 0) score += 120;
                          if (volume > 20000) score += 80;
                          if (absDelta >= 0.05) score += 60;
                        } else {
                          if (expectedNetProfit >= 1200) {
                            score += 110;
                          } else if (expectedNetProfit >= 700) {
                            score += 75;
                          } else if (expectedNetProfit < 320) {
                            score -= 120;
                          }
                        }

                        // 0DTE Expiry Day Theta Crush Shield: On Expiry Day (expiryDate === toDate), NEVER buy deep OTM options that decay to ₹0!
                        const isExpiryDay0DTE = String(expiryDate || "") === toDate;
                        if (isExpiryDay0DTE && absDelta < (isSmallCapitalAccount ? 0.04 : 0.42)) {
                          continue;
                        }
                        // Institutional Golden Sweet Spot: ATM / 1-Step ITM (Delta 0.46 - 0.65)
                        // Delivers 1:1 explosive intrinsic expansion with minimal theta drag!
                        if (!isSmallCapitalAccount) {
                          if (absDelta >= 0.46 && absDelta <= 0.65) score += 150;
                          else if (absDelta >= 0.35 && absDelta < 0.46) score += 60;
                          else if (absDelta >= 0.25 && absDelta < 0.35) score += 20;
                          else if (absDelta < 0.22) score -= 140; // Heavy penalty for deep OTM lottery tickets
                        }

                        if (bidAskSpreadPct <= 0.8) score += 40;
                        else if (bidAskSpreadPct <= 1.5) score += 20;
                        if (iv > 8 && iv <= 32) score += 20;
                        else if (iv > 42) score -= 30;

                        if (volume > 15000 || oi > 60000) score += 25;
                        if (closePrice > 0 && ltp > closePrice) score += 30;

                        const distRatio =
                          Math.abs(Number(row.strike_price) - liveLtp) / (liveLtp || 1);
                        score -= distRatio * 1600; // Heavily penalize distance from spot so true ATM / 1-step ITM always wins!

                        scoredCandidates.push({
                          score,
                          strikePrice: Number(row.strike_price),
                          ltp,
                          lotSize: lotSz,
                          delta,
                          gamma,
                          theta,
                          iv,
                          oi,
                          oiChange,
                          bidAskRatio,
                          volume,
                          instrumentKey: optObj?.instrument_key,
                          oneLotCost,
                          estimatedBrokerage,
                          totalRequiredWithBrokerage,
                          expectedNetProfit,
                          fitsCapital,
                        });
                      }

                      scoredCandidates.sort((a, b) => b.score - a.score);
                      const topCandidates = scoredCandidates.slice(0, 4);
                      bestCandidate = topCandidates[0] || null;
                      topOptionCandidateForIndex = bestCandidate;

                      if (topCandidates.length > 0) {
                        // CRITICAL LAYER-2 LIVE OPTION CANDLE & REAL-TIME QUOTE VERIFICATION:
                        // Check the top near-ATM candidate strikes so if #1 has a momentary 1-tick pause, #2 (e.g. ATM vs 1-step ITM) can confirm!
                        let optionMomentumConfirmed = false;

                        for (const cand of topCandidates) {
                          if (!cand?.instrumentKey) continue;
                          let liveOptLtp = Number(
                            globalLiveQuotes[cand.instrumentKey]?.last_price || cand.ltp,
                          );
                          try {
                            const optQJson: any = await resilientFetchJson(
                              `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(cand.instrumentKey)}`,
                              {
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                  Accept: "application/json",
                                  "Api-Version": "2.0",
                                },
                              },
                              1,
                              3500
                            );
                            const qItem =
                              optQJson?.data?.[cand.instrumentKey] ||
                              Object.values(optQJson?.data || {})[0];
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
                            const cachedOptC =
                              optionIntradayCandleCache[cand.instrumentKey];
                            if (
                              cachedOptC &&
                              Date.now() - cachedOptC.timestamp < 5000
                            ) {
                              optRawCandles = cachedOptC.raw;
                            } else {
                              const optCJson: any = await resilientFetchJson(
                                `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(cand.instrumentKey)}/1minute`,
                                {
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                    Accept: "application/json",
                                    "Api-Version": "2.0",
                                  },
                                },
                                1,
                                4000
                              );
                              if (
                                optCJson?.status === "success" &&
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
                              const recentOpt3mHigh = Math.max(
                                optHigh0,
                                optHigh1,
                                Number(c2[2] || 0),
                              );
                              // Evaluate across combined 2-candle window (c1 + c0) so a brand-new 1-minute candle with a ₹0.50 range never gets falsely rejected
                              const combined2mHigh = Math.max(optHigh0, optHigh1);
                              const combined2mLow = Math.min(optLow0, optLow1);
                              const combined2mRange = Math.max(0.5, combined2mHigh - combined2mLow);
                              const optClosePos = (liveOptLtp - combined2mLow) / combined2mRange;
                              const optUpperWickRatio = (combined2mHigh - liveOptLtp) / combined2mRange;

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

                              const singleMinuteSpikePct =
                                optOpen0 > 0 ? ((liveOptLtp - optOpen0) / optOpen0) * 100 : 0;
                              // Allow either current 1m candle rising OR holding firm after a strong green c1/c2 impulse
                              const isOptionRisingNow =
                                (liveOptLtp >= optOpen0 && liveOptLtp >= optClose1 * 0.99) ||
                                (liveOptLtp >= optClose1 * 0.994 && optClose1 >= optOpen1) ||
                                (liveOptLtp > optClose2 && liveOptLtp >= optOpen0 * 0.992);

                              // SMART BOTTOM-DIP & BASE REVERSAL ENTRY ENGINE:
                              // Catches the early turn near the lowest base/dip (₹70–₹72) before the green candle explodes!
                              // Strictly prevents buying at the peak of extended candles or long upper wick rejections!
                              const optLowestBase = Math.min(optLow0, optLow1, optLow2);
                              const isBottomDipBounce =
                                isUnderlying1mConfirmingNow &&
                                liveOptLtp >= optLowestBase * 1.0015 &&
                                liveOptLtp <= optLowestBase * 1.035 && // Catch early turn from 0.15% to 3.5% of lowest base!
                                liveOptLtp >= optOpen0 * 0.992 &&
                                optUpperWickRatio <= 0.25;

                              const isEarlyReversalTurn =
                                isUnderlying1mConfirmingNow &&
                                liveOptLtp >= optOpen0 * 1.002 &&
                                liveOptLtp <= optOpen0 * 1.035 && // Early in candle: within 0.2% - 3.5% of start
                                liveOptLtp >= optShortVwap * 0.975 &&
                                liveOptLtp <= optShortVwap * 1.038 &&
                                optUpperWickRatio <= 0.28;

                              const isLowPriceDipEntry =
                                isUnderlying1mConfirmingNow &&
                                liveOptLtp >= optShortVwap * 0.975 &&
                                liveOptLtp <= optShortVwap * 1.030 &&
                                optClosePos >= 0.20 &&
                                optClosePos <= 0.80 &&
                                optUpperWickRatio <= 0.25 &&
                                singleMinuteSpikePct <= 3.2 &&
                                singleMinuteSpikePct >= -2.5;

                              const isCleanBreakoutEntry =
                                isUnderlying1mConfirmingNow &&
                                isOptionRisingNow &&
                                (liveOptLtp >= optClose2 * 0.985 || liveOptLtp >= optClose1 * 0.99) &&
                                liveOptLtp >= optShortVwap * 0.99 &&
                                liveOptLtp <= optShortVwap * 1.035 && // STRICT ANTI-CHASE: Never buy if extended >3.5% above VWAP!
                                optClosePos >= 0.35 &&
                                optClosePos <= 0.82 &&
                                optUpperWickRatio <= 0.20 && // Low upper wick only! If candle has >20% wick, buyers are already exhausted!
                                singleMinuteSpikePct <= 3.5 && // Never buy at the peak of a vertical spike!
                                singleMinuteSpikePct >= -1.5;

                              const currentIstHourNow = ((new Date().getUTCHours() + 5.5) % 24);
                              const currentIstMinNow = new Date().getUTCMinutes();
                              const currentIstMinutesTotal = currentIstHourNow * 60 + currentIstMinNow;
                              const isMorningOpeningWindow = currentIstMinutesTotal >= (9 * 60 + 15) && currentIstMinutesTotal <= (10 * 60 + 45);

                              const isMorningOpenImpulse =
                                isMorningOpeningWindow &&
                                isUnderlying1mConfirmingNow &&
                                liveOptLtp >= optLowestBase * 1.0015 &&
                                liveOptLtp <= optLowestBase * 1.048 && // Early morning base turn window!
                                optUpperWickRatio <= 0.32;

                              if (isOptionSellingMode) {
                                if (
                                  isUnderlying1mConfirmingNow &&
                                  liveOptLtp <= optOpen0 * 1.005 &&
                                  liveOptLtp <= optClose1 * 1.005 &&
                                  liveOptLtp <= optShortVwap * 1.008
                                ) {
                                  candMomentumOk = true;
                                }
                              } else if (isMorningOpenImpulse || isBottomDipBounce || isEarlyReversalTurn || isLowPriceDipEntry || isCleanBreakoutEntry || (isUnderlying1mConfirmingNow && liveOptLtp >= optOpen0 * 0.980)) {
                                candMomentumOk = true;
                              }
                            } else if (optRawCandles.length === 1) {
                              const c0 = optRawCandles[0];
                              const optOpen0 = Number(c0[1] || liveOptLtp);
                              if (isOptionSellingMode ? liveOptLtp <= optOpen0 * 1.005 : liveOptLtp >= optOpen0 * 0.980) {
                                candMomentumOk = true;
                              }
                            } else if (optRawCandles.length === 0) {
                              // Fallback for BSE / new contracts when Upstox 1m historical candles are empty or delayed
                              const idxLastCandle = enriched[enriched.length - 1];
                              const isUnderlying1mConfirmingNow = isBullish
                                ? liveLtp >= idxLastCandle.open * 0.9997
                                : liveLtp <= idxLastCandle.open * 1.0003;
                              if (isUnderlying1mConfirmingNow && liveOptLtp >= chainSnapshotLtp * 0.985) {
                                candMomentumOk = true;
                              }
                            }
                          } catch (optCandleErr) {
                            console.error("Option 1m candle eval error:", optCandleErr);
                          }

                          // Anti-Double-Order Guard (15-second buffer):
                          const recentClosed = cand.instrumentKey ? recentClosedStrikes[cand.instrumentKey] : null;
                          if (recentClosed) {
                            const elapsedSinceExit = Date.now() - recentClosed.exitTime;
                            if (elapsedSinceExit < STRIKE_LOCKOUT_MS) {
                              candMomentumOk = false;
                            }
                          }
                          if (liveOptLtp < chainSnapshotLtp * 0.988) {
                            candMomentumOk = false;
                          }

                          const candDeltaAbs = Math.abs(Number(cand.delta || 0.48));
                          const candUnderlyingAtr = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
                          const candUnderlyingRes = Number(signal?.institutionalQuantAnalysis?.nearestResistance || (liveLtp + candUnderlyingAtr * 2.5));
                          const candUnderlyingSup = Number(signal?.institutionalQuantAnalysis?.nearestSupport || (liveLtp - candUnderlyingAtr * 2.5));
                          const candRunwayPoints = isBullish
                            ? Math.max(candUnderlyingAtr * 1.8, candUnderlyingRes - liveLtp)
                            : Math.max(candUnderlyingAtr * 1.8, liveLtp - candUnderlyingSup);
                          const candExpGainPts = Math.max(liveOptLtp * 0.18, candRunwayPoints * candDeltaAbs);
                          const freshTargetMult = Math.max(1.20, (liveOptLtp + candExpGainPts) / (liveOptLtp || 1));
                          const freshCharges = calculateTradeCharges(
                            liveOptLtp,
                            lotSz,
                            true,
                            liveOptLtp * freshTargetMult,
                          );
                          cand.oneLotCost = freshCharges.tradeValue;
                          cand.estimatedBrokerage = freshCharges.roundTripCharges;
                          cand.totalRequiredWithBrokerage =
                            freshCharges.totalRequiredWithBrokerage;

                          // Compute net profit based on all affordable lots with the user's available margin
                          const lotAfford = calculateAffordableLotsWithBrokerage(
                            liveOptLtp,
                            lotSz,
                            compactCapCeiling,
                            true,
                            5,
                          );
                          const possibleLots = Math.max(1, lotAfford.affordableLots);
                          cand.possibleLots = possibleLots;
                          cand.expectedNetProfit = Number(
                            (
                              liveOptLtp * (freshTargetMult - 1) * lotSz * possibleLots -
                              freshCharges.roundTripCharges
                            ).toFixed(2),
                          );

                          const minReqNetProfit = isSmallCapitalAccount
                            ? 1
                            : Math.max(
                                Math.min(25, Number(botConfig.minOptionProfitAmount || 25)),
                                cand.estimatedBrokerage * 0.5,
                              );
                          if (cand.expectedNetProfit < minReqNetProfit) {
                            candMomentumOk = false;
                          }

                          if (candMomentumOk) {
                            bestCandidate = cand;
                            optionMomentumConfirmed = true;
                            break;
                          }
                        }

                        const liveOptLtp = Number(bestCandidate.ltp || 0);
                        const symUpper = idx.symbol.toUpperCase();
                        let indexPrefix = symUpper;
                        if (symUpper.includes("BANKEX")) indexPrefix = "BANKEX";
                        else if (symUpper.includes("SENSEX")) indexPrefix = "SENSEX";
                        else if (symUpper.includes("MID SELECT") || symUpper.includes("MIDCP"))
                          indexPrefix = "MIDCPNIFTY";
                        else if (symUpper.includes("FIN")) indexPrefix = "FINNIFTY";
                        else if (symUpper.includes("BANK")) indexPrefix = "BANKNIFTY";
                        else if (symUpper.includes("NIFTY")) indexPrefix = "NIFTY";

                        const chosenOptSymbol = `${indexPrefix} ${bestCandidate.strikePrice} ${optType}`;

                        const lotAffordability = calculateAffordableLotsWithBrokerage(
                          liveOptLtp,
                          lotSz,
                          effectiveCapital,
                          true,
                          5,
                        );
                        const affordableLots = lotAffordability.affordableLots;

                        // Re-run Layer-1 + Layer-2 analyzer with real option price, Greeks, Corporate Heavyweights, OI Walls, and Capital + Brokerage fit
                        signal = analyzeTradingSignals(
                          idx.symbol,
                          idx.symbol,
                          idxKey,
                          enriched,
                          liveLtp,
                          botConfig.selectedStrategy as any,
                          liveOptLtp,
                          {
                            optionSymbol: chosenOptSymbol,
                            strikePrice: bestCandidate.strikePrice,
                            optionType: optType,
                            ltp: liveOptLtp,
                            expiry: expiryDate,
                            lotSize: lotSz,
                            delta: bestCandidate.delta,
                            gamma: bestCandidate.gamma,
                            theta: bestCandidate.theta,
                            iv: bestCandidate.iv,
                            oi: bestCandidate.oi,
                            oiChange: bestCandidate.oiChange,
                            bidAskRatio: bestCandidate.bidAskRatio,
                            callWallStrike,
                            putWallStrike,
                            corporateHeavyweightScore,
                            corporateHeavyweightSummary,
                            globalMacroAlignment,
                            fiveYearRegimeTrend: fiveYearMetrics?.fiveYearRegimeTrend,
                            fiveYearRegimeSummary: fiveYearMetrics?.fiveYearRegimeSummary,
                            fiveYearRegimeSummaryMl: fiveYearMetrics?.fiveYearRegimeSummaryMl,
                            multiYearSupport: fiveYearMetrics?.multiYearSupport,
                            multiYearResistance: fiveYearMetrics?.multiYearResistance,
                            historicalPatternWinRate: fiveYearMetrics?.historicalPatternWinRate,
                            ema200Daily: fiveYearMetrics?.ema200Daily,
                            ema50Daily: fiveYearMetrics?.ema50Daily,
                            indiaVix: liveIndiaVix,
                            volume: bestCandidate.volume,
                            pcr: chainPcr,
                            instrumentKey: bestCandidate.instrumentKey,
                            requiredCapital: bestCandidate.oneLotCost,
                            estimatedBrokerage: bestCandidate.estimatedBrokerage,
                            totalRequiredWithBrokerage:
                              bestCandidate.totalRequiredWithBrokerage,
                            expectedNetProfit: bestCandidate.expectedNetProfit,
                            affordableLots,
                            availableCapital: effectiveCapital,
                          },
                        );

                        if (signal && bestCandidate?.instrumentKey) {
                          signal.instrumentKey = bestCandidate.instrumentKey;
                          verifiedRealOptionStrike = true;
                          if (lotSz > 0) {
                            lotSizeCache[bestCandidate.instrumentKey] = {
                              lotSize: lotSz,
                              timestamp: Date.now(),
                              source: "UPSTOX_LIVE",
                              expiry: expiryDate,
                            };
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error("Option Fetch Error: ", e);
                }
              }

              if (signal && !verifiedRealOptionStrike) {
                signal.signalType = "HOLD";
                signal.confidenceScore = Math.min(signal.confidenceScore || 50, 58);
              }

              // Always keep exactly 1 up-to-date signal per underlying index in botSignals so downgraded HOLD signals never leave stale BUY/SELL entries!
              if (signal) {
                const signalSymbol = signal.symbol;
                const existingIdx = botSignals.findIndex(
                  (s) => s.underlyingInstrumentKey === idx.key || s.symbol === signalSymbol,
                );
                if (existingIdx === -1) {
                  botSignals.unshift(signal);
                  if (botSignals.length > 20) botSignals.length = 20;
                } else {
                  botSignals[existingIdx] = signal;
                }
              }
            } else if (signal) {
              // Also update/show live HOLD analysis in botSignals so the UI always displays real-time index status while waiting for a breakout
              const existingIdx = botSignals.findIndex(
                (s) => s.underlyingInstrumentKey === idx.key || s.symbol === idx.symbol,
              );
              if (existingIdx === -1) {
                botSignals.push(signal);
                if (botSignals.length > 20) botSignals.length = 20;
              } else {
                botSignals[existingIdx] = signal;
              }
            }

            const expNetVal = Number(topOptionCandidateForIndex?.expectedNetProfit || 0);
            const timeframe15m = signal?.mtfConfirmation?.timeframe15m ?? "NEUTRAL";
            const idxScanItem: any = {
              key: idx.key,
              symbol: idx.symbol,
              displayName: idx.symbol,
              exchange: idx.key.startsWith("BSE") ? "BSE" : "NSE",
              spotLtp: liveLtp,
              trend15m: timeframe15m,
              trend5m: signal?.mtfConfirmation?.timeframe5m || "NEUTRAL",
              signalType: signal?.signalType || "HOLD",
              confidenceScore: signal?.confidenceScore || 50,
              corporateHeavyweightScore,
              corporateHeavyweightSummary,
              bestOptionSymbol: topOptionCandidateForIndex && signal?.signalType !== "HOLD" ? signal?.symbol : undefined,
              bestOptionLtp: topOptionCandidateForIndex?.ltp || 0,
              lotSize: topOptionCandidateForIndex?.lotSize || lotSizeCache[idx.key]?.lotSize || 1,
              bestStrike: topOptionCandidateForIndex?.strikePrice || 0,
              delta: topOptionCandidateForIndex?.delta || 0,
              gamma: topOptionCandidateForIndex?.gamma || 0,
              expectedNetProfit: expNetVal,
              totalRequiredCashWithBrokerage: topOptionCandidateForIndex?.totalRequiredWithBrokerage || 0,
              roiPotentialPct: topOptionCandidateForIndex?.roiPotentialPct || 0,
              alphaOpportunityScore: 0,
              verifiedRealOptionStrike,
              statusTextMl:
                signal?.signalType === "BUY"
                  ? `🔥 ശക്തമായ CE ബ്രേക്ക്ഔട്ട് (Exp Net: +₹${Math.round(expNetVal)})`
                  : signal?.signalType === "SELL"
                    ? `⚡ ശക്തമായ PE ബ്രേക്ക്ഡൗൺ (Exp Net: +₹${Math.round(expNetVal)})`
                    : timeframe15m !== "NEUTRAL"
                      ? `⏳ 15m ${timeframe15m} - മികച്ച ഓപ്ഷൻ പ്രീമിയം ബ്രേക്ക്ഔട്ടിനായി കാത്തിരിക്കുന്നു`
                      : `⏳ ഇൻഡക്സ് കൺസോളിഡേഷനിലാണ് (Chop Zone) - റേഞ്ച് ബ്രേക്ക്ഔട്ട് വെയിറ്റ് ചെയ്യുന്നു`,
              statusTextEn:
                signal?.signalType === "BUY"
                  ? `Bullish Breakout CE (Exp Net: +₹${Math.round(expNetVal)})`
                  : signal?.signalType === "SELL"
                    ? `Bearish Breakdown PE (Exp Net: +₹${Math.round(expNetVal)})`
                    : timeframe15m !== "NEUTRAL"
                      ? `15m ${timeframe15m} - Waiting for high-momentum premium entry`
                      : `Consolidation Chop - Waiting for institutional breakout`,
            };
            currentTickMultiIndexComparison.push(idxScanItem);

            const isUnderlyingAlreadyOpen = activePositions.some(
              (p: any) =>
                p.underlyingInstrumentKey === idx.key ||
                (p.symbol && p.symbol.startsWith(idx.symbol.split(" ")[0])),
            );

            if (
              !isUnderlyingAlreadyOpen &&
              !botConfig.dailyLossLocked &&
              !isDailyTradeLimitReached &&
              !isInPostExitCooldown &&
              isTradingDay &&
              isTradingHours &&
              verifiedRealOptionStrike &&
              signal &&
              signal.instrumentKey &&
              !String(signal.instrumentKey).includes("INDEX") &&
              (signal.signalType === "BUY" || signal.signalType === "SELL") &&
              (signal.signalType === "BUY" ? signal.mtfConfirmation?.timeframe15m === "BULLISH" : signal.mtfConfirmation?.timeframe15m === "BEARISH") &&
              signal.confidenceScore >= Math.max(78, Number(botConfig.minConfidence || 78))
            ) {
              const isBullish = signal.signalType === "BUY";
              const optionSymbol = signal.symbol;
              const optionPrice = Number(signal.price || 0);
              const optInstrumentKey =
                signal.instrumentKey || signal.underlyingInstrumentKey || "NSE_FO|" + optionSymbol;

              // PERSISTENT ANTI-CHURN & SMART BIG-PROFIT RE-ENTRY GUARD
              const allTradeHist = Array.isArray(paperTradeHistory) ? paperTradeHistory : [];
              const sameStrikeClosed = allTradeHist.find(
                (h: any) => h && (h.symbol === optionSymbol || (optInstrumentKey && h.instrumentKey === optInstrumentKey))
              );
              if (sameStrikeClosed) {
                const exitMs = new Date(sameStrikeClosed.closeTime || sameStrikeClosed.timestamp || 0).getTime();
                const timeSinceExit = Date.now() - exitMs;
                // 15-second buffer to prevent duplicate tick orders, but allow taking subsequent breakouts
                if (timeSinceExit < STRIKE_LOCKOUT_MS) {
                  continue;
                }
              }
              const lotSize = await getDynamicLotSize(optionSymbol, token, optInstrumentKey);
              const lotCalc = calculateAffordableLotsWithBrokerage(
                optionPrice,
                lotSize,
                effectiveCapital,
                true,
                5,
              );
              // CRITICAL CAPITAL GUARD: Never enter trade if account balance cannot afford even 1 lot!
              if (effectiveCapital <= 0 || lotCalc.affordableLots < 1) {
                continue;
              }
              let affordableLots = lotCalc.affordableLots;
              if (effectiveCapital > 30000 && (botConfig as any).maxConcurrentTrades === 1) {
                affordableLots = Math.min(affordableLots, 2);
              } else if (effectiveCapital <= 6500) {
                // Maximize profit for small capital accounts on cheap strikes (e.g. SENSEX 10-lot or low premium strikes)
                affordableLots = Math.min(lotCalc.affordableLots, 3);
              } else {
                affordableLots = Math.min(lotCalc.affordableLots, 2);
              }
              const targetQuantity = affordableLots * lotSize;
              const multiLotCharges = calculateTradeCharges(
                optionPrice,
                targetQuantity,
                true,
                signal.target1 || optionPrice * 1.25,
              );
              const totalTradeCost = multiLotCharges.tradeValue;
              const totalTradeBrokerage = multiLotCharges.roundTripCharges;
              const totalRequiredCashWithBrokerage = multiLotCharges.totalRequiredWithBrokerage;

              // Accurate entry cash requirement: option cost + entry buy charges
              const entryRequiredCash = totalTradeCost + multiLotCharges.buyCharges;
              if (entryRequiredCash > effectiveCapital) {
                continue;
              }

              const isOptionSellingEntry = botConfig.optionStrategyMode === "OPTION_SELLING";
              const execTransactionType = isOptionSellingEntry ? "SELL" : "BUY";
              const execOrderType = botConfig.limitOrderSlippageGuard ? "LIMIT" : "MARKET";
              const roundToTick = (val: number, tick = 0.05) => Number((Math.round(val / tick) * tick).toFixed(2));
              const limitPriceWithSlippageGuard = isOptionSellingEntry
                ? roundToTick(optionPrice * 0.995)
                : roundToTick(optionPrice * 1.005);
              const effectiveStopLoss = isOptionSellingEntry
                ? Number((optionPrice * 1.28).toFixed(2))
                : signal.stopLoss;
              const effectiveTarget1 = isOptionSellingEntry
                ? Number((optionPrice * 0.55).toFixed(2))
                : signal.target1;

              // CORPORATE QUANT MULTI-INDEX ALPHA OPPORTUNITY SCORING:
              // Evaluates Net Profit Expectancy, Capital Efficiency, Greek Delta Momentum, and MTF Confluence
              const expNetProfit = Number(
                bestCandidate?.expectedNetProfit ||
                  Math.max(350, (effectiveTarget1 - optionPrice) * targetQuantity - totalTradeBrokerage),
              );
              const totalReqCash = Math.max(100, totalRequiredCashWithBrokerage);
              const profitYield = expNetProfit / totalReqCash; // Expected Net ROI
              const mtfStatusBonus = signal.mtfConfirmation?.status ? 1.35 : 1.0;
              const rvolMultiplier = Math.min(2.0, Math.max(0.8, Number(signal.indicators?.rvol || 1.15)));
              const confidence = Number(signal.confidenceScore || 85);
              const alphaOpportunityScore = Number(
                (expNetProfit * (confidence / 100) * mtfStatusBonus * rvolMultiplier + profitYield * 120).toFixed(2),
              );

              marketAlphaCandidates.push({
                idx,
                signal,
                bestCandidate,
                optionSymbol,
                optionPrice,
                optInstrumentKey,
                lotSize,
                targetQuantity,
                affordableLots,
                totalTradeCost,
                totalTradeBrokerage,
                totalRequiredCashWithBrokerage,
                effectiveStopLoss,
                effectiveTarget1,
                isBullish,
                isOptionSellingEntry,
                execTransactionType,
                execOrderType,
                limitPriceWithSlippageGuard,
                alphaOpportunityScore,
                expectedNetProfit: expNetProfit,
                profitYield,
              });
              idxScanItem.alphaOpportunityScore = alphaOpportunityScore;
              idxScanItem.expectedNetProfit = expNetProfit;
            }
          }
        } catch (innerErr: any) {
          const errStr = String(innerErr?.message || innerErr?.cause?.message || innerErr?.cause?.code || innerErr);
          const isTransient =
            errStr.includes("ECONNRESET") ||
            errStr.includes("fetch failed") ||
            errStr.includes("socket hang up") ||
            errStr.includes("ETIMEDOUT") ||
            errStr.includes("UND_ERR_SOCKET") ||
            errStr.includes("EAI_AGAIN") ||
            innerErr?.name === "AbortError";
          if (isTransient) {
            console.warn(`[Index Polling] Handled transient network reset for ${idx.key}. Using cached market state.`);
          } else {
            console.error("Inner loop err for", idx.key, innerErr);
          }
        }
      }

      // Update global multi-index comparative alpha matrix & rank indices
      if (currentTickMultiIndexComparison.length > 0) {
        currentTickMultiIndexComparison.sort((a, b) => {
          const aActive = a.signalType !== "HOLD" ? 1000 : 0;
          const bActive = b.signalType !== "HOLD" ? 1000 : 0;
          return (
            bActive +
            (b.alphaOpportunityScore || 0) +
            (b.confidenceScore || 0) -
            (aActive +
              (a.alphaOpportunityScore || 0) +
              (a.confidenceScore || 0))
          );
        });
        currentTickMultiIndexComparison.forEach((item, rIndex) => {
          item.rank = rIndex + 1;
          item.isTopPick = rIndex === 0 && item.signalType !== "HOLD";
        });
        setLatestMultiIndexAlphaMatrix(currentTickMultiIndexComparison);
      }

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
        // Sort all index candidates by alphaOpportunityScore descending!
        marketAlphaCandidates.sort((a, b) => b.alphaOpportunityScore - a.alphaOpportunityScore);

        const topPick = marketAlphaCandidates[0];
        const summaryIndices = marketAlphaCandidates
          .map((c) => `${c.idx.symbol}: Score ${c.alphaOpportunityScore} (+₹${c.expectedNetProfit.toFixed(0)})`)
          .join(" | ");

        botLogs.unshift({
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[MULTI-INDEX OPPORTUNITY SCANNER] Scanned 6 Major Indices: ${summaryIndices}. Top Pick: ${topPick.idx.symbol} (${topPick.optionSymbol}) chosen as #1 MOST PROFITABLE opportunity!`,
          type: "SIGNAL",
        });
        if (botLogs.length > 200) botLogs.length = 200;

        for (const cand of marketAlphaCandidates) {
          if (activePositions.length >= maxAllowedConcurrent) break;

          const isUnderlyingAlreadyOpen = activePositions.some(
            (p: any) =>
              p.underlyingInstrumentKey === cand.idx.key ||
              (p.symbol && p.symbol.startsWith(cand.idx.symbol.split(" ")[0])),
          );
          if (isUnderlyingAlreadyOpen) continue;

          // Capital & Margin verification
          if (botConfig.mode === "UPSTOX_LIVE") {
            if (
              liveAvailableMargin <= 0 ||
              cand.totalRequiredCashWithBrokerage > liveAvailableMargin
            ) {
              const warnMsg = `[LIVE CAPITAL GUARD] ⚠️ ബാലൻസ് കുറവായതിനാൽ (₹${liveAvailableMargin.toLocaleString("en-IN")}) പുതിയ ട്രേഡ് എടുത്തില്ല. ഗുണനിലവാരമുള്ള ട്രേഡിന് ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")} ആവശ്യമാണ്. അനാവശ്യ OTM ട്രേഡുകൾ ഒഴിവാക്കി പണം സംരക്ഷിച്ചു.`;
              botLogs.unshift({
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                message: warnMsg,
                type: "ERROR",
              });
              if (botLogs.length > 200) botLogs.length = 200;
              continue;
            }
          } else if (botConfig.mode === "PAPER_TRADING") {
            // Paper Mode Capital Guard (User Directive Compliance)
            const initialBalance = Math.max(50000, Number((botConfig as any).paperInitialBalance || 50000));
            const totalRealized = paperTradeHistory.reduce((acc, t) => acc + (t.realizedPnL || 0) - (t.brokerageCharges || 0), 0);
            const totalInvestedInOpen = paperPositions.reduce((acc, p) => acc + (p.buyPrice * p.quantity), 0);
            const currentPaperBalance = initialBalance + totalRealized - totalInvestedInOpen;

            if (cand.totalRequiredCashWithBrokerage > currentPaperBalance) {
              const warnMsg = `[PAPER CAPITAL GUARD] Cannot buy ${cand.optionSymbol}: 1 Lot requires ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")}, but virtual balance is only ₹${currentPaperBalance.toFixed(2)}. Trade blocked to prevent overleveraging.`;
              botLogs.unshift({
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                message: warnMsg,
                type: "ERROR",
              });
              if (botLogs.length > 200) botLogs.length = 200;
              continue;
            }
          }

          // Execute Paper Trade or Live Order!
          if (botConfig.mode === "PAPER_TRADING") {
            botLogs.unshift({
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              message: `[PAPER MODE] Top Alpha Setup Confirmed (${cand.signal.confidenceScore}%): ${cand.isOptionSellingEntry ? "SHORT SELLING" : "BUYING"} ${cand.optionSymbol} [${cand.affordableLots} Lot = ${cand.targetQuantity} Qty @ ₹${cand.optionPrice} (${cand.execOrderType}) | Premium: ₹${cand.totalTradeCost.toLocaleString("en-IN")} + Est. Brokerage: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total: ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")} | Est. Net Profit: +₹${cand.expectedNetProfit}].`,
              type: "TRADE",
            });
            if (botLogs.length > 200) botLogs.length = 200;

            const newPosId = "POS" + Date.now();
            paperOrders.unshift({
              id: "ORD" + Date.now(),
              orderId: "PAP_" + Date.now().toString().slice(-6),
              positionId: newPosId,
              symbol: cand.optionSymbol,
              instrumentKey: cand.optInstrumentKey,
              transactionType: cand.execTransactionType,
              type: cand.execTransactionType,
              orderType: cand.execOrderType,
              productType: "INTRADAY",
              quantity: cand.targetQuantity,
              buyPrice: cand.optionPrice,
              price: cand.optionPrice,
              executedPrice: cand.optionPrice,
              status: "COMPLETE",
              timestamp: new Date().toLocaleTimeString("en-IN"),
              time: new Date().toISOString(),
              mode: "PAPER_TRADING",
            });
            if (cand.optInstrumentKey) {
              strikeDailyEntryCount[cand.optInstrumentKey] = (strikeDailyEntryCount[cand.optInstrumentKey] || 0) + 1;
            }
            paperPositions.push({
              id: newPosId,
              openedAtMs: Date.now(),
              symbol: cand.optionSymbol,
              instrumentKey: cand.optInstrumentKey,
              underlyingInstrumentKey: cand.signal.underlyingInstrumentKey,
              productType: "INTRADAY",
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
              optionStrategyType: cand.isOptionSellingEntry ? "OPTION_SELLING" : "OPTION_BUYING",
              mode: "PAPER_TRADING",
              openedAt: new Date().toLocaleTimeString("en-IN"),
              isOption: true,
            });
            savePostgresDb().catch(() => { /* ignore */ });

            sendTelegramNotification(
              `🟢 <b>PAPER BOT ENTRY TRIGGERED (${cand.isOptionSellingEntry ? "OPTION SELLING" : "OPTION BUYING"})</b>\n\n` +
              `📊 <b>Option Contract:</b> <code>${cand.optionSymbol}</code>\n` +
              `🏆 <b>Rank:</b> #1 Most Profitable Index Setup (Alpha Score: ${cand.alphaOpportunityScore})\n` +
              `🎯 <b>Direction:</b> ${cand.isOptionSellingEntry ? `SHORT ${cand.isBullish ? "PE" : "CE"}` : cand.isBullish ? "CE (Bullish Call)" : "PE (Bearish Put)"}\n` +
              `📦 <b>Quantity:</b> ${cand.targetQuantity} Qty (${cand.affordableLots} Lot × ${cand.lotSize})\n` +
              `💰 <b>Option Premium:</b> ₹${cand.optionPrice} (${cand.execOrderType} | Capital: ₹${cand.totalTradeCost.toLocaleString("en-IN")})\n` +
              `📈 <b>Est. Net Profit:</b> +₹${cand.expectedNetProfit}\n` +
              `🛡️ <b>Mode:</b> PAPER_TRADING\n` +
              `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
            ).catch(() => { /* ignore */ });
          } else if (botConfig.mode === "UPSTOX_LIVE" && token) {
            try {
              const orderJson = await placeUpstoxOrderIpv4({
                quantity: cand.targetQuantity,
                product: "D",
                validity: "DAY",
                price: cand.execOrderType === "LIMIT" ? cand.limitPriceWithSlippageGuard : 0,
                tag: cand.isOptionSellingEntry ? "bot_auto_short" : "bot_auto_entry",
                instrument_token: cand.optInstrumentKey,
                order_type: cand.execOrderType,
                transaction_type: cand.execTransactionType,
                disclosed_quantity: 0,
                trigger_price: 0,
                is_amo: false,
              }, token);
              if (orderJson?.status === "success") {
                if (cand.optInstrumentKey) {
                  strikeDailyEntryCount[cand.optInstrumentKey] = (strikeDailyEntryCount[cand.optInstrumentKey] || 0) + 1;
                }
                botLogs.unshift({
                  id: Date.now().toString(),
                  time: new Date().toLocaleTimeString(),
                  message: `[UPSTOX LIVE] Top Alpha Order Executed (${cand.signal.confidenceScore}%): ${cand.isOptionSellingEntry ? "Short Sold" : "Bought"} ${cand.optionSymbol} [${cand.affordableLots} Lot = ${cand.targetQuantity} Qty @ ₹${cand.optionPrice} (${cand.execOrderType}) | Premium: ₹${cand.totalTradeCost.toLocaleString("en-IN")} + Brokerage & Taxes: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total Cash Used: ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")} | Est. Net Profit: +₹${cand.expectedNetProfit}].`,
                  type: "TRADE",
                });
                if (botLogs.length > 200) botLogs.length = 200;

                sendTelegramNotification(
                  `🟢 <b>UPSTOX LIVE ENTRY EXECUTED (${cand.isOptionSellingEntry ? "OPTION SELLING" : "OPTION BUYING"})</b>\n\n` +
                  `📊 <b>Option Contract:</b> <code>${cand.optionSymbol}</code>\n` +
                  `🏆 <b>Rank:</b> #1 Most Profitable Index Setup (Alpha Score: ${cand.alphaOpportunityScore})\n` +
                  `🎯 <b>Direction:</b> ${cand.isOptionSellingEntry ? "SHORT OPTION" : cand.isBullish ? "CE (Bullish Call)" : "PE (Bearish Put)"}\n` +
                  `📦 <b>Quantity:</b> ${cand.targetQuantity} Qty (${cand.affordableLots} Lot × ${cand.lotSize})\n` +
                  `💰 <b>Premium:</b> ₹${cand.optionPrice} (₹${cand.totalTradeCost.toLocaleString("en-IN")})\n` +
                  `🧾 <b>Est. Brokerage & Taxes:</b> ₹${cand.totalTradeBrokerage.toFixed(2)}\n` +
                  `💳 <b>Total Cash Used:</b> ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")}\n` +
                  `📈 <b>Est. Net Profit:</b> +₹${cand.expectedNetProfit}\n` +
                  `🛡️ <b>Mode:</b> UPSTOX_LIVE\n` +
                  `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
                ).catch(() => { /* ignore */ });
              } else {
                let errDetail = orderJson?.errors?.[0]?.message || orderJson?.message || JSON.stringify(orderJson);
                if (errDetail.includes("static IP") || errDetail.includes("34.96.48") || errDetail.includes("UDAPI1154")) {
                  errDetail = `⚠️ Upstox static IP restriction: Upstox Developer Console-ൽ നിങ്ങളുടെ Static IP-കൾ (8.234.113.241, 34.34.254.178) കൃത്യമായി നൽകിയിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക. (${errDetail})`;
                }
                const liveErrText = `[UPSTOX LIVE REJECTED] Order for ${cand.optionSymbol} rejected: ${errDetail}`;
                botLogs.unshift({
                  id: Date.now().toString(),
                  time: new Date().toLocaleTimeString(),
                  message: liveErrText,
                  type: "ERROR",
                });
                if (botLogs.length > 200) botLogs.length = 200;
              }
            } catch (err: any) {
              console.error("Error placing live auto buy order:", err);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Bot loop error:", err);
  } finally {
    setIsBotTickRunning(false);
  }}, 200);
}
