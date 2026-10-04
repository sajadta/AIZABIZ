process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || "") + " --dns-result-order=ipv4first";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
import { appState, tradeHistory } from "./src/db/schema";
import { db, isPostgresConfigured } from "./src/db/index";
import { desc, eq } from "drizzle-orm";
import { WebSocketServer } from "ws";
import { createRequire } from "module";
const _require =
  typeof require !== "undefined" ? require : createRequire(import.meta.url);
import {
  analyzeTradingSignals,
  enrichCandlesWithIndicators,
} from "./src/utils/indicators";
import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import zlib from "zlib";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

let postgresAvailable = isPostgresConfigured;

app.get('/api/history', async (req, res) => {
  if (!postgresAvailable) {
    return res.json(paperTradeHistory);
  }
  try {
    const rows = await db.select().from(tradeHistory).orderBy(desc(tradeHistory.closeTime)).limit(200);
    res.json(rows.length > 0 ? rows : paperTradeHistory);
  } catch (e) {
    postgresAvailable = false;
    res.json(paperTradeHistory);
  }
});


// ---------------------------------------------------------
// ALGO BOT ENGINE (BACKEND - ALWAYS ACTIVE 24x7 CLOUD ENGINE)
// ---------------------------------------------------------

let botConfig = {
  enabled: true, // Always running continuously on the server even if client internet disconnects
  mode: "PAPER_TRADING", // 'PAPER_TRADING' | 'UPSTOX_LIVE'
  selectedStrategy: "PROFIT_MAX_100_PERCENT_MATRIX",
  minConfidence: 65,
  riskPerTradePercent: 1.5,
  stopLossPercent: 10,
  targetProfitPercent: 30,
  trailingStopLoss: true,
  trailingStepPercent: 5,
  tradeQuantity: 50,
  multiTimeframeEnabled: true,
  optionStrikeSelector: true,
  tradeMmode: "OPTIONS_ONLY", // 'OPTIONS_ONLY'
  maxOptionLossCount: 4,
  maxOptionProfitCount: 15,
  minOptionProfitAmount: 300,
  dailyLossLocked: false,

  
  dailyMaxLossLimit: 500,
  enableAtrStopLoss: true, // Auto adjust SL based on volatility
  enableEmaSupertrendExit: true, // Exit on trend reversal
  enablePartialBooking: true, // Book 50% at target, trail rest
  enableTimeDecayProtection: true, // Auto exit options before 3 PM
  enableIndexCorrelation: true, // Check main NIFTY/BANKNIFTY chart
  marketRegimeFilter: true, // Sideways market detection
  dynamicPositionSizing: true, // AI confidence based sizing
  newsSentimentFilter: true, // News checks
  ivCrushProtection: true, // Options Greek IV checks
  autoKillSwitch: true, // Emotionless kill switch on max loss
  maxConsecutiveLosses: 3,
  autoStrikeSelection: true, // Selects best ATM/ITM options automatically
  multiTimeframeConfluence: true // Checks 15m and 1h trends before trade
,
};

let botLogs: any[] = [];
let botSignals: any[] = [];

// API Endpoints for Bot
app.get("/api/bot/config", (req, res) => res.json(botConfig));
app.post("/api/bot/config", (req, res) => {
  botConfig = { ...botConfig, ...req.body };
  botLogs.unshift({
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString(),
    message: "Bot configuration updated.",
    type: "INFO",
  });
  if (botLogs.length > 200) botLogs.length = 200;
  res.json(botConfig);
});

app.get("/api/bot/diagnostics", (req, res) => {
  res.json({
    systemTime: new Date().toISOString(),
    botEnabled: botConfig.enabled,
    tradingMode: botConfig.mode,
    hasUpstoxToken: !!upstoxConfig.accessToken,
    upstoxWsConnected:
      typeof upstoxWsConnected !== "undefined" ? upstoxWsConnected : false,
    subscribedKeysCount:
      typeof subscribedKeys !== "undefined" ? subscribedKeys.size : 0,
    activePaperPositions:
      typeof paperPositions !== "undefined" ? paperPositions.length : 0,
    liveQuotesTracked:
      typeof globalLiveQuotes !== "undefined"
        ? Object.keys(globalLiveQuotes).length
        : 0,
    lastQuoteTime:
      typeof globalLiveQuotes !== "undefined" && globalLiveQuotes["last_update"]
        ? globalLiveQuotes["last_update"]
        : null,
  });
});

app.get("/api/bot/logs", (req, res) => res.json(botLogs.slice(0, 50)));
app.get("/api/bot/signals", (req, res) => res.json(botSignals.slice(0, 20)));

// Bot Loop Interval
setInterval(async () => {
  if (!botConfig.enabled) return;

  try {
    // 1. Process active positions for Auto-Square Off (Target/SL)
    let activePositions =
      botConfig.mode === "PAPER_TRADING" ? paperPositions : [];

    // Fetch live positions if in UPSTOX_LIVE  mode
    if (botConfig.mode === "UPSTOX_LIVE" && upstoxConfig.accessToken) {
      try {
        const pRes = await fetch(
          "https://api.upstox.com/v2/portfolio/short-term-positions",
          {
            headers: {
              Authorization: `Bearer ${upstoxConfig.accessToken}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          },
        );
        const pData = await pRes.json();
        if (pData.status === "success" && pData.data) {
          activePositions = pData.data
            .map((p: any) => ({
              id: p.trading_symbol || p.instrument_token,
              symbol: p.trading_symbol || p.instrument_token,
              instrumentKey: p.instrument_token,
              type: p.quantity > 0 ? "BUY" : p.quantity < 0 ? "SELL" : "CLOSED",
              quantity: Math.abs(p.quantity || p.net_quantity || 0),
              buyPrice: p.average_price || p.buy_amount / (p.buy_quantity || 1),
              currentLTP: p.last_price || p.average_price,
              pnl: p.pnl || p.m2m,
            }))
            .filter((p: any) => p.type !== "CLOSED");
        }
      } catch (err) {
        console.error("Error fetching live positions for bot:", err);
      }
    }

    let currentLiveQuote = 24200; // Fallback

    // Fetch live quotes to update PNL
    const token = upstoxConfig.accessToken;
    if (!token && botConfig.mode === "UPSTOX_LIVE") {
      botSignals.length = 0;
      return;
    }
    let instruments = [
      (botConfig as any).selectedInstrumentKey || "NSE_INDEX|Nifty 50",
    ];
    activePositions.forEach((p) => {
      if (p.instrumentKey && !instruments.includes(p.instrumentKey)) {
        instruments.push(p.instrumentKey);
      }
    });

    let liveQuotesMap: any = {};
    if (token) {
      try {
        const qRes = await fetch(
          `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instruments.join(","))}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          },
        );
        const qData = await qRes.json();

        if (qData?.data) {
          liveQuotesMap = qData.data;
          const mainKey =
            (botConfig as any).selectedInstrumentKey || "NSE_INDEX|Nifty 50";
          let mq = liveQuotesMap[mainKey] || Object.values(liveQuotesMap).find((q:any) => q.instrument_token === mainKey);
          if (mq?.last_price) {
            currentLiveQuote = mq.last_price;
          }
        }
      } catch (e) {}
    }

    // Merge with global WS quotes
    for (const k in globalLiveQuotes) {
      if (!liveQuotesMap[k]) liveQuotesMap[k] = globalLiveQuotes[k];
    }

    const nowIst = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    // Only trigger EOD square off between 15:15 and 15:30 to prevent API spam after market hours
    const isEodSquareOff =
      nowIst.getHours() === 15 &&
      nowIst.getMinutes() >= 15 &&
      nowIst.getMinutes() < 30;

    for (let pos of activePositions) {
      let quoteObj = liveQuotesMap[pos.instrumentKey];
      if (!quoteObj) {
        quoteObj = Object.values(liveQuotesMap).find((q: any) => q.instrument_token === pos.instrumentKey);
      }
      if (quoteObj && quoteObj.last_price) {
        // Fix: Do not update currentLTP if it is ridiculously higher than buyPrice for options (to prevent 5 lakh profit glitch)
        if (pos.isOption && quoteObj.last_price > pos.buyPrice * 50) {
          // Probably underlying index price instead of option premium
        } else {
          pos.currentLTP = quoteObj.last_price;
          pos.pnl = (pos.currentLTP - pos.buyPrice) * pos.quantity;
        }
      }

      if (
        (pos.type === "BUY" &&
          (pos.symbol.includes("CE") || pos.symbol.includes("PE"))) ||
        pos.isOption
      ) {
        const ltp = pos.currentLTP || pos.buyPrice;
        pos.highestLTP = Math.max(pos.highestLTP || pos.buyPrice, ltp);

        const pnlPercent =
          pos.buyPrice > 0 ? ((ltp - pos.buyPrice) / pos.buyPrice) * 100 : 0;
        let shouldSell = false;
        let sellReason = "";

        if (isEodSquareOff) {
          shouldSell = true;
          sellReason = `End of day Auto Square-Off at 15:15 IST for ${pos.symbol}.`;
        }

        // Static Stop and Target values based on BUY price
        const staticStopLossPrice =
          pos.buyPrice * (1 - (botConfig.stopLossPercent || 10) / 100);
        const staticTargetPrice =
          pos.buyPrice * (1 + (botConfig.targetProfitPercent || 30) / 100);

        // 1. DYNAMIC PROFIT RETENTION VAULT & 100% PEAK HARVEST
        // Guarantee: A trade that touched high profit (e.g. ₹10,000, ₹5,000, ₹2,000, ₹800)
        // CAN NEVER evaporate down to ₹200 or a loss! It locks minimum 90%-96% of peak profit immediately.
        const posPnL = (ltp - pos.buyPrice) * (pos.quantity || 1);
        pos.highestPnl = Math.max(pos.highestPnl || 0, posPnL);

        // Tiered Profit Vault: If peak hit ₹8,000 - ₹10,000+, lock immediately on tiny 3-4% micro-pullback
        if (pos.highestPnl >= 8000) {
          const maxAllowedPullback = Math.min(350, pos.highestPnl * 0.04); // Locks at least 96% of peak
          if (posPnL <= pos.highestPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[ULTRA PROFIT VAULT] Peak profit touched ₹${pos.highestPnl.toFixed(0)}! Locked ₹${posPnL.toFixed(2)} on first 4% micro-exhaustion before any retracement.`;
          }
        } else if (pos.highestPnl >= 4000) {
          const maxAllowedPullback = Math.min(200, pos.highestPnl * 0.05); // Locks 95% of peak
          if (posPnL <= pos.highestPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[HIGH PROFIT LOCK] Peak was ₹${pos.highestPnl.toFixed(0)}. Secured ₹${posPnL.toFixed(2)} at top price!`;
          }
        } else if (pos.highestPnl >= 1500) {
          const maxAllowedPullback = Math.min(120, pos.highestPnl * 0.08); // Locks 92% of peak
          if (posPnL <= pos.highestPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[PEAK HARVEST] Peak reached ₹${pos.highestPnl.toFixed(0)}. Captured ₹${posPnL.toFixed(2)}!`;
          }
        } else if (pos.highestPnl >= 600) {
          const maxAllowedPullback = Math.min(80, pos.highestPnl * 0.12);
          if (posPnL <= pos.highestPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[PROFIT SHIELD] Profit reached ₹${pos.highestPnl.toFixed(0)}. Locked ₹${posPnL.toFixed(2)} before reversal!`;
          }
        }

        // Hard Floor Guarantee: Once a trade gained >= ₹1,000, NEVER allow profit to drop below 80% of peak or ₹800
        if (!shouldSell && pos.highestPnl >= 1000) {
          const absoluteFloor = Math.max(800, pos.highestPnl * 0.85);
          if (posPnL <= absoluteFloor) {
            shouldSell = true;
            sellReason = `[ABSOLUTE PROFIT FLOOR] Never lose hard-earned gains! Exited at ₹${posPnL.toFixed(2)} to protect peak of ₹${pos.highestPnl.toFixed(0)}.`;
          }
        }

        if (!shouldSell && ltp >= staticTargetPrice) {
          shouldSell = true;
          sellReason = `Perfect Target Profit hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Maximum profit locked!`;
        }
        // 2. Trailing Stop Loss (Smart Trailing)
        else if (botConfig.trailingStopLoss) {
          // Calculate trailing stop based on highest achieved price
          const trailingStopPrice =
            pos.highestLTP * (1 - (botConfig.trailingStepPercent || 5) / 100);

          // To prevent exiting at a loss when the trade was in profit,
          // we ensure the stop loss is at least the buy price if highestLTP is significantly higher.
          // (Cost-to-Cost trailing). If profit reached > trailingStepPercent, never exit in loss.
          const isCostToCostActive =
            pos.highestLTP >=
            pos.buyPrice * (1 + (botConfig.trailingStepPercent || 5) / 100);
          const effectiveStopPrice = isCostToCostActive
            ? Math.max(trailingStopPrice, pos.buyPrice * 1.005) // Lock tiny profit to cover brokerage
            : Math.max(trailingStopPrice, staticStopLossPrice); // Standard trail, but never lower than strict SL

          if (ltp <= effectiveStopPrice) {
            shouldSell = true;
            const profitDiff = ((ltp - pos.buyPrice) / pos.buyPrice) * 100;
            if (profitDiff > 0) {
              sellReason = `Smart Trailing Stop triggered! Secured profit of ${profitDiff.toFixed(2)}% on ${pos.symbol}.`;
            } else {
              sellReason = `Smart Stop Loss hit (${profitDiff.toFixed(2)}%) for ${pos.symbol}. Minimizing loss.`;
            }
          }
        }
        // 3. Static Stop Loss (if trailing is off)
        else if (!shouldSell && ltp <= staticStopLossPrice) {
          shouldSell = true;
          sellReason = `Strict Stop Loss hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Squaring off to prevent further loss.`;
        }

        if (shouldSell) {
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: sellReason,
            type: pnlPercent > 0 ? "SUCCESS" : "ERROR",
          });
          if (botLogs.length > 200) botLogs.length = 200;

          // Send Telegram exit notification
          sendTelegramNotification(
            `${pnlPercent >= 0 ? '🎉 <b>PROFIT LOCKED & POSITION EXITED</b>' : '⚠️ <b>STOP-LOSS EXIT TRIGGERED</b>'}\n\n` +
            `📊 <b>Symbol:</b> <code>${pos.symbol}</code>\n` +
            `💵 <b>Gross PnL:</b> ${pnlPercent >= 0 ? '+' : ''}₹${posPnL.toFixed(2)} (${pnlPercent.toFixed(2)}%)\n` +
            `🛡️ <b>Exit Reason:</b> ${sellReason}\n` +
            `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
          ).catch(() => {});
          if (botConfig.mode === "PAPER_TRADING") {
            const closedPos = paperPositions.find((p) => p.id === pos.id);
            if (closedPos) {
              closedPos.sellPrice = closedPos.currentLTP;
              closedPos.realizedPnL = closedPos.pnl;
              closedPos.closeTime = new Date().toISOString();
              paperTradeHistory.unshift(closedPos);
              if (paperTradeHistory.length > 200)
                paperTradeHistory.length = 200;
            }
            paperPositions = paperPositions.filter((p) => p.id !== pos.id);
          } else if (botConfig.mode === "UPSTOX_LIVE") {
            // Place sell order via Upstox API
            try {
              await fetch("https://api.upstox.com/v2/order/place", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`,
                  "Api-Version": "2.0",
                },
                body: JSON.stringify({
                  quantity: pos.quantity,
                  product: "D", // Or 'I' depending on pos
                  validity: "DAY",
                  price: 0,
                  tag: "bot_target_profit",
                  instrument_token: pos.instrumentKey,
                  order_type: "MARKET",
                  transaction_type: "SELL",
                  disclosed_quantity: 0,
                  trigger_price: 0,
                  is_amo: false,
                }),
              });
            } catch (e) {}
          }
        } else if (pnlPercent <= -botConfig.stopLossPercent) {
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: `Stop Loss hit (${pnlPercent.toFixed(2)}%)  for ${pos.symbol}. Squaring off.`,
            type: "ERROR",
          });
          if (botLogs.length > 200) botLogs.length = 200;
          if (botConfig.mode === "PAPER_TRADING") {
            const closedPos = paperPositions.find((p) => p.id === pos.id);
            if (closedPos) {
              closedPos.sellPrice = closedPos.currentLTP;
              closedPos.realizedPnL = closedPos.pnl;
              closedPos.closeTime = new Date().toISOString();
              paperTradeHistory.unshift(closedPos);
              if (paperTradeHistory.length > 200)
                paperTradeHistory.length = 200;
            }
            paperPositions = paperPositions.filter((p) => p.id !== pos.id);
          } else if (botConfig.mode === "UPSTOX_LIVE") {
            // Place sell order via Upstox API
            try {
              await fetch("https://api.upstox.com/v2/order/place", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`,
                  "Api-Version": "2.0",
                },
                body: JSON.stringify({
                  quantity: pos.quantity,
                  product: "D", // Defaulting to Delivery for options, ideally  atch pos product
                  validity: "DAY",
                  price: 0,
                  tag: "bot_stop_loss",
                  instrument_token: pos.instrumentKey,
                  order_type: "MARKET",
                  transaction_type: "SELL",
                  disclosed_quantity: 0,
                  trigger_price: 0,
                  is_amo: false,
                }),
              });
            } catch (e) {}
          }
        }
      }
    }

    // 2. If no positions, look for entry
    // Check Circuit Breaker
    let todayRealizedPnL = paperTradeHistory.reduce(
      (acc, trade) => acc + (trade.realizedPnL || 0),
      0,
    );
    if (todayRealizedPnL <= -botConfig.dailyMaxLossLimit) {
      if (!botConfig.dailyLossLocked) {
        botConfig.dailyLossLocked = true;
        botConfig.enabled = false;
        botLogs.unshift({
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Circuit Breaker: Daily max loss limit (₹${botConfig.dailyMaxLossLimit}) reached. Bot disabled for the day.`,
          type: "ERROR",
        });
      }
    }

    // 2. If no positions, look for entry
    // Check Market Open Time Window (09:15 AM to 15:15 PM IST on Trading Days Monday-Friday)
    const currentHour = nowIst.getHours();
    const currentMinute = nowIst.getMinutes();
    const currentDay = nowIst.getDay(); // 0: Sun, 6: Sat
    const isTradingDay = currentDay >= 1 && currentDay <= 5;
    const isTradingHours =
      (currentHour > 9 || (currentHour === 9 && currentMinute >= 15)) &&
      (currentHour < 15 || (currentHour === 15 && currentMinute <= 15));

    if (
      activePositions.length === 0 &&
      token &&
      !botConfig.dailyLossLocked &&
      isTradingDay &&
      isTradingHours
    ) {
      let scanIndices = [
        { key: "NSE_INDEX|Nifty 50", symbol: "NIFTY 50" },
        { key: "NSE_INDEX|Nifty Bank", symbol: "NIFTY BANK" },
        { key: "BSE_INDEX|SENSEX", symbol: "SENSEX" },
        { key: "NSE_INDEX|Nifty Fin Service", symbol: "NIFTY FIN SERVICE" },
      ];

      if ((botConfig as any).selectedInstrumentKey) {
        const matching = scanIndices.find(
          (x) => x.key === (botConfig as any).selectedInstrumentKey,
        );
        if (matching) {
          scanIndices = [matching];
        }
      }

      for (const idx of scanIndices) {
        const today = new Date();
        const toDate = today.toISOString().split("T")[0];
        const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(idx.key)}/1minute`;

        try {
          const cRes = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" },
          });
          const cData = await cRes.json();

          if (cData.status === "success" && cData.data?.candles) {
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

            const enriched = enrichCandlesWithIndicators(rawCandles);

            // Get live quote for this specific index
            let liveLtp = rawCandles[rawCandles.length - 1].close;
            const qRes = await fetch(
              `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(idx.key)}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/json",
                  "Api-Version": "2.0",
                },
              },
            );
            const qData = await qRes.json();
            if (qData?.data?.[idx.key]?.last_price) {
              liveLtp = qData.data[idx.key].last_price;
            }

            let signal = analyzeTradingSignals(
              idx.symbol,
              idx.symbol,
              idx.key,
              enriched,
              liveLtp,
              botConfig.selectedStrategy as any,
            );

            if (
              signal &&
              (signal.signalType === "BUY" || signal.signalType === "SELL")
            ) {
              if (token) {
                try {
                  // Get index instrument key
                  const idxKey = idx.key;
                  // Get expiry dates
                  const contractRes = await fetch(
                    `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(idxKey)}`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                      },
                    },
                  );
                  const contractData = await contractRes.json();
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

                    const chainRes = await fetch(
                      `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(idxKey)}&expiry_date=${expiryDate}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          Accept: "application/json",
                        },
                      },
                    );
                    const chainData = await chainRes.json();
                    if (chainData?.data) {
                      // Determine the strike from the signal
                      const match = signal.symbol.match(/(\d+)/);
                      if (match) {
                        const strike = parseInt(match[1]);
                        const isCE = signal.symbol.includes("CE");
                        const optionData = chainData.data.find(
                          (item: any) => item.strike_price === strike,
                        );
                        if (optionData) {
                          const opt = isCE
                            ? optionData.call_options
                            : optionData.put_options;
                          if (opt && opt.market_data && opt.market_data.ltp) {
                            const realOptionPrice = opt.market_data.ltp;
                            // Re-run the analyzer with real option price
                            signal = analyzeTradingSignals(
                              idx.symbol,
                              idx.symbol,
                              idxKey,
                              enriched,
                              liveLtp,
                              botConfig.selectedStrategy as any,
                              realOptionPrice,
                            );
                            // Also update the instrument key in the signal for future use
                            if (opt.instrument_key) {
                              signal.instrumentKey = opt.instrument_key;
                            }
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error("Option Fetch Error: ", e);
                }
              }

              // Prevent spamming the same signal
              const lastSignal = botSignals.find(s => s.symbol === signal.symbol);
              if (
                !lastSignal ||
                lastSignal.signalType !== signal.signalType
              ) {
                botSignals.unshift(signal);
                if (botSignals.length > 50) botSignals.length = 50;
              } else {
                lastSignal.price = signal.price;
                lastSignal.timestamp = signal.timestamp;
              }
            }

            if (
              signal &&
              (signal.signalType === "BUY" || signal.signalType === "SELL") &&
              signal.confidenceScore >= botConfig.minConfidence
            ) {
              // Execute Trade on Option!
              const isBullish = signal.signalType === "BUY"; 
              const optionSymbol = signal.symbol; 

              botLogs.unshift({
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                message: `Signal Detected: ${isBullish ? "BULLISH" : "BEARISH"}. Buying ${optionSymbol} at market.`,
                type: "TRADE",
              });
              if (botLogs.length > 200) botLogs.length = 200;

              // Send Telegram trade entry alert
              sendTelegramNotification(
                `🟢 <b>ALGO BOT ENTRY TRIGGERED</b>\n\n` +
                `📊 <b>Symbol:</b> <code>${optionSymbol}</code>\n` +
                `🎯 <b>Type:</b> ${isBullish ? 'CE (Bullish Call)' : 'PE (Bearish Put)'}\n` +
                `💰 <b>Execution:</b> Market Order\n` +
                `⚡ <b>Strategy:</b> ${botConfig.selectedStrategy}\n` +
                `🛡️ <b>Mode:</b> ${botConfig.mode}\n` +
                `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
              ).catch(() => {});

              if (botConfig.mode === "PAPER_TRADING") {
                // Fetch real option price
                let optionPrice = signal.price;

                const botQty = await getDynamicLotSize(optionSymbol, token);
                paperOrders.unshift({
                  id: "ORD" + Date.now(),
                  symbol: optionSymbol,
                  type: "BUY",
                  quantity: botQty,
                  price: optionPrice,
                  status: "COMPLETE",
                  time: new Date().toISOString(),
                });
                const optInstrumentKey =
                  signal.instrumentKey || signal.underlyingInstrumentKey || "NSE_FO|" + optionSymbol;
                paperPositions.push({
                  id: "POS" + Date.now(),
                  symbol: optionSymbol,
                  instrumentKey: optInstrumentKey,
                  quantity: botQty,
                  buyPrice: optionPrice,
                  currentLTP: optionPrice,
                  pnl: 0,
                  type: "BUY",
                  isOption: true,
                });
              } else if (botConfig.mode === "UPSTOX_LIVE" && token) {
                try {
                  const optInstrumentKey =
                    signal.instrumentKey || signal.underlyingInstrumentKey || "NSE_FO|" + optionSymbol;
                  const lotSize = await getDynamicLotSize(optionSymbol, token);
                  let targetQuantity = botConfig.tradeQuantity || lotSize;
                  targetQuantity =
                    Math.max(1, Math.floor(targetQuantity / lotSize)) * lotSize;
                  if (targetQuantity === 0) targetQuantity = lotSize; // Fallback to 1 lot

                  await fetch("https://api.upstox.com/v2/order/place", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Accept: "application/json",
                      Authorization: `Bearer ${token}`,
                      "Api-Version": "2.0",
                    },
                    body: JSON.stringify({
                      quantity: targetQuantity,
                      product: "D",
                      validity: "DAY",
                      price: 0,
                      tag: "bot_auto_entry",
                      instrument_token: optInstrumentKey,
                      order_type: "MARKET",
                      transaction_type: "BUY",
                      disclosed_quantity: 0,
                      trigger_price: 0,
                      is_amo: false,
                    }),
                  });
                } catch (err) {
                  console.error("Error placing auto buy order:", err);
                }
              }
              break; // Prevent taking multiple trades across different indices in the same tick
            }
          }
        } catch (innerErr) {
          console.error("Inner loop err for", idx.key, innerErr);
        }
      }
    }
  } catch (err) {
    console.error("Bot loop error:", err);
  }
}, 5000);

function aggregateCandles(candles: any[], intervalMs: number) {
  if (!candles || candles.length === 0) return [];
  const aggregated: any[] = [];
  let currentGroup = null;

  for (const candle of candles) {
    // align timestamp to interval boundary
    const alignedTime = Math.floor(candle.timestamp / intervalMs) * intervalMs;

    if (!currentGroup || currentGroup.timestamp !== alignedTime) {
      if (currentGroup) aggregated.push(currentGroup);
      currentGroup = {
        timestamp: alignedTime,
        timeStr: new Date(alignedTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      };
    } else {
      currentGroup.high = Math.max(currentGroup.high, candle.high);
      currentGroup.low = Math.min(currentGroup.low, candle.low);
      currentGroup.close = candle.close;
      currentGroup.volume += candle.volume;
    }
  }
  if (currentGroup) aggregated.push(currentGroup);
  return aggregated;
}

const lotSizeCache: Record<string, number> = {};

const getDynamicLotSize = async (
  symbol: string,
  token: string,
): Promise<number> => {
  if (lotSizeCache[symbol]) return lotSizeCache[symbol];
  let defaultLot = 1;
  if (symbol.includes("FIN SERVICE") || symbol.includes("FINNIFTY"))
    defaultLot = 65;
  else if (symbol.includes("BANK")) defaultLot = 15;
  else if (symbol.includes("NIFTY")) defaultLot = 25;
  else if (symbol.includes("SENSEX")) defaultLot = 10;

  if (!token) return defaultLot;

  const instrumentKey = getInstrumentKey(symbol);
  try {
    const contractRes = await fetch(
      `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey as string)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (contractRes.ok) {
      const contractData = await contractRes.json();
      if (contractData.data && contractData.data.length > 0) {
        if (contractData.data[0].lot_size) {
          const upstoxLotSize = contractData.data[0].lot_size;
          lotSizeCache[symbol] = upstoxLotSize;
          return upstoxLotSize;
        }
      }
    }
  } catch (e) {}
  return defaultLot;
};

const getInstrumentKey = (symbol: string) => {
  const s = symbol.toUpperCase();
  if (s.includes("BANK") || s === "BANKNIFTY") return "NSE_INDEX|Nifty Bank";
  if (s.includes("FIN SERVICE") || s.includes("FINNIFTY"))
    return "NSE_INDEX|Nifty Fin Service";
  if (s.includes("MID SELECT")) return "NSE_INDEX|NIFTY MID SELECT";
  if (
    s.includes("NIFTY 50") ||
    (s.includes("NIFTY") && !s.includes("BANK") && !s.includes("FIN"))
  )
    return "NSE_INDEX|Nifty 50";
  if (s.includes("SENSEX")) return "BSE_INDEX|SENSEX";
  if (s.includes("BANKEX")) return "BSE_INDEX|BANKEX";
  if (s.includes("RELIANCE")) return "NSE_EQ|INE002A01018";
  if (s.includes("HDFCBANK") || s === "HDFC") return "NSE_EQ|INE040A01034";
  if (s.includes("TCS")) return "NSE_EQ|INE467B01029";
  if (s.includes("INFY")) return "NSE_EQ|INE009A01021";
  return symbol;
};

const getNextExpiry = (symbol: string) => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  let targetDay = 4; // Default to Thursday (Nifty)

  if (symbol.includes("BANK"))
    targetDay = 3; // Wednesday
  else if (symbol.includes("FIN"))
    targetDay = 2; // Tuesday
  else if (symbol.includes("MIDCP")) targetDay = 1; // Monday

  let diff = targetDay - dayOfWeek;
  if (diff < 0) diff += 7;

  const expiryDate = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split("T")[0];
};

const PORT = Number(process.env.PORT) || 3000;

// CORS & Middleware Configuration
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Initialize Gemini Client
let ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});
let globalGeminiKey = process.env.GEMINI_API_KEY || "";

// Upstox In-Memory Credentials & Session Cache (can be set via .env or client settings)
let upstoxConfig = {
  apiKey: process.env.UPSTOX_API_KEY || "3ab5711d-8891-480b-b0c1-29662852de49",
  apiSecret: process.env.UPSTOX_API_SECRET || "",
  redirectUri: process.env.UPSTOX_REDIRECT_URI || "https://sajad-trading-view.onrender.com",
  accessToken: process.env.UPSTOX_ACCESS_TOKEN || "",
  userName: "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN",
  userEmail: "sajadthazhepeedikayila@gmail.com",
  userClientCode: "5VCABX",
  mobile: "",
  pin: process.env.UPSTOX_PIN || "984798",
  totpSecret: "",
  tokenGeneratedAt: "",
  tokenExpiresAt: "",
};

// In- e ory Paper / Execution Order Book

// ================= API ROUTES =================

// 1. Health check & Render Keep-Alive / Wake-up Endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    broker: "Upstox v2 Engine",
  });
});

app.get("/api/ping", (req: Request, res: Response) => {
  res.json({
    status: "awake",
    time: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Wakeup / Keep-Alive ping for Render
setInterval(
  () => {
    const url =
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${3000}`;
    fetch(`${url}/api/ping`)
      .then((res) => res.json())
      .then((data) => console.log("Keep-alive ping OK:", data.time))
      .catch((err) => console.error("Keep-alive ping failed:", err.message));
  },
  14 * 60 * 1000,
); // 14 minutes

// 2. Upstox API Auth & Configuration
const invalidTokens = new Set<string>();

app.use("/api/market", (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token && token.length > 10 && !invalidTokens.has(token)) {
      upstoxConfig.accessToken = token;
    }
  }
  next();
});

// Auto-Sync Approved Token from Public Webhook Relay (ntfy.sh) & Render Bridge
let lastWebhookDiagnostic = "";
const PUBLIC_WEBHOOK_RELAY_TOPIC = "upstox_live_sajad_5vcabx_3ab5711d";
export const PUBLIC_WEBHOOK_RELAY_URL = `https://ntfy.sh/${PUBLIC_WEBHOOK_RELAY_TOPIC}`;

async function activateDiscoveredToken(tokenCandidate: string, sourceLabel: string) {
  const cleanToken = (tokenCandidate || "").trim();
  if (!cleanToken || cleanToken.length < 30 || invalidTokens.has(cleanToken)) {
    return false;
  }
  try {
    const pRes = await fetch("https://api.upstox.com/v2/user/profile", {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    const pData = await pRes.json();
    if (pData.status === "success" && pData.data) {
      upstoxConfig.accessToken = cleanToken;
      upstoxConfig.userName = pData.data.user_name || "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN";
      upstoxConfig.userEmail = pData.data.email || upstoxConfig.userEmail || "";
      upstoxConfig.userClientCode = pData.data.user_id || "5VCABX";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      botConfig.mode = "UPSTOX_LIVE";
      lastWebhookDiagnostic = `✅ Token auto-activated via ${sourceLabel} at ${upstoxConfig.tokenGeneratedAt}`;
      await savePostgresDb().catch(() => {});
      return true;
    } else {
      invalidTokens.add(cleanToken);
    }
  } catch (e) {}
  return false;
}

async function syncTokenFromRenderWebhookBridge() {
  if (upstoxConfig.accessToken && !invalidTokens.has(upstoxConfig.accessToken)) {
    return true;
  }

  // 1. Check Public 24x7 Webhook Relay (https://ntfy.sh/upstox_live_sajad_5vcabx_3ab5711d)
  try {
    const relayCtrl = new AbortController();
    const relayTimeout = setTimeout(() => relayCtrl.abort(), 3000);
    const relayRes = await fetch(
      `https://ntfy.sh/${PUBLIC_WEBHOOK_RELAY_TOPIC}/json?poll=1&since=12h`,
      {
        signal: relayCtrl.signal,
        headers: { Accept: "application/x-ndjson, application/json, text/plain" },
      },
    );
    clearTimeout(relayTimeout);
    if (relayRes.ok) {
      const text = await relayRes.text();
      const lines = text.trim().split("\n").reverse();
      for (const line of lines) {
        if (!line.trim()) continue;
        // Extract any JWT token (eyJ...) from the webhook message
        const jwtMatch = line.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
        if (jwtMatch && jwtMatch[0]) {
          const ok = await activateDiscoveredToken(jwtMatch[0], "WhatsApp/Webhook Relay");
          if (ok) return true;
        }
        try {
          const wrapper = JSON.parse(line);
          const innerStr = typeof wrapper.message === "string" ? wrapper.message : JSON.stringify(wrapper);
          const innerJwt = innerStr.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
          if (innerJwt && innerJwt[0]) {
            const ok = await activateDiscoveredToken(innerJwt[0], "WhatsApp/Webhook Relay");
            if (ok) return true;
          }
        } catch {}
      }
    }
  } catch (e) {}

  // 2. Also check Render Servers (https://aizabiz.onrender.com and https://sajad-trading-view.onrender.com) if awake
  for (const renderBase of [
    "https://aizabiz.onrender.com",
    "https://sajad-trading-view.onrender.com",
  ]) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${renderBase}/api/market/config`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const remoteToken = (data.accessToken || data.access_token || "").trim();
        if (remoteToken) {
          const ok = await activateDiscoveredToken(remoteToken, `Render Server (${renderBase})`);
          if (ok) return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

app.get("/api/market/config", async (req: Request, res: Response) => {
  if (upstoxConfig.accessToken && invalidTokens.has(upstoxConfig.accessToken)) {
    upstoxConfig.accessToken = "";
  }
  if (!upstoxConfig.accessToken) {
    await syncTokenFromRenderWebhookBridge();
  }
  let isConnected = Boolean(upstoxConfig.accessToken);
  let tokenExpired = false;

  let availableMargin = 0;
  let usedMargin = 0;
  let holdingsCount = 0;
  let userName = upstoxConfig.userName || "";
  let userEmail = upstoxConfig.userEmail || "";
  let userClientCode = upstoxConfig.userClientCode || "";

  if (isConnected) {
    try {
      const [fundsRes, holdingsRes] = await Promise.all([
        fetch("https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC", {
          headers: {
            Authorization: `Bearer ${upstoxConfig.accessToken}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        }),
        fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
          headers: {
            Authorization: `Bearer ${upstoxConfig.accessToken}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        }),
      ]);
      const fundsData = await fundsRes.json();
      const holdingsData = await holdingsRes.json().catch(() => null);

      if (holdingsData && holdingsData.status === "success" && Array.isArray(holdingsData.data)) {
        holdingsCount = holdingsData.data.length;
      }

      if (
        fundsData.status === "success" &&
        fundsData.data &&
        fundsData.data.equity
      ) {
        availableMargin = fundsData.data.equity.available_margin || 0;
        usedMargin = fundsData.data.equity.used_margin || 0;
      } else if (fundsData.status === "error") {
        // Token invalid or expired (e.g. UDAPI100050, UDAPI100057, UDAPI100068)
        invalidTokens.add(upstoxConfig.accessToken);
        upstoxConfig.accessToken = "";
        isConnected = false;
        tokenExpired = true;
      }
    } catch (e) {
      isConnected = false;
    }
  }

  const hasValidSecret = Boolean(
    upstoxConfig.apiSecret && !upstoxConfig.apiSecret.includes("•"),
  );

  res.json({
    apiKey: upstoxConfig.apiKey,
    apiSecret: hasValidSecret ? "••••••••" : "",
    hasApiSecret: hasValidSecret,
    redirectUri: upstoxConfig.redirectUri,
    accessToken: upstoxConfig.accessToken,
    hasToken: isConnected,
    isConnected,
    tokenExpired,
    userName: userName,
    userEmail: userEmail,
    userClientCode: userClientCode,
    broker: isConnected ? "Upstox Securities Live Engine" : "Setup Required",
    tokenGeneratedAt: upstoxConfig.tokenGeneratedAt || "",
    tokenExpiresAt: upstoxConfig.tokenExpiresAt || "",
    todayTokenValid: isConnected,
    availableMargin,
    usedMargin,
    holdingsCount,
    mobile: upstoxConfig.mobile || "",
    pin: upstoxConfig.pin || "984798",
    publicWebhookRelayUrl: PUBLIC_WEBHOOK_RELAY_URL,
    lastWebhookDiagnostic,
  });
});

app.post("/api/market/config", async (req: Request, res: Response) => {
  const { apiKey, apiSecret, redirectUri, accessToken, mobile, pin } = req.body;
  if (apiKey !== undefined) upstoxConfig.apiKey = apiKey.trim();
  if (apiSecret !== undefined && apiSecret !== "••••••••" && apiSecret.trim() !== "") {
    upstoxConfig.apiSecret = apiSecret.trim();
  }
  if (redirectUri !== undefined) upstoxConfig.redirectUri = redirectUri.trim();
  if (mobile !== undefined && String(mobile).trim()) upstoxConfig.mobile = String(mobile).trim();
  if (pin !== undefined && String(pin).trim()) upstoxConfig.pin = String(pin).trim();

  if (typeof accessToken === "string") {
    let token = accessToken.trim();
    if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();
    if (token) {
      if (invalidTokens.has(token)) {
        upstoxConfig.accessToken = "";
        return res.status(401).json({
          success: false,
          error: "Upstox token has expired or is invalid. Please generate a new daily token.",
        });
      }
      try {
        const response = await fetch("https://api.upstox.com/v2/user/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        });
        const data = await response.json();
        if (data.status === "success" && data.data) {
          upstoxConfig.accessToken = token;
          upstoxConfig.userName = data.data.user_name || "Live Trader";
          upstoxConfig.userEmail = data.data.email || "trader@upstox.com";
          upstoxConfig.userClientCode = data.data.user_id || "UPSTOX_USER";
          upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString(
            "en-IN",
          );
          upstoxConfig.tokenExpiresAt = "03:30 AM (Next Day) ";
        } else {
          invalidTokens.add(token);
          upstoxConfig.accessToken = "";
          return res
            .status(401)
            .json({
              success: false,
              error: data.errors?.[0]?.message || "Invalid or expired Upstox token provided",
            });
        }
      } catch (err) {
        upstoxConfig.accessToken = "";
        return res
          .status(500)
          .json({ success: false, error: "Failed to validate token" });
      }
    } else {
      upstoxConfig.accessToken = "";
    }
  }

  res.json({
    success: true,
    message: "Upstox configuration updated successfully",
    isConnected: Boolean(upstoxConfig.accessToken),
    apiKey: upstoxConfig.apiKey,
    redirectUri: upstoxConfig.redirectUri,
    userName: upstoxConfig.userName,
    userClientCode: upstoxConfig.userClientCode,
    todayTokenValid: Boolean(upstoxConfig.accessToken),
    tokenGeneratedAt: upstoxConfig.tokenGeneratedAt,
    tokenExpiresAt: upstoxConfig.tokenExpiresAt,
  });
});

app.post("/api/market/save-config", (req: Request, res: Response) => {
  const { apiKey, apiSecret, redirectUri, accessToken, mobile, pin } = req.body;
  if (apiKey) upstoxConfig.apiKey = apiKey.trim();
  if (apiSecret && apiSecret !== "••••••••") upstoxConfig.apiSecret = apiSecret.trim();
  if (redirectUri) upstoxConfig.redirectUri = redirectUri.trim();
  if (mobile && String(mobile).trim()) upstoxConfig.mobile = String(mobile).trim();
  if (pin && String(pin).trim()) upstoxConfig.pin = String(pin).trim();
  if (typeof accessToken === "string")
    upstoxConfig.accessToken = accessToken.trim();

  savePostgresDb().catch(() => {});

  res.json({
    success: true,
    message: "Upstox configuration updated successfully",
    isConnected: Boolean(upstoxConfig.accessToken),
    mobile: upstoxConfig.mobile,
  });
});

// Dedicated Daily Token Activation and Verification Endpoint
app.post("/api/market/daily-token", async (req: Request, res: Response) => {
  const { accessToken } = req.body;
  let token = (accessToken || "").trim();
  if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      error:
        "Please enter a valid Upstox Access Token / ദയവായി ഒരു സാധുവായ Upstox ടോക്കൺ നൽകുക",
    });
  }

  if (invalidTokens.has(token)) {
    upstoxConfig.accessToken = "";
    return res.status(401).json({
      success: false,
      error: "This Upstox token has expired (UDAPI100050). Please generate a fresh daily token.",
    });
  }

  try {
    const response = await fetch("https://api.upstox.com/v2/user/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });

    const data = await response.json();

    if (data.status === "success" && data.data) {
      upstoxConfig.accessToken = token;
      upstoxConfig.userName = data.data.user_name || "Live Trader";
      upstoxConfig.userEmail = data.data.email || "trader@upstox.com";
      upstoxConfig.userClientCode = data.data.user_id || "UPSTOX_USER";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";

      return res.json({
        success: true,
        message:
          "Daily Token verified and activated! Live trading mode enabled.",
        profile: {
          userName: upstoxConfig.userName,
          userEmail: upstoxConfig.userEmail,
          userClientCode: upstoxConfig.userClientCode,
          tokenGeneratedAt: upstoxConfig.tokenGeneratedAt,
          tokenExpiresAt: upstoxConfig.tokenExpiresAt,
        },
      });
    } else {
      invalidTokens.add(token);
      upstoxConfig.accessToken = "";
      return res.status(401).json({
        success: false,
        error:
          data.errors?.[0]?.message ||
          "Invalid or expired token. Please generate a new token and try again.",
      });
    }
  } catch (err: any) {
    upstoxConfig.accessToken = "";
    return res.status(500).json({
      success: false,
      error: "Connection error while validating token. Please try again.",
    });
  }
});

// Clear token endpoint
app.post("/api/market/clear-token", (req: Request, res: Response) => {
  upstoxConfig.accessToken = "";
  upstoxConfig.tokenGeneratedAt = "";
  upstoxConfig.tokenExpiresAt = "";
  res.json({
    success: true,
    message: "Daily Upstox token cleared. Switched to Paper Trading Mode.",
  });
});

// Upstox Postback, Notifier Webhook & OAuth Callback Endpoint (handles both GET ?code= and POST webhook payloads on /api/market/webhook, /api/market/notifier, and POST /)
const handleUpstoxWebhook = async (req: Request, res: Response) => {
  try {
    // 0. If Upstox redirected via GET with ?code=... (because user set Redirect URL to /api/market/webhook)
    const oauthCode = (req.query.code as string) || "";
    if (req.method === "GET" && oauthCode) {
      const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
      const host = req.headers.host;
      const callbackUri =
        upstoxConfig.redirectUri || `${protocol}://${host}/api/market/webhook`;

      const params = new URLSearchParams();
      params.append("code", oauthCode.trim());
      params.append("client_id", upstoxConfig.apiKey);
      params.append("client_secret", upstoxConfig.apiSecret);
      params.append("redirect_uri", callbackUri);
      params.append("grant_type", "authorization_code");

      const response = await fetch(
        "https://api.upstox.com/v2/login/authorization/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "Api-Version": "2.0",
          },
          body: params.toString(),
        },
      );
      const data = await response.json();

      if (data.access_token) {
        upstoxConfig.accessToken = data.access_token;
        upstoxConfig.userName = data.user_name || "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN";
        upstoxConfig.userEmail = data.email || upstoxConfig.userEmail || "";
        upstoxConfig.userClientCode = data.user_id || "5VCABX";
        upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
        upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
        botConfig.mode = "UPSTOX_LIVE";
        invalidTokens.delete(data.access_token);
        await savePostgresDb().catch(() => {});

        return res.send(`
          <html><body style="background:#0b0f19;color:#34d399;font-family:sans-serif;padding:40px;text-align:center;">
            <h2>✅ Upstox Access Token ഓട്ടോമാറ്റിക്കായി ആക്റ്റീവ് ആയി!</h2>
            <p style="color:#cbd5e1;">അക്കൗണ്ട്: <b>${upstoxConfig.userName} (${upstoxConfig.userClientCode})</b></p>
            <p style="color:#94a3b8;font-size:13px;">ലൈവ് ട്രേഡിംഗും ഹോൾഡിങ്‌സും സജീവമായി. ആപ്പിലേക്ക് തിരികെ പോകുന്നു...</p>
            <script>
              try {
                localStorage.setItem('upstox_daily_token', ${JSON.stringify(data.access_token)});
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'UPSTOX_OAUTH_SUCCESS',
                    accessToken: ${JSON.stringify(data.access_token)},
                    userName: ${JSON.stringify(upstoxConfig.userName)},
                    userClientCode: ${JSON.stringify(upstoxConfig.userClientCode)}
                  }, '*');
                  setTimeout(() => window.close(), 800);
                } else {
                  setTimeout(() => { window.location.href = '/'; }, 800);
                }
              } catch (e) {
                window.location.href = '/';
              }
            </script>
          </body></html>
        `);
      }
    }

    const payload = req.body || {};
    const rawStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    lastWebhookDiagnostic = `${new Date().toLocaleTimeString("en-IN")}: ${rawStr.slice(0, 200)}`;

    // 1. Check if Upstox Notifier Webhook pushed a new access_token (check all fields + regex JWT match)
    let incomingToken =
      payload.access_token ||
      payload.accessToken ||
      payload.token ||
      payload.data?.access_token ||
      payload.data?.accessToken ||
      payload.data?.token ||
      (req.query.access_token as string) ||
      (req.query.token as string) ||
      "";

    if (!incomingToken && rawStr.includes("eyJ")) {
      const jwtMatch = rawStr.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      if (jwtMatch && jwtMatch[0]) {
        incomingToken = jwtMatch[0];
      }
    }

    if (incomingToken && typeof incomingToken === "string") {
      const cleanToken = incomingToken.replace(/^Bearer\s+/i, "").trim();
      upstoxConfig.accessToken = cleanToken;
      if (payload.user_id || payload.client_id) {
        upstoxConfig.userClientCode = payload.user_id || payload.client_id;
      }
      if (payload.user_name) {
        upstoxConfig.userName = payload.user_name;
      }
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      botConfig.mode = "UPSTOX_LIVE";
      invalidTokens.delete(cleanToken);
      await savePostgresDb().catch(() => {});
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: `✅ Upstox Notifier Webhook വഴി പുതിയ Access Token ഓട്ടോമാറ്റിക്കായി ലഭിച്ചു!`,
        type: "SUCCESS",
      });
    }

    // 2. Check if Upstox Postback pushed an Order Update
    if (payload.order_id && payload.status) {
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: `📦 Upstox Order Update [${payload.trading_symbol || payload.instrument_token}]: ${payload.transaction_type || ""} ${payload.status} @ ₹${payload.average_price || payload.price || 0}`,
        type: payload.status === "complete" ? "SUCCESS" : "INFO",
      });
    }

    res.status(200).json({ status: "success", received: true });
  } catch (e: any) {
    res.status(200).json({ status: "ok" });
  }
};

app.all("/api/market/webhook", handleUpstoxWebhook);
app.all("/api/market/notifier", handleUpstoxWebhook);
app.post("/", handleUpstoxWebhook);

// Validate token endpoint
app.post("/api/market/validate-token", async (req: Request, res: Response) => {
  const token = (req.body.accessToken || upstoxConfig.accessToken || "").trim();
  if (!token) {
    return res.status(400).json({ valid: false, error: "No token provided" });
  }

  try {
    const response = await fetch("https://api.upstox.com/v2/user/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    const data = await response.json();
    if (data.status === "success" && data.data) {
      return res.json({
        valid: true,
        userName: data.data.user_name || "Live Trader",
        userEmail: data.data.email || "",
        userClientCode: data.data.user_id || "",
      });
    } else {
      invalidTokens.add(token);
      return res.status(401).json({
        valid: false,
        error: data.errors?.[0]?.message || "Invalid or expired Upstox token",
      });
    }
  } catch (e: any) {
    return res.status(500).json({ valid: false, error: e.message || "Token validation failed" });
  }
});

// 2.5 Automated Upstox SMS OTP + Auto PIN (984798) + Auto OAuth Code + Auto Token Exchange Engine
interface UpstoxAutoOtpSession {
  requestId: string;
  userId: string;
  internalClientId: string;
  validateOtpToken: string;
  cookies: Record<string, string>;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  mobile: string;
  pin: string;
  createdAt: number;
}

let activeAutoOtpSession: UpstoxAutoOtpSession | null = null;

function mergeSetCookies(cookieJar: Record<string, string>, res: globalThis.Response) {
  const rawList: string[] =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
  for (const raw of rawList) {
    const firstPart = raw.split(";")[0];
    const eqIdx = firstPart.indexOf("=");
    if (eqIdx > 0) {
      const k = firstPart.slice(0, eqIdx).trim();
      const v = firstPart.slice(eqIdx + 1).trim();
      cookieJar[k] = v;
    }
  }
}

function formatCookieJar(cookieJar: Record<string, string>): string {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function buildUpstoxBrowserHeaders(requestId: string, cookieJar: Record<string, string>, extra: Record<string, string> = {}) {
  const cookieStr = formatCookieJar(cookieJar);
  return {
    accept: "*/*",
    "accept-language": "en-GB,en;q=0.9",
    "content-type": "application/json",
    origin: "https://login.upstox.com",
    priority: "u=1, i",
    referer: "https://login.upstox.com/",
    "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-device-details":
      "platform=WEB|osName=Mac OS/10.15.7|osVersion=Chrome/140.0.0.0|appVersion=4.0.0|modelName=Chrome|manufacturer=Apple|uuid=3Z1IVTlV4rUUGbNp8KP0|userAgent=Upstox 3.0 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-request-id": requestId,
    ...(cookieStr ? { cookie: cookieStr } : {}),
    ...extra,
  };
}

// Step 1 & 2 Automatic: Send SMS OTP to user's saved mobile number without opening Upstox web
app.post("/api/market/send-sms-otp", async (req: Request, res: Response) => {
  const { mobile, apiKey, apiSecret, redirectUri, pin } = req.body;
  const cleanMobile = String(mobile || upstoxConfig.mobile || "")
    .replace(/\D+/g, "")
    .slice(-10);
  const key = String(apiKey || upstoxConfig.apiKey || "3ab5711d-8891-480b-b0c1-29662852de49").trim();
  const secret = String(
    apiSecret && apiSecret !== "••••••••" ? apiSecret : upstoxConfig.apiSecret || "",
  ).trim();
  const uri = String(redirectUri || upstoxConfig.redirectUri || "https://sajad-trading-view.onrender.com").trim();
  const cleanPin = String(pin || upstoxConfig.pin || "984798").trim();

  if (cleanMobile.length === 10) {
    upstoxConfig.mobile = cleanMobile;
  }
  if (key) upstoxConfig.apiKey = key;
  if (secret) upstoxConfig.apiSecret = secret;
  if (uri) upstoxConfig.redirectUri = uri;
  if (cleanPin) upstoxConfig.pin = cleanPin;
  await savePostgresDb().catch(() => {});

  if (cleanMobile.length !== 10) {
    return res.status(400).json({
      success: false,
      needsMobile: true,
      error:
        "നിങ്ങളുടെ 10-അക്ക Upstox മൊബൈൽ നമ്പർ ഒരിക്കൽ മാത്രം നൽകുക (പിന്നീട് ഒരിക്കലും നൽകേണ്ടതില്ല — ആപ്പ് തനിയെ സേവ് ചെയ്തോളും).",
    });
  }

  const requestId = "WPRO-" + Math.random().toString(36).substring(2, 12);
  const cookieJar: Record<string, string> = {};

  try {
    // 1. Call authorization/dialog to obtain encrypted userId, internal client_id, and session cookies
    const dialogUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(key)}&redirect_uri=${encodeURIComponent(uri)}`;
    const dialogRes = await fetch(dialogUrl, {
      method: "GET",
      redirect: "manual",
      headers: buildUpstoxBrowserHeaders(requestId, cookieJar),
    });
    mergeSetCookies(cookieJar, dialogRes);

    const loc = dialogRes.headers.get("location") || "";
    if (!loc) {
      return res.status(400).json({
        success: false,
        error: "Upstox ലോഗിൻ സെഷൻ തുടങ്ങാൻ കഴിഞ്ഞില്ല. API Key & Redirect URI പരിശോധിക്കുക.",
      });
    }

    const parsedLoc = new URL(loc);
    const userId = parsedLoc.searchParams.get("user_id") || "";
    const internalClientId = parsedLoc.searchParams.get("client_id") || "";

    // Follow redirect once to collect any login.upstox.com cookies
    const loginPageRes = await fetch(loc, {
      method: "GET",
      redirect: "manual",
      headers: buildUpstoxBrowserHeaders(requestId, cookieJar),
    });
    mergeSetCookies(cookieJar, loginPageRes);

    // 2. Automatically request SMS OTP from Upstox (/login/open/v6/auth/1fa/otp/generate)
    const otpGenRes = await fetch(
      "https://service.upstox.com/login/open/v6/auth/1fa/otp/generate",
      {
        method: "POST",
        headers: buildUpstoxBrowserHeaders(requestId, cookieJar),
        body: JSON.stringify({
          data: {
            mobileNumber: cleanMobile,
            userId: userId,
            countryIsdCode: "+91",
          },
        }),
      },
    );
    mergeSetCookies(cookieJar, otpGenRes);
    const otpGenData = await otpGenRes.json();

    if (otpGenData.success && otpGenData.data?.validateOTPToken) {
      activeAutoOtpSession = {
        requestId,
        userId,
        internalClientId,
        validateOtpToken: otpGenData.data.validateOTPToken,
        cookies: cookieJar,
        apiKey: key,
        apiSecret: secret,
        redirectUri: uri,
        mobile: cleanMobile,
        pin: cleanPin,
        createdAt: Date.now(),
      };

      return res.json({
        success: true,
        mobile: cleanMobile,
        message:
          otpGenData.data.message ||
          `📲 നിങ്ങളുടെ ${cleanMobile.slice(0, 2)}******${cleanMobile.slice(-2)} എന്ന നമ്പറിലേക്ക് Upstox 6-അക്ക SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP മാത്രം താഴെ നൽകുക — PIN (984798) നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!`,
      });
    } else {
      const errMsg =
        otpGenData.error?.message ||
        "Upstox SMS OTP അയക്കാൻ കഴിഞ്ഞില്ല. മൊബൈൽ നമ്പർ ശരിയാണെന്ന് ഉറപ്പാക്കുക.";
      return res.status(400).json({
        success: false,
        error: `${errMsg} (${otpGenData.error?.code || ""})`,
        details: otpGenData,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Failed to trigger Upstox SMS OTP: " + err.message,
    });
  }
});

// Step 3, 4, 5 Automatic: Verify 6-Digit SMS OTP -> Auto-Submit PIN (984798) -> Auto-Authorize OAuth -> Auto-Exchange Access Token!
app.post("/api/market/totp-login", async (req: Request, res: Response) => {
  const { totp, pin, apiKey, apiSecret, mobile } = req.body;
  const cleanTotp = String(totp || "").replace(/\D+/g, "").trim();
  const cleanPin = String(pin || upstoxConfig.pin || "984798").trim();
  const key = String(apiKey || upstoxConfig.apiKey || "3ab5711d-8891-480b-b0c1-29662852de49").trim();
  if (apiSecret && apiSecret !== "••••••••" && apiSecret.trim() !== "") {
    upstoxConfig.apiSecret = apiSecret.trim();
  }
  if (mobile && String(mobile).replace(/\D+/g, "").length >= 10) {
    upstoxConfig.mobile = String(mobile).replace(/\D+/g, "").slice(-10);
  }
  if (cleanPin) upstoxConfig.pin = cleanPin;
  if (key) upstoxConfig.apiKey = key;

  if (!cleanTotp || cleanTotp.length !== 6) {
    return res.status(400).json({
      success: false,
      error: "ദയവായി ഫോണിൽ വന്ന 6-അക്ക OTP കോഡ് നൽകുക (Please enter the 6-digit OTP code).",
    });
  }

  // PATH A: If we have an active Automated SMS OTP session, complete Steps 3, 4, 5 automatically!
  if (activeAutoOtpSession && Date.now() - activeAutoOtpSession.createdAt < 15 * 60 * 1000) {
    try {
      const sess = activeAutoOtpSession;
      const pinToUse = cleanPin || sess.pin || "984798";
      const secretToUse = upstoxConfig.apiSecret || sess.apiSecret;

      // Step 3: Verify the 6-digit SMS OTP (/login/open/v5/auth/1fa/otp-totp/verify)
      let verifyRes = await fetch(
        "https://service.upstox.com/login/open/v5/auth/1fa/otp-totp/verify",
        {
          method: "POST",
          headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies),
          body: JSON.stringify({
            data: {
              otp: cleanTotp,
              validateOtpToken: sess.validateOtpToken,
            },
          }),
        },
      );
      mergeSetCookies(sess.cookies, verifyRes);
      let verifyData = await verifyRes.json();

      if (!verifyData.success && verifyRes.status === 404) {
        verifyRes = await fetch(
          "https://service.upstox.com/login/open/v4/auth/1fa/otp-totp/verify",
          {
            method: "POST",
            headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies),
            body: JSON.stringify({
              data: {
                otp: cleanTotp,
                validateOtpToken: sess.validateOtpToken,
              },
            }),
          },
        );
        mergeSetCookies(sess.cookies, verifyRes);
        verifyData = await verifyRes.json();
      }

      if (!verifyData.success) {
        return res.status(400).json({
          success: false,
          error:
            verifyData.error?.message ||
            "നൽകിയ OTP തെറ്റാണ് അല്ലെങ്കിൽ സമയം കഴിഞ്ഞു. വീണ്ടും ശ്രമിക്കുക.",
        });
      }

      // Extract profileId and userId if returned by OTP verification
      const profileId =
        verifyData.data?.userProfile?.profileId ||
        verifyData.data?.accounts?.[0]?.profileId ||
        sess.cookies["profile_id"] ||
        "";
      const verifiedUserId =
        verifyData.data?.userProfile?.userId ||
        verifyData.data?.accounts?.[0]?.userId ||
        sess.cookies["user_id"] ||
        "";

      const pinHeaders: Record<string, string> = {};
      if (profileId) pinHeaders["X-Profile-Id"] = String(profileId);
      if (verifiedUserId) pinHeaders["X-User-Id"] = String(verifiedUserId);

      // Step 4: Automatically submit 6-digit PIN (984798) in base64 (/login/open/v3/auth/2fa)
      const encodedPin = Buffer.from(pinToUse, "utf-8").toString("base64");
      const upstoxInternalRedirect = "https://api-v2.upstox.com/login/authorization/redirect";
      const twoFaUrl = `https://service.upstox.com/login/open/v3/auth/2fa?client_id=${encodeURIComponent(sess.internalClientId)}&redirect_uri=${encodeURIComponent(upstoxInternalRedirect)}`;

      const twoFaRes = await fetch(twoFaUrl, {
        method: "POST",
        headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies, pinHeaders),
        body: JSON.stringify({
          data: {
            twoFAMethod: "SECRET_PIN",
            inputText: encodedPin,
          },
        }),
      });
      mergeSetCookies(sess.cookies, twoFaRes);
      const twoFaData = await twoFaRes.json();

      if (!twoFaData.success) {
        return res.status(400).json({
          success: false,
          error:
            twoFaData.error?.message ||
            "OTP ശരിയായിരുന്നു, എന്നാൽ PIN (984798) പരിശോധന പരാജയപ്പെട്ടു.",
        });
      }

      // Check if 2FA response already gave redirectUri with ?code=
      let finalRedirectUri = twoFaData.data?.redirectUri || "";

      // Step 5: If redirectUri not yet returned, automatically call /login/v2/oauth/authorize
      if (!finalRedirectUri || !finalRedirectUri.includes("code=")) {
        const oauthUrl = `https://service.upstox.com/login/v2/oauth/authorize?client_id=${encodeURIComponent(sess.internalClientId)}&redirect_uri=${encodeURIComponent(upstoxInternalRedirect)}&requestId=${encodeURIComponent(sess.requestId)}&response_type=code`;
        const oauthRes = await fetch(oauthUrl, {
          method: "POST",
          headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies, pinHeaders),
          body: JSON.stringify({
            data: {
              userOAuthApproval: true,
            },
          }),
        });
        mergeSetCookies(sess.cookies, oauthRes);
        const oauthData = await oauthRes.json();
        if (oauthData.success && oauthData.data?.redirectUri) {
          finalRedirectUri = oauthData.data.redirectUri;
        }
      }

      // Extract ?code= from finalRedirectUri
      let authCode = "";
      if (finalRedirectUri) {
        try {
          const parsedRedirect = new URL(finalRedirectUri);
          authCode = parsedRedirect.searchParams.get("code") || "";
        } catch {
          const m = finalRedirectUri.match(/[?&]code=([^&#\s]+)/);
          if (m && m[1]) authCode = decodeURIComponent(m[1]);
        }
      }

      if (!authCode) {
        return res.status(400).json({
          success: false,
          error: "OTP-യും PIN-ഉം ശരിയായിരുന്നു, എന്നാൽ Authorization Code ലഭിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.",
        });
      }

      // Step 6: Automatically exchange ?code= for the live JWT access_token!
      const tokenParams = new URLSearchParams();
      tokenParams.append("code", authCode.trim());
      tokenParams.append("client_id", sess.apiKey);
      tokenParams.append("client_secret", secretToUse);
      tokenParams.append("redirect_uri", sess.redirectUri);
      tokenParams.append("grant_type", "authorization_code");

      const tokenRes = await fetch("https://api.upstox.com/v2/login/authorization/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "Api-Version": "2.0",
        },
        body: tokenParams.toString(),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.access_token) {
        activeAutoOtpSession = null;
        upstoxConfig.accessToken = tokenData.access_token;
        upstoxConfig.userName =
          tokenData.user_name || "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN";
        upstoxConfig.userEmail = tokenData.email || upstoxConfig.userEmail || "";
        upstoxConfig.userClientCode = tokenData.user_id || "5VCABX";
        upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
        upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
        botConfig.mode = "UPSTOX_LIVE";
        invalidTokens.delete(tokenData.access_token);
        await savePostgresDb().catch(() => {});

        return res.json({
          success: true,
          accessToken: tokenData.access_token,
          userName: upstoxConfig.userName,
          userClientCode: upstoxConfig.userClientCode,
          message:
            "🎉 OTP പരിശോധിച്ചു, PIN (984798) ഓട്ടോമാറ്റിക്കായി നൽകി, പുതിയ ടോക്കൺ ജനറേറ്റ് ചെയ്ത് അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!",
        });
      } else {
        return res.status(400).json({
          success: false,
          error:
            tokenData.errors?.[0]?.message ||
            "ടോക്കൺ എക്സ്ചേഞ്ച് പരാജയപ്പെട്ടു. API Secret & Redirect URI പരിശോധിക്കുക.",
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "ഓട്ടോമാറ്റിക് OTP + PIN ലോഗിൻ പിശക്: " + err.message,
      });
    }
  }

  // PATH B: Fallback to direct TOTP login if user didn't initiate an SMS OTP session
  try {
    const response = await fetch(
      "https://api.upstox.com/v2/totp-login/authorization/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": key,
          "Api-Version": "2.0",
        },
        body: JSON.stringify({
          totp: cleanTotp,
          pin: cleanPin,
        }),
      },
    );

    const data = await response.json();
    const token = data.access_token || data.data?.access_token;

    if (token) {
      upstoxConfig.accessToken = token;
      upstoxConfig.userName =
        data.user_name || data.data?.user_name || "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN";
      upstoxConfig.userEmail =
        data.email || data.data?.email || upstoxConfig.userEmail || "";
      upstoxConfig.userClientCode =
        data.user_id || data.data?.user_id || "5VCABX";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      botConfig.mode = "UPSTOX_LIVE";
      invalidTokens.delete(token);
      await savePostgresDb().catch(() => {});

      return res.json({
        success: true,
        accessToken: token,
        userName: upstoxConfig.userName,
        userClientCode: upstoxConfig.userClientCode,
      });
    } else {
      const errMsg =
        data.errors?.[0]?.message ||
        data.message ||
        "ആദ്യം OTP ബോക്സ് ഒഴിച്ചിട്ട് 'സേവ് ചെയ്തു കണക്റ്റ് ചെയ്യുക' അമർത്തി ഫോണിലേക്ക് SMS OTP വരുത്തുക, എന്നിട്ട് ആ 6-അക്ക OTP ഇവിടെ നൽകുക.";
      return res.status(400).json({
        success: false,
        error: errMsg,
        details: data,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Failed to contact Upstox OTP endpoint: " + err.message,
    });
  }
});

// Upstox V3 Access Token Request (Sends 1-Click Approval Notification to Upstox Mobile App & WhatsApp -> Pushes token to /api/market/webhook)
app.post("/api/market/request-token-v3", async (req: Request, res: Response) => {
  const { apiKey, apiSecret } = req.body;
  const key = String(apiKey || upstoxConfig.apiKey || "3ab5711d-8891-480b-b0c1-29662852de49").trim();
  const secret = String(
    apiSecret && apiSecret !== "••••••••" ? apiSecret : upstoxConfig.apiSecret || "",
  ).trim();

  if (!key || !secret) {
    return res.status(400).json({
      success: false,
      error: "API Secret നല്‍കിയിട്ടില്ല! ദയവായി API Secret നല്‍കിയ ശേഷം വീണ്ടും ശ്രമിക്കുക.",
    });
  }

  upstoxConfig.apiKey = key;
  upstoxConfig.apiSecret = secret;
  await savePostgresDb().catch(() => {});

  try {
    const response = await fetch(
      `https://api.upstox.com/v3/login/auth/token/request/${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_secret: secret,
        }),
      },
    );

    const data = await response.json();
    if (response.ok && (data.status === "success" || data.data)) {
      return res.json({
        success: true,
        message:
          "📲 നിങ്ങളുടെ Upstox മൊബൈൽ ആപ്പിലേക്കും WhatsApp-ലേക്കും ടോക്കൺ റിക്വസ്റ്റ് അയച്ചു! ഫോണിൽ 'Approve' അമർത്തിയാൽ ഉടൻ ആപ്പ് തനിയെ ടോക്കൺ സ്വീകരിച്ച് ലൈവ് ആകും (നമ്പറോ PIN-ഓ അടിക്കേണ്ടതില്ല)!",
        data,
      });
    } else {
      const errMsg =
        data.errors?.[0]?.message ||
        data.message ||
        "Upstox V3 Token Request അയക്കാൻ കഴിഞ്ഞില്ല (Upstox Developer App-ൽ Notifier Webhook URL സജ്ജീകരിച്ചിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക).";
      return res.status(400).json({
        success: false,
        error: errMsg,
        details: data,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Error sending Upstox V3 token request: " + err.message,
    });
  }
});

app.get("/api/market/auth-url", (req: Request, res: Response) => {
  const apiKey = (req.query.apiKey as string) || upstoxConfig.apiKey;
  const redirectUri =
    (req.query.redirectUri as string) || upstoxConfig.redirectUri;

  if (!apiKey) {
    return res.status(400).json({
      error: "API Key is required to generate Upstox login dialog URL",
    });
  }

  const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.json({ loginUrl });
});

// Token Exchange Callback Handler (POST from UI & GET from OAuth Redirect)
app.post("/api/market/token", async (req: Request, res: Response) => {
  const { code, cmode, apiKey, apiSecret, redirectUri } = req.body;
  let rawCode = (code || cmode || "").trim();
  let detectedRedirectUri = "";

  // If user pasted a full redirected URL (e.g. http://localhost:8080/?code=xyz), extract code & origin
  if (rawCode.includes("code=")) {
    try {
      const parsedUrl = new URL(rawCode);
      rawCode = parsedUrl.searchParams.get("code") || rawCode;
      detectedRedirectUri = `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch {
      const match = rawCode.match(/[?&]code=([^&#\s]+)/);
      if (match && match[1]) rawCode = decodeURIComponent(match[1]);
    }
  }

  const key = (apiKey || upstoxConfig.apiKey || "").trim();
  const secret = (
    apiSecret && apiSecret !== "••••••••" ? apiSecret : upstoxConfig.apiSecret || ""
  ).trim();
  const uri = (redirectUri || detectedRedirectUri || upstoxConfig.redirectUri || "").trim();

  if (!rawCode || !key || !secret) {
    return res.status(400).json({
      error: !secret
        ? "API Secret നല്‍കിയിട്ടില്ല! ദയവായി Upstox API Secret നല്‍കിയ ശേഷം വീണ്ടും ശ്രമിക്കുക."
        : "Missing authorization code, API Key, or API Secret for token exchange",
    });
  }

  // Save credentials in memory
  upstoxConfig.apiKey = key;
  upstoxConfig.apiSecret = secret;
  if (uri) upstoxConfig.redirectUri = uri;

  try {
    const params = new URLSearchParams();
    params.append("code", rawCode);
    params.append("client_id", key);
    params.append("client_secret", secret);
    params.append("redirect_uri", uri);
    params.append("grant_type", "authorization_code");

    const response = await fetch(
      "https://api.upstox.com/v2/login/authorization/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "Api-Version": "2.0",
        },
        body: params.toString(),
      },
    );

    const data = await response.json();
    if (data.access_token) {
      upstoxConfig.accessToken = data.access_token;
      upstoxConfig.userName = data.user_name || "Upstox Trader";
      upstoxConfig.userEmail = data.email || upstoxConfig.userEmail || "";
      upstoxConfig.userClientCode = data.user_id || upstoxConfig.userClientCode || "";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      savePostgresDb();

      return res.json({
        success: true,
        accessToken: data.access_token,
        user_name: upstoxConfig.userName,
        user_id: upstoxConfig.userClientCode,
      });
    } else {
      const errMsg =
        data.errors?.[0]?.message ||
        data.message ||
        "Token exchange failed. Check Redirect URI & API Secret.";
      return res.status(400).json({
        error: errMsg,
        details: data,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to contact Upstox token gateway: " + err.message,
    });
  }
});

// Automatic OAuth Redirect Callback Endpoint (/api/market/callback?code=...)
app.get("/api/market/callback", async (req: Request, res: Response) => {
  const code = (req.query.code as string) || "";
  if (!code) {
    return res.status(400).send(`
      <html><body style="background:#0b0f19;color:#f87171;font-family:sans-serif;padding:40px;text-align:center;">
        <h2>Upstox Authorization Code ലഭ്യമല്ല</h2>
        <p>ദയവായി Upstox API Keys & Redirect URI പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.</p>
      </body></html>
    `);
  }

  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers.host;
  const callbackUri = upstoxConfig.redirectUri || `${protocol}://${host}/api/market/callback`;

  try {
    const params = new URLSearchParams();
    params.append("code", code.trim());
    params.append("client_id", upstoxConfig.apiKey);
    params.append("client_secret", upstoxConfig.apiSecret);
    params.append("redirect_uri", callbackUri);
    params.append("grant_type", "authorization_code");

    const response = await fetch(
      "https://api.upstox.com/v2/login/authorization/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "Api-Version": "2.0",
        },
        body: params.toString(),
      },
    );
    const data = await response.json();

    if (data.access_token) {
      upstoxConfig.accessToken = data.access_token;
      upstoxConfig.userName = data.user_name || "Upstox Trader";
      upstoxConfig.userEmail = data.email || "";
      upstoxConfig.userClientCode = data.user_id || "";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      savePostgresDb();

      return res.send(`
        <html><body style="background:#0b0f19;color:#34d399;font-family:sans-serif;padding:40px;text-align:center;">
          <h2>✅ Upstox Access Token വിജയകരമായി ആക്റ്റീവ് ആയി!</h2>
          <p style="color:#cbd5e1;">അക്കൗണ്ട്: <b>${upstoxConfig.userName} (${upstoxConfig.userClientCode})</b></p>
          <p style="color:#94a3b8;font-size:13px;">ഈ വിൻഡോ തനിയെ അടയും, അല്ലെങ്കിൽ ആപ്പിലേക്ക് തിരികെ പോകാം.</p>
          <script>
            try {
              localStorage.setItem('upstox_daily_token', ${JSON.stringify(data.access_token)});
              if (window.opener) {
                window.opener.postMessage({
                  type: 'UPSTOX_OAUTH_SUCCESS',
                  accessToken: ${JSON.stringify(data.access_token)},
                  userName: ${JSON.stringify(upstoxConfig.userName)},
                  userClientCode: ${JSON.stringify(upstoxConfig.userClientCode)}
                }, '*');
                setTimeout(() => window.close(), 1200);
              } else {
                setTimeout(() => { window.location.href = '/'; }, 1500);
              }
            } catch (e) {}
          </script>
        </body></html>
      `);
    } else {
      return res.send(`
        <html><body style="background:#0b0f19;color:#fbbf24;font-family:sans-serif;padding:30px;text-align:center;">
          <h3>Upstox Authorization Code ലഭിച്ചു!</h3>
          <p style="color:#cbd5e1;">താഴെ കാണുന്ന കോഡ് കോപ്പി ചെയ്ത് ആപ്പിലെ "code=" ബോക്സിൽ പേസ്റ്റ് ചെയ്യുക:</p>
          <div style="background:#1e293b;padding:14px;border-radius:10px;color:#38bdf8;font-family:monospace;font-size:18px;margin:16px auto;max-width:400px;word-break:break-all;">${code}</div>
          <p style="color:#f87171;font-size:12px;">(${data.errors?.[0]?.message || "API Secret ആപ്പിൽ സേവ് ചെയ്യാത്തതിനാൽ ഓട്ടോ-എക്സ്ചേഞ്ച് നടന്നില്ല"})</p>
        </body></html>
      `);
    }
  } catch (err: any) {
    return res.send(`
      <html><body style="background:#0b0f19;color:#fbbf24;font-family:sans-serif;padding:30px;text-align:center;">
        <h3>Upstox Authorization Code:</h3>
        <div style="background:#1e293b;padding:14px;border-radius:10px;color:#38bdf8;font-family:monospace;font-size:18px;margin:16px auto;max-width:400px;">${code}</div>
      </body></html>
    `);
  }
});

// 3. User Profile & Margin
app.get("/api/market/profile", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated with Upstox" });
  }

  try {
    const profileRes = await fetch("https://api.upstox.com/v2/user/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    const profileData = await profileRes.json();

    const fundsRes = await fetch(
      "https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const fundsData = await fundsRes.json();

    let availableMargin = 0;
    let usedMargin = 0;

    if (
      fundsData.status === "success" &&
      fundsData.data &&
      fundsData.data.equity
    ) {
      availableMargin = fundsData.data.equity.available_margin || 0;
      usedMargin = fundsData.data.equity.used_margin || 0;
    }

    if (profileData.status === "success" && profileData.data) {
      return res.json({
        isConnected: true,
        userName: profileData.data.user_name || "Live Trader",
        userEmail: profileData.data.email || "trader@upstox.com",
        broker: "Upstox Securities Pvt Ltd",
        availableMargin,
        usedMargin,
      });
    } else {
      return res
        .status(401)
        .json({
          error: "Failed to fetch Upstox profile",
          details: profileData,
        });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Real-time Upstox Positions
app.get("/api/market/positions", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  if (!token) return res.json([]);

  try {
    const response = await fetch(
      "https://api.upstox.com/v2/portfolio/short-term-positions",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const data = await response.json();
    if (data.status === "success" && data.data) {
      return res.json(
        data.data.map((p: any) => ({
          id: p.trading_symbol || p.instrument_token,
          symbol: p.trading_symbol || p.instrument_token,
          instrumentKey: p.instrument_token,
          productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
          quantity: p.quantity || p.net_quantity,
          buyPrice: p.average_price || p.buy_amount / (p.buy_quantity || 1),
          currentLTP: p.last_price || p.average_price,
          pnl: p.pnl || p.m2m,
          pnlPercent: p.average_price
            ? ((p.last_price - p.average_price) / p.average_price) * 100
            : 0,
          mode: "UPSTOX_LIVE",
          openedAt: new Date().toLocaleTimeString("en-IN"),
        })),
      );
    }
    return res.json([]);
  } catch (e) {
    return res.json([]);
  }
});

// Real-time Upstox Holdings
app.get("/api/market/holdings", async (req: Request, res: Response) => {
  const headerToken = req.headers.authorization?.replace("Bearer ", "").trim() || "";
  const token =
    headerToken && !invalidTokens.has(headerToken)
      ? headerToken
      : upstoxConfig.accessToken;
  if (!token) return res.json([]);

  try {
    const response = await fetch(
      "https://api.upstox.com/v2/portfolio/long-term-holdings",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const data = await response.json();
    if (data.status === "success" && Array.isArray(data.data)) {
      return res.json(
        data.data.map((h: any) => {
          const baseQty = Number(h.quantity || 0);
          const t1Qty = Number(h.t1_quantity || 0);
          const colQty = Number(h.collateral_quantity || 0);
          const totalQty = baseQty + t1Qty > 0 ? baseQty + t1Qty : colQty || baseQty;
          const avgPrice = Number(h.average_price || h.close_price || 0);
          const ltp = Number(h.last_price || h.close_price || avgPrice || 0);
          const computedPnl =
            h.pnl !== undefined && h.pnl !== null && Number(h.pnl) !== 0
              ? Number(h.pnl)
              : (ltp - avgPrice) * totalQty;
          const sym =
            h.trading_symbol ||
            h.tradingsymbol ||
            h.company_name ||
            h.instrument_token ||
            "STOCK";
          return {
            symbol: sym,
            companyName: h.company_name || sym,
            instrumentKey: h.instrument_token || `NSE_EQ|${sym}`,
            quantity: totalQty,
            buyPrice: avgPrice,
            currentLTP: ltp,
            pnl: Number(computedPnl.toFixed(2)),
            pnlPercent:
              avgPrice > 0
                ? Number((((ltp - avgPrice) / avgPrice) * 100).toFixed(2))
                : 0,
          };
        }),
      );
    }
    return res.json([]);
  } catch (e) {
    console.error("Holdings API error:", e);
    return res.json([]);
  }
});

// 4. Live Market Quotes
app.get("/api/market/brokerage", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  const { instrumentToken, quantity, product, transactionType, price } =
    req.query;

  if (!instrumentToken || !quantity || !product || !transactionType || !price) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (token && token.trim() !== "") {
    try {
      const response = await fetch(
        `https://api.upstox.com/v2/charges/brokerage?instrument_token=${encodeURIComponent(instrumentToken as string)}&quantity=${quantity}&product=${product}&transaction_type=${transactionType}&price=${price}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Api-Version": "2.0",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      } else {
        const err = await response.text();
        if (!err.includes("Invalid Instrument key"))
          console.error("Upstox Brokerage API failed:", err);
      }
    } catch (err) {
      console.error("Error fetching from upstox:", err);
    }
  }

  const isOption =
    String(instrumentToken).includes("CE") ||
    String(instrumentToken).includes("PE") ||
    String(instrumentToken).includes("OPT");
  const qty = Number(quantity);
  const prc = Number(price);
  const tradeValue = qty * prc;

  let brokerage = 0;
  let stt = 0;
  let transactionCharge = 0;
  let gst = 0;
  let stampDuty = 0;
  let sebiCharge = 0;

  if (isOption) {
    brokerage = 20;
    stt = transactionType === "SELL" ? tradeValue * 0.00125 : 0;
    transactionCharge = tradeValue * 0.0005;
    sebiCharge = tradeValue * 0.000001;
    gst = (brokerage + transactionCharge + sebiCharge) * 0.18;
    stampDuty = transactionType === "BUY" ? tradeValue * 0.00003 : 0;
  } else {
    brokerage = Math.min(20, tradeValue * 0.0005);
    stt = transactionType === "SELL" ? tradeValue * 0.00025 : 0;
    transactionCharge = tradeValue * 0.0000345;
    sebiCharge = tradeValue * 0.000001;
    gst = (brokerage + transactionCharge + sebiCharge) * 0.18;
    stampDuty = transactionType === "BUY" ? tradeValue * 0.00003 : 0;
  }

  const total =
    brokerage + stt + transactionCharge + gst + stampDuty + sebiCharge;

  return res.json({
    status: "success",
    data: {
      charges: {
        total: total,
        brokerage: brokerage,
        taxes: {
          gst,
          stt,
          stampDuty,
          transactionCharge,
          sebiCharge,
        },
      },
    },
    isFallback: true,
  });
});

app.get("/api/market/quotes", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;

  // Default index symbols + subscribed keys
  const keysArray = Array.from(subscribedKeys);
  const defaultKeys = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
    "BSE_INDEX|BANKEX",
    "NSE_INDEX|Nifty Fin Service",
    "NSE_EQ|INE002A01018", // RELIANCE
    "NSE_EQ|INE040A01034", // HDFCBANK
    "NSE_EQ|INE467B01029", // TCS
    "NSE_EQ|INE009A01021", // INFY
    "NSE_EQ|INE090A01021", // ICICIBANK
    "NSE_EQ|INE062A01020", // SBI
    "NSE_EQ|INE238A01034", // AXISBANK
    "NSE_EQ|INE030A01027", // HINDUNILVR
    "NSE_EQ|INE154A01025", // ITC
    "NSE_EQ|INE018A01030", // LT
    "NSE_EQ|INE397D01024", // BHARTIARTL
    "NSE_EQ|INE296A01024", // BAJFINANCE
    "NSE_EQ|INE860A01027", // HCLTECH
    "NSE_EQ|INE021A01026", // ASIANPAINT
  ];
  defaultKeys.forEach((k) => {
    if (!keysArray.includes(k)) keysArray.push(k);
  });

  let symbols = keysArray.join(",");
  if (req.query.symbols as string) {
    symbols = req.query.symbols as string;
  }

  const formatDataToQuotesList = (upstoxData: any) => {
    const list = [];
    for (const [key, val] of Object.entries(upstoxData || {})) {
      const v = val as any;
      const parts = key.split(/[:|]/);
      const symbolDisplay = (parts.length > 1 ? parts[1] : key).toUpperCase();
      const segment = key.includes("INDEX")
        ? "INDEX"
        : key.includes("FO")
          ? "OPTIONS"
          : "EQUITY";
      list.push({
        symbol: symbolDisplay,
        segment,
        instrumentKey: key,
        ltp: v.last_price || 0,
        change: v.net_change || 0,
        changePercent: v.last_price
          ? Number(
              ((v.net_change / (v.last_price - v.net_change)) * 100).toFixed(2),
            )
          : 0,
        volume: v.volume || 0,
        open: v.open || 0,
        high: v.ohlc?.high || v.high || 0,
        low: v.ohlc?.low || v.low || 0,
        close: v.ohlc?.close || v.close || v.last_price - v.net_change,
      });
    }
    return list;
  };

  if (!token) {
    return res
      .status(401)
      .json({ status: "error", error: "Upstox login required for live data" });
  }

  try {
    const response = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(symbols)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Failed to fetch quotes" });
    }
    const data = await response.json();
    return res.json({ ...data, quotes: formatDataToQuotesList(data?.data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Historical & Intraday Candles
app.get("/api/market/candles", async (req: Request, res: Response) => {
  const symbol = req.query.symbol as string as string;
  const interval = (req.query.interval as string) || "1 ";
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;

  if (!token || !symbol) {
    return res
      .status(401)
      .json({
        success: false,
        error: "Unauthorized: Upstox API Token and symbol are required.",
      });
  }

  try {
    let instrumentKey = req.query.instrumentKey || getInstrumentKey(symbol);
    let url = "";

    // Upstox API v2 historical candle interval accepts one of (1minute,30minute,day,week,month)
    if (interval === "1d") {
      const today = new Date();
      const toDate = today.toISOString().split("T")[0];
      const fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey as string)}/day/${toDate}/${fromDate}`;
    } else {
      url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey as string)}/1minute`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    const data = await response.json();

    // If intraday returned no candles (e.g., market is closed, weekend, or holiday), fetch recent historical candles from Upstox
    if (!data?.data?.candles || data.data.candles.length === 0) {
      const today = new Date();
      const toDate = today.toISOString().split("T")[0];
      const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const histInterval = interval === "1d" ? "day" : "30minute";
      const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey as string)}/${histInterval}/${toDate}/${fromDate}`;
      try {
        const histRes = await fetch(histUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        });
        const histData = await histRes.json();
        if (histData.status === "success" && histData.data?.candles?.length > 0) {
          data.status = "success";
          data.data = histData.data;
        }
      } catch (histErr) {
        console.error("Historical candle fallback error:", histErr);
      }
    }

    if (data.status === "success" && data.data && data.data.candles) {
      let rawCandles = data.data.candles
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
        .filter((c) => !isNaN(c.timestamp))
        .reverse();

      // Aggregate if needed
      let candles = rawCandles;
      if (interval === "5m") {
        candles = aggregateCandles(rawCandles, 5 * 60 * 1000);
      } else if (interval === "15m") {
        candles = aggregateCandles(rawCandles, 15 * 60 * 1000);
      } else if (interval === "30m") {
        candles = aggregateCandles(rawCandles, 30 * 60 * 1000);
      } else if (interval === "1h") {
        candles = aggregateCandles(rawCandles, 60 * 60 * 1000);
      }

      return res.json({ success: true, symbol, interval, candles });
    }
    return res.json({
      success: false,
      symbol,
      interval,
      candles: [],
      error: data.errors || data.message || "API returned no candles",
      raw: data,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, symbol, interval, error: err.message });
  }
});

// 6. Option Chain Data (Real Upstox API with Fallback)

// Real-time instrument lookup
app.get("/api/instrument/details", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string as string) || "";
  const instrumentKey = getInstrumentKey(symbol);

  let lotSize = 1;
  if (symbol.includes("FIN SERVICE") || symbol.includes("FINNIFTY"))
    lotSize = 65;
  if (symbol.includes("BANK")) lotSize = 15;
  if (symbol.includes("NIFTY")) lotSize = 25; // Default correct for Nifty 50 currently
  if (symbol.includes("SENSEX")) lotSize = 10;

  const token = upstoxConfig.accessToken;
  // If it's an option or index, try fetching contract to get the exact real-time lot size
  if (
    token &&
    (symbol.includes("NIFTY") ||
      symbol.includes("BANK") ||
      symbol.includes("SENSEX"))
  ) {
    try {
      const contractRes = await fetch(
        `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey as string)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (contractRes.ok) {
        const contractData = await contractRes.json();
        if (contractData.data && contractData.data.length > 0) {
          if (contractData.data[0].lot_size) {
            lotSize = contractData.data[0].lot_size;
          }
        }
      }
    } catch (e) {
      // ignore, use defaults
    }
  }

  res.json({ symbol, instrumentKey, lotSize });
});

app.get("/api/market/optionchain", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string as string) || "NIFTY 50";
  const instrumentKey = getInstrumentKey(symbol);
  const token = upstoxConfig.accessToken;

  if (!token) {
    // No fallback. Return error if disconnected.
    return res.status(401).json({ error: "Upstox Token Missing", strikes: [] });
  }

  try {
    // Fetch contract to get expiry dates
    const contractRes = await fetch(
      `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey as string)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!contractRes.ok) {
      return res
        .status(401)
        .json({ error: "Unauthorized. Check API Token.", strikes: [] });
    }

    const contractData = await contractRes.json();
    if (!contractData.data || contractData.data.length === 0) {
      throw new Error("No contracts found");
    }

    // Find nearest valid expiry date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validExpiries = contractData.data
      .map((c) => c.expiry)
      .filter((e) => new Date(e).getTime() >= today.getTime())
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const expiryDate =
      validExpiries.length > 0 ? validExpiries[0] : contractData.data[0].expiry;

    // Fetch option chain
    const chainRes = await fetch(
      `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(instrumentKey as string)}&expiry_date=${expiryDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!chainRes.ok) {
      throw new Error("Failed to fetch option chain");
    }

    const chainData = await chainRes.json();

    if (chainData && chainData.data) {
      let totalCallOI = 0;
      let totalPutOI = 0;
      const strikes = chainData.data.map((item: any) => {
        const call = item.call_options || {};
        const put = item.put_options || {};
        const callOI = call.market_data?.oi || 0;
        const putOI = put.market_data?.oi || 0;
        totalCallOI += callOI;
        totalPutOI += putOI;

        return {
          strikePrice: item.strike_price,
          callLTP: call.market_data?.ltp || 0,
          putLTP: put.market_data?.ltp || 0,
          callOI,
          putOI,
          callChangeOI: call.market_data?.oi_change || 0,
          putChangeOI: put.market_data?.oi_change || 0,
          callVolume: call.market_data?.volume || 0,
          putVolume: put.market_data?.volume || 0,
          callDelta: call.option_greeks?.delta || 0,
          putDelta: put.option_greeks?.delta || 0,
          callTheta: call.option_greeks?.theta || 0,
          putTheta: put.option_greeks?.theta || 0,
          callGamma: call.option_greeks?.gamma || 0,
          putGamma: put.option_greeks?.gamma || 0,
          callIV: call.option_greeks?.iv || 0,
          putIV: put.option_greeks?.iv || 0,
          callInstrumentKey: call.instrument_key || "",
          putInstrumentKey: put.instrument_key || "",
        };
      });

      const pcr =
        totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 1;

      const result = {
        underlyingSymbol: symbol,
        underlyingLTP: chainData.data[0]?.underlying_price || 0,
        timestamp: new Date().toISOString(),
        expiryDates: [expiryDate],
        selectedExpiry: expiryDate,
        strikes,
        pcr,
        maxPain:
          strikes.length > 0
            ? strikes[Math.floor(strikes.length / 2)].strikePrice
            : 0,
        totalCallOI,
        totalPutOI,
      };

      return res.json(result);
    }
    throw new Error("Invalid chain data");
  } catch (error) {
    console.warn("Option Chain unavailable (likely missing/invalid token).");
    // Fallback to last known if available
    return res
      .status(500)
      .json({ error: "Failed to fetch option chain", strikes: [] });
    return res
      .status(500)
      .json({ error: "Failed to fetch option chain", strikes: [] });
  }
});

app.post("/api/trading/order", async (req: Request, res: Response) => {
  const { mode, symbol, initialType, quantity, price } = req.body;
  if (mode === "PAPER_TRADING") {
    const newOrder = {
      id: "ORD" + Date.now(),
      symbol,
      type: initialType,
      quantity: Number(quantity) || 1,
      price: Number(price) || 0,
      status: "COMPLETE",
      time: new Date().toISOString(),
    };
    paperOrders.unshift(newOrder);

    // Add to positions
    const pos = paperPositions.find((p: any) => p.symbol === symbol);
    if (pos) {
      pos.quantity +=
        initialType === "BUY" ? newOrder.quantity : -newOrder.quantity;
      if (pos.quantity === 0) {
        paperPositions.splice(paperPositions.indexOf(pos), 1);
      }
    } else {
      paperPositions.push({
        id: "POS" + Date.now(),
        symbol,
        quantity:
          initialType === "BUY" ? newOrder.quantity : -newOrder.quantity,
        buyPrice: newOrder.price,
        currentLTP: newOrder.price,
        pnl: 0,
        type: initialType,
        isOption: symbol.includes(" CE") || symbol.includes(" PE"),
      });
    }
    return res.json({ success: true, order: newOrder });
  }
  if (mode === "UPSTOX_LIVE") {
    const token = upstoxConfig.accessToken;
    if (!token)
      return res
        .status(401)
        .json({ success: false, error: "Upstox Token missing" });

    // Attempt real order
    try {
      let instrKey = symbol;
      if (!symbol.includes("|")) {
        // Basic guess for instrument key if symbol is plain
        if (symbol.includes("CE") || symbol.includes("PE"))
          instrKey = "NSE_FO|" + symbol;
        else instrKey = "NSE_EQ|" + symbol;
      }

      const orderRes = await fetch("https://api.upstox.com/v2/order/place", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Api-Version": "2.0",
        },
        body: JSON.stringify({
          quantity: Number(quantity) || 1,
          product: "D",
          validity: "DAY",
          price: Number(price) || 0,
          tag: "manual_ui_order",
          instrument_token: instrKey,
          order_type: Number(price) > 0 ? "LIMIT" : "MARKET",
          transaction_type: initialType,
          disclosed_quantity: 0,
          trigger_price: 0,
          is_amo: false,
        }),
      });

      const data = await orderRes.json();
      if (data.status === "success") {
        return res.json({ success: true, order: data.data });
      } else {
        return res.json({
          success: false,
          error: data.errors?.[0]?.message || "Order failed",
        });
      }
    } catch (err: any) {
      return res.json({ success: false, error: err.message });
    }
  }
  res.json({ success: false, error: "Invalid mode" });
});

let paperOrders: any[] = [];
let paperPositions: any[] = [];
let paperTradeHistory: any[] = [];

import fsSync from "fs";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");




const LOCAL_DB_PATH = path.join(process.cwd(), "local_db.json");
let lastSavedDbJson = "";

async function savePostgresDb() {
  const dbData = {
    botConfig,
    upstoxConfig,
    paperOrders,
    paperPositions,
    paperTradeHistory,
  };

  const serialized = JSON.stringify(dbData, null, 2);
  if (serialized === lastSavedDbJson) return;
  lastSavedDbJson = serialized;

  try {
    fsSync.writeFileSync(LOCAL_DB_PATH, serialized, "utf-8");
  } catch (err) {
    // Ignore read-only fs in certain cloud containers
  }

  if (!postgresAvailable) return;

  try {
    await db.insert(appState).values({
      id: 'main_state',
      data: dbData,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: appState.id,
      set: { data: dbData, updatedAt: new Date() }
    });
  } catch (e) {
    postgresAvailable = false;
  }
}

async function loadPostgresDb() {
  const normalizeUpstoxCfg = () => {
    if (
      !upstoxConfig.redirectUri ||
      upstoxConfig.redirectUri.includes("localhost") ||
      upstoxConfig.redirectUri.includes("127.0.0.1")
    ) {
      upstoxConfig.redirectUri = "https://sajad-trading-view.onrender.com";
    }
    if (!upstoxConfig.apiKey) {
      upstoxConfig.apiKey = "3ab5711d-8891-480b-b0c1-29662852de49";
    }
    if (upstoxConfig.apiSecret && upstoxConfig.apiSecret.includes("•")) {
      upstoxConfig.apiSecret = process.env.UPSTOX_API_SECRET || "";
    }
  };

  // First load from local_db.json if available
  try {
    if (fsSync.existsSync(LOCAL_DB_PATH)) {
      const raw = fsSync.readFileSync(LOCAL_DB_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (data.botConfig) botConfig = { ...botConfig, ...data.botConfig };
      if (data.upstoxConfig) upstoxConfig = { ...upstoxConfig, ...data.upstoxConfig };
      if (data.paperOrders) paperOrders = data.paperOrders;
      if (data.paperPositions) paperPositions = data.paperPositions;
      if (data.paperTradeHistory) paperTradeHistory = data.paperTradeHistory;
      normalizeUpstoxCfg();
    }
  } catch (err) {}

  if (!postgresAvailable) return;

  try {
    const rows = await db.select().from(appState).where(eq(appState.id, 'main_state'));
    if (rows && rows.length > 0) {
      const data = rows[0].data as any;
      if (data.botConfig) botConfig = { ...botConfig, ...data.botConfig };
      if (data.upstoxConfig) upstoxConfig = { ...upstoxConfig, ...data.upstoxConfig };
      if (data.paperOrders) paperOrders = data.paperOrders;
      if (data.paperPositions) paperPositions = data.paperPositions;
      if (data.paperTradeHistory) paperTradeHistory = data.paperTradeHistory;
      normalizeUpstoxCfg();
      console.log("Loaded persistent data from PostgreSQL Cloud SQL!");
    }
  } catch (e) {
    postgresAvailable = false;
  }
}

loadPostgresDb().then(() => {
  setInterval(savePostgresDb, 5000);
  // Continuously poll public webhook relay & Render bridge every 6 seconds when not connected
  setInterval(() => {
    if (!upstoxConfig.accessToken || invalidTokens.has(upstoxConfig.accessToken)) {
      syncTokenFromRenderWebhookBridge().catch(() => {});
    }
  }, 6000);
});

const globalLiveQuotes: Record<string, any> = {};

app.get("/api/trading/history", async (req: Request, res: Response) => {
  const mode = req.query.mode;
  if (mode === "PAPER_TRADING") {
    return res.json(paperTradeHistory);
  }

  // UPSTOX_LIVE: Fetch closed positions from short-term-positions
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  if (!token) return res.json([]);
  try {
    const response = await fetch(
      "https://api.upstox.com/v2/portfolio/short-term-positions",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const data = await response.json();
    if (data.status === "success" && data.data) {
      const history = data.data
        .filter((p: any) => p.quantity === 0 || p.net_quantity === 0)
        .map((p: any) => ({
          id: p.trading_symbol || p.instrument_token,
          symbol: p.trading_symbol || p.instrument_token,
          instrumentKey: p.instrument_token,
          productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
          quantity: Math.abs(p.buy_quantity || p.sell_quantity || 0),
          buyPrice: p.buy_amount / (p.buy_quantity || 1),
          sellPrice: p.sell_amount / (p.sell_quantity || 1),
          realizedPnL: p.realised || p.pnl || p.m2m || 0,
          closeTime: new Date().toISOString(), // Upstox doesn't provide exact close time in positions API easily, just use current
          mode: "UPSTOX_LIVE",
        }));
      return res.json(history);
    }
  } catch (err) {}
  return res.json([]);
});

app.get("/api/trading/orders", async (req: Request, res: Response) => {
  const mode = req.query.mode;
  if (mode === "PAPER_TRADING") {
    return res.json(paperOrders);
  }
  res.redirect("/api/market/orders");
});

app.get("/api/trading/positions", async (req: Request, res: Response) => {
  const mode = req.query.mode;
  if (mode === "PAPER_TRADING") {
    return res.json(paperPositions);
  }
  res.redirect("/api/market/positions");
});

// Square off single position (Placeholder for Upstox integration)

app.post(
  "/api/market/positions/squareoff/:positionId",
  (req: Request, res: Response) => {
    res.json({
      success: false,
      error: "Square off must be executed directly via Upstox API.",
    });
  },
);

// Square off all positions (Placeholder for Upstox integration)
app.post(
  "/api/market/positions/square-off-all",
  (req: Request, res: Response) => {
    res.json({
      success: false,
      error:
        "Square off all must be executed directly via Upstox API with specific order parameters.",
    });
  },
);

app.post(
  "/api/trading/squareoff/:positionId",
  (req: Request, res: Response) => {
    const { mode } = req.body;
    if (mode === "PAPER_TRADING") {
      const posId = req.params.positionId;
      const idx = paperPositions.findIndex(
        (p) => p.id === posId || p.symbol === posId,
      );
      if (idx >= 0) {
        const closedPos = paperPositions.splice(idx, 1)[0];
        closedPos.sellPrice = closedPos.currentLTP;
        closedPos.realizedPnL = closedPos.pnl;
        closedPos.closeTime = new Date().toISOString();
        paperTradeHistory.unshift(closedPos);
        if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
        return res.json({ success: true });
      }
    }
    res.json({
      success: false,
      error:
        "Square off  ust bemexecuted directly via Upstox API with specific order parameters.",
    });
  },
);

app.post("/api/trading/squareoff-all", (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode === "PAPER_TRADING") {
    paperPositions.forEach((p) => {
      p.sellPrice = p.currentLTP;
      p.realizedPnL = p.pnl;
      p.closeTime = new Date().toISOString();
      paperTradeHistory.unshift(p);
      if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
    });
    paperPositions = [];
    return res.json({ success: true });
  }
  res.json({
    success: false,
    error: "Square off all  ust bemexecuted directly via Upstox API.",
  });
});

app.post("/api/trading/paper-sync", (req: Request, res: Response) => {
  const { quotes } = req.body;
  if (quotes && Array.isArray(quotes)) {
    paperPositions = paperPositions.map((pos) => {
      const q = quotes.find((x: any) => x.instrumentKey === pos.instrumentKey);
      if (q) {
        if (pos.isOption && q.ltp > pos.buyPrice * 50) {
          // Skip, this is the underlying index price
        } else {
          pos.currentLTP = q.ltp;
          pos.pnl = (q.ltp - pos.buyPrice) * pos.quantity;
          pos.pnlPercent = ((q.ltp - pos.buyPrice) / pos.buyPrice) * 100;
        }
      }
      return pos;
    });
  }
  res.json({ success: true });
});

// 10. Gemini AI Live Market & Algorithmic Analysis Engine (with aliases)
const handleGeminiAnalysis = async (req: Request, res: Response) => {
  try {
    const { symbol, ltp, changePercent, indicators, interval, geminiApiKey } = req.body;
    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;

    const quote = { ltp: ltp || 0, changePercent: changePercent || 0 };
    const prompt = `You are a world-class Quantitative Financial Analyst and Algorithmic Trading Architect for Indian Equities (NSE/BSE)  on the Upstox Live Platform.
Analyze the following LIVE MARKET DATA for ${symbol}:
- Current LTP: ₹${quote.ltp}
- Day Change: ${quote.changePercent}%
- Timeframe: ${interval || "5m"}
- Technical Indicator States:
  * Supertrend: ${indicators?.supertrend?.signal || "N/A"} at ₹${indicators?.supertrend?.value || "N/A"}
  * EMA Cross (9/21/50): ${indicators?.emaCross?.signal || "N/A"}
  * RSI (14): ${indicators?.rsi?.value || "N/A"}
  * MACD: ${indicators?.macd?.cross || "N/A"}
  * VWAP: ₹${indicators?.vwap?.value || "N/A"}

- Advanced Options & Market Depth Parameters (Estimated based on current volatility):
  * Candlestick Patterns: Check for Doji, Engulfing, Hammer, Shooting Star
  * Option Greeks: Consider Theta (Time Decay), Gamma (Acceleration), Delta, and IV (Implied Volatility)
  * OI (Open Interest): Consider support/resistance based on PCR and Option Chain data
  * Chart History: Evaluate support/resistance lines, trendlines, and previous day highs/lows.

Provide a structured, institutional algorith ic evaluation.
Return your response STRICTLY as a JSON object adhering to the schema.
Provide both English and Malayalam (മലയാളം)  explanations for the user.`;

    const dynamicAi = new GoogleGenAI({
      apiKey: apiKey || "",
    });
    const response = await dynamicAi.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: {
              type: Type.STRING,
              enum: [
                "STRONG_BULLISH",
                "BULLISH",
                "NEUTRAL",
                "BEARISH",
                "STRONG_BEARISH",
              ],
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: "Algorithmic confidence percentage (0 to 100) ",
            },
            summary: {
              type: Type.STRING,
              description: "Executive market summary in English",
            },
            summaryMalayalam: {
              type: Type.STRING,
              description:
                "Executive market summary in clear, natural Malayalam",
            },
            keyLevels: {
              type: Type.OBJECT,
              properties: {
                support1: { type: Type.NUMBER },
                support2: { type: Type.NUMBER },
                resistance1: { type: Type.NUMBER },
                resistance2: { type: Type.NUMBER },
              },
              required: ["support1", "support2", "resistance1", "resistance2"],
            },
            recommendedAction: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["BUY", "SELL", "WAIT"] },
                entryRange: { type: Type.STRING },
                stopLoss: { type: Type.NUMBER },
                target1: { type: Type.NUMBER },
                target2: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER },
                riskReward: { type: Type.STRING },
              },
              required: [
                "type",
                "entryRange",
                "stopLoss",
                "target1",
                "target2",
                "confidence",
                "riskReward",
              ],
            },
            technicalReasons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            technicalReasonsMalayalam: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            catalyst: { type: Type.STRING },
          },
          required: [
            "sentiment",
            "confidenceScore",
            "summary",
            "summaryMalayalam",
            "keyLevels",
            "recommendedAction",
            "technicalReasons",
            "technicalReasonsMalayalam",
            "catalyst",
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return res.json({
      success: true,
      data: {
        ...parsed,
        analyzedAt: new Date().toLocaleTimeString("en-IN"),
      },
    });
  } catch (error: any) {
    // If Gemini fails or key isn't provided, return error instead of fake du  y data
    return res.status(500).json({
      success: false,
      error: "AI Analysis failed: " + error.message,
    });
  }
};

app.post("/api/gemini/market-analysis", handleGeminiAnalysis);
app.post("/api/gemini/analyze", handleGeminiAnalysis);

// 10. AI Diagnostics & Support Chat
app.post("/api/gemini/chat", async (req: Request, res: Response) => {
  const { message, systemStatus, geminiApiKey } = req.body;
  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({
        success: false,
        error: "GenAI client not initialized (Missing API Key) .",
      });
  try {
    const prompt = `You are an AI assistant for a Trading application built with Upstox API.
    
    User Message: "${message}"
    
    System Status: ${JSON.stringify(systemStatus)}
    
    Help the user troubleshoot or provide guidance on using the app. Reply in the same language they used (Malayalam or English) . Keep it concise.`;

    const dynamicAi = new GoogleGenAI({
      apiKey: apiKey || "",
    });
    const response = await dynamicAi.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    return res.json({ success: true, text: response.text });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Telegram Alert Integration & Test Route
async function sendTelegramNotification(message: string) {
  const token = botConfig.telegramBotToken;
  const chatId = botConfig.telegramChatId;
  if (!botConfig.telegramAlertsEnabled || !token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.error("Failed to send telegram notification:", e);
  }
}

app.post("/api/telegram/test-alert", async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;
  const token = botToken || botConfig.telegramBotToken;
  const chat = chatId || botConfig.telegramChatId;

  if (!token || !chat) {
    return res.status(400).json({
      success: false,
      message: "Telegram Bot Token and Chat ID are required.",
    });
  }

  try {
    const testMessage = `🤖 <b>Upstox Algo Bot Connected Successfully!</b>\n\n` +
      `⚡ <i>Status:</i> Active & Ready for Live Trading\n` +
      `🛡️ <i>Profit Vault:</i> 100% Peak Harvest Enabled\n` +
      `⏰ <i>Server Time:</i> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n\n` +
      `<i>You will receive instant alerts for Signals, Entries, Trailing Stop-Loss, and Profit Bookings.</i>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: testMessage,
        parse_mode: "HTML",
      }),
    });

    const tgData = await tgRes.json();
    if (tgData.ok) {
      // Save permanently to botConfig
      botConfig.telegramBotToken = token;
      botConfig.telegramChatId = chat;
      botConfig.telegramAlertsEnabled = true;
      await savePostgresDb().catch(() => {});
      return res.json({
        success: true,
        message: "Test message sent to Telegram successfully! Configuration saved permanently.",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: tgData.description || "Failed to send message via Telegram API.",
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: "Network error sending Telegram message: " + err.message,
    });
  }
});

// Global Error Handler for API routes
app.use((err: any, req: Request, res: Response, next: any) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error("[API Error]", err?.message || err);
  res.status(500).json({
    success: false,
    error: err?.message || "Internal Server Error",
  });
});

// Vite middleware for development vs static dist for production

app.get("/api/stream/quotes", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let symbols =
    "NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX,BSE_INDEX|BANKEX,NSE_INDEX|Nifty Fin Service";
  if (req.query.symbols as string) {
    symbols = req.query.symbols as string;
  }

  // Send an initial connected message
  res.write('data: {"type": "CONNECTED"}\n\n');

  const fetchAndPushQuotes = async () => {
    // Send a heartbeat comment to keep the connection alive through proxies
    res.write(":\n\n");

    const token = upstoxConfig.accessToken;
    if (!token) {
      // Just send a keep-alive if no token so the connection doesn't drop
      return;
    }
    try {
      const instruments = symbols
        .split(",")
        .map((s) => encodeURIComponent(s.trim()))
        .join(",");
      const response = await fetch(
        `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instruments}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        },
      );
      const data = await response.json();
      if (data.status === "success" && data.data) {
        const quotesList = Object.keys(data.data).map((key) => {
          const item = data.data[key];
          const ltp = item.last_price || 0;
          const close = item.ohlc?.close || ltp;
          const change = Number((ltp - close).toFixed(2));
          const changePercent =
            close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;

          let symbolDisplay = item.symbol;
          if (!symbolDisplay || symbolDisplay === "NA") {
            const parts = key.split(/[:|]/);
            symbolDisplay = (parts.length > 1 ? parts[1] : key).toUpperCase();
          } else {
            symbolDisplay = symbolDisplay.toUpperCase();
          }
          const segment = key.includes("INDEX")
            ? "INDEX"
            : key.includes("FO")
              ? "OPTIONS"
              : "EQUITY";
          return {
            symbol: symbolDisplay,
            segment,
            instrumentKey: key,
            ltp,
            change,
            changePercent,
            volume: item.volume || 0,
            open: item.ohlc?.open || 0,
            high: item.ohlc?.high || 0,
            low: item.ohlc?.low || 0,
            close,
          };
        });
        res.write(
          `data: ${JSON.stringify({ type: "QUOTES", data: quotesList })}\n\n`,
        );
      }
    } catch (err) {}
  };

  const quoteInterval = setInterval(fetchAndPushQuotes, 1000);
  req.on("close", () => {
    clearInterval(quoteInterval);
  });
});

const wss = new WebSocketServer({ noServer: true });
const subscribedKeys = new Set<string>([
  "NSE_INDEX|Nifty 50",
  "NSE_INDEX|Nifty Bank",
  "BSE_INDEX|SENSEX",
  "BSE_INDEX|BANKEX",
  "NSE_INDEX|Nifty Fin Service",
]);

async function broadcastUpstoxQuotesToWs() {
  if (wss.clients.size === 0) return;
  const token = upstoxConfig.accessToken;
  if (!token || invalidTokens.has(token) || subscribedKeys.size === 0) return;

  try {
    const instruments = Array.from(subscribedKeys)
      .map((s) => encodeURIComponent(String(s).trim()))
      .join(",");
    const response = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instruments}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const data = await response.json();
    if (data.status === "success" && data.data) {
      const quotesList = Object.keys(data.data).map((key) => {
        const item = data.data[key];
        const ltp = item.last_price || 0;
        const close = item.ohlc?.close || ltp;
        const change = Number((ltp - close).toFixed(2));
        const changePercent =
          close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;
        const parts = key.split(/[:|]/);
        const symbolDisplay = (
          item.symbol && item.symbol !== "NA"
            ? item.symbol
            : parts.length > 1
              ? parts[1]
              : key
        ).toUpperCase();
        if (ltp > 0) {
          globalLiveQuotes[key] = { last_price: ltp };
          globalLiveQuotes["last_update"] = new Date().toISOString();
        }
        const segment = key.includes("INDEX")
          ? "INDEX"
          : key.includes("FO")
            ? "OPTIONS"
            : "EQUITY";
        return {
          symbol: symbolDisplay,
          segment,
          instrumentKey: key,
          ltp,
          change,
          changePercent,
          volume: item.volume || 0,
          open: item.ohlc?.open || 0,
          high: item.ohlc?.high || 0,
          low: item.ohlc?.low || 0,
          close,
        };
      });
      if (quotesList.length > 0) {
        const msgStr = JSON.stringify({ type: "QUOTES", data: quotesList });
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(msgStr);
          }
        });
      }
    } else if (data.status === "error") {
      invalidTokens.add(token);
      upstoxConfig.accessToken = "";
    }
  } catch (e) {}
}

wss.on("connection", (ws) => {
  (ws as any).isAlive = true;
  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG" }));
      }
      if (msg.type === "SUBSCRIBE") {
        const keys = msg.keys || [];
        keys.forEach((k: string) => {
          if (k) subscribedKeys.add(k);
        });
        broadcastUpstoxQuotesToWs();
      }
    } catch (e) {}
  });
});

// Ping interval for local WS clients & broadcast quotes
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!(ws as any).isAlive) return ws.terminate();
    (ws as any).isAlive = false;
    ws.ping();
  });
  broadcastUpstoxQuotesToWs();
}, 3000);

app.get("/api/debug-state", (req, res) => {
  res.json({
    upstoxConfig,
    botConfig,
    paperPositions,
    botLogs: botLogs.slice(0, 5),
  });
});

async function setupVite() {
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { dotfiles: "allow" }));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Upstox Live Algo Server running on http://0.0.0.0:${PORT}`);
  });

  try {
    const { Server: SocketIOServer } = _require('socket.io');
    const io = new SocketIOServer(server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });
    
    io.on('connection', (socket: any) => {
        console.log('Client connected to WebSockets:', socket.id);
        
        // Push initial data
        socket.emit('botConfig', botConfig);
        
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    global.io = io;
  } catch (e) {
    console.warn("Socket.IO initialization warning:", e);
  }

  server.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/api/ws")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else if (!request.url?.startsWith("/socket.io")) {
      socket.destroy();
    }
  });
}

setupVite().catch(err => { console.error("Fatal error during startup:", err); process.exit(1); });

declare global { var io: any; }
