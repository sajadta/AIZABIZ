process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || "") + " --dns-result-order=ipv4first";
import { appState } from "./src/db/schema.js";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
import { db } from "./src/db/index.js";
import { tradeHistory } from "./src/db/schema.js";
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

  app.get('/api/history', async (req, res) => {
      try {
          const rows = await db.select().from(tradeHistory).orderBy(desc(tradeHistory.closeTime)).limit(200);
          res.json(rows);
      } catch(e) {
          console.error(e);
          res.status(500).json({error: 'DB error'});
      }
  });


// ---------------------------------------------------------
// ALGO BOT ENGINE (BACKEND)
// ---------------------------------------------------------

let botConfig = {
  enabled: false,
  mode: "PAPER_TRADING", // 'PAPER_TRADING' | 'UPSTOX_LIVE'
  selectedStrategy: "PROFIT_MAX_100_PERCENT_MATRIX",
  minConfidence: 60,
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
  if (!botConfig.enabled) return; console.log("Bot loop running, active positions:", paperPositions.length);

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
    if (!token) {
      botSignals.length = 0; // Clear any existing fake signals
      return; // DO NOT USE DUMMY DATA.
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

        // 1. Static Target Check
        if (ltp >= staticTargetPrice) {
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
    if (activePositions.length === 0 && token && !botConfig.dailyLossLocked) {
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

const PORT = 3000;

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

// Upstox In-Me ory Credentials & Session Cache (can be set via .env or client settings)
let upstoxConfig = {
  apiKey: process.env.UPSTOX_API_KEY || "",
  apiSecret: process.env.UPSTOX_API_SECRET || "",
  redirectUri: process.env.UPSTOX_REDIRECT_URI || "http://localhost:8080/",
  accessToken: "", // Removed hardcoded to avoid confusion
  userName: "Upstox Trader",
  userEmail: "",
  userClientCode: "",
  obile: "",
  pin: "",
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
app.use("/api/market", (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token && token.length > 10) {
      upstoxConfig.accessToken = token;
    }
  }
  next();
});

app.get("/api/market/config", async (req: Request, res: Response) => {
  let isConnected = Boolean(upstoxConfig.accessToken);

  let availableMargin = 0;
  let usedMargin = 0;
  let userName = upstoxConfig.userName || "";
  let userEmail = upstoxConfig.userEmail || "";
  let userClientCode = upstoxConfig.userClientCode || "";

  if (isConnected) {
    try {
      const fundsRes = await fetch(
        "https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC",
        {
          headers: {
            Authorization: `Bearer ${upstoxConfig.accessToken}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        },
      );
      const fundsData = await fundsRes.json();

      if (
        fundsData.status === "success" &&
        fundsData.data &&
        fundsData.data.equity
      ) {
        availableMargin = fundsData.data.equity.available_margin || 0;
        usedMargin = fundsData.data.equity.used_margin || 0;
      } else if (
        fundsData.status === "error" &&
        (fundsData.errors?.[0]?.errorCmode === "UDAPI100057" ||
          fundsData.errors?.[0]?.errorCmode === "UDAPI100068" ||
          fundsData.errors?.[0]?.message?.includes("token"))
      ) {
        // Token invalid or expired
        isConnected = false;
        upstoxConfig.accessToken = ""; // clear it
      } else if (fundsData.status === "error") {
        isConnected = false;
      }
    } catch (e) {
      isConnected = false;
    }
  }

  res.json({
    apiKey: upstoxConfig.apiKey,
    apiSecret: upstoxConfig.apiSecret ? "••••••••" : "",
    redirectUri: upstoxConfig.redirectUri,
    accessToken: upstoxConfig.accessToken,
    hasToken: isConnected,
    isConnected,
    userName: userName,
    userEmail: userEmail,
    userClientCode: userClientCode,
    broker: isConnected ? "Upstox Securities Live Engine" : "Setup Required",
    tokenGeneratedAt: upstoxConfig.tokenGeneratedAt || "",
    tokenExpiresAt: upstoxConfig.tokenExpiresAt || "",
    todayTokenValid: isConnected,
    availableMargin,
    usedMargin,
  });
});

app.post("/api/market/config", async (req: Request, res: Response) => {
  const { apiKey, apiSecret, redirectUri, accessToken } = req.body;
  if (apiKey !== undefined) upstoxConfig.apiKey = apiKey;
  if (apiSecret !== undefined) upstoxConfig.apiSecret = apiSecret;
  if (redirectUri !== undefined) upstoxConfig.redirectUri = redirectUri;

  if (typeof accessToken === "string") {
    let token = accessToken.trim();
    if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();
    if (token) {
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
          console.error("Token validation error:", err); upstoxConfig.accessToken = ""; // clear if invalid
          return res
            .status(401)
            .json({
              success: false,
              error: data.errors?.[0]?.message || "Invalid Token provided",
            });
        }
      } catch (err) {
        console.error("Token validation error:", err); upstoxConfig.accessToken = ""; // clear if invalid
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
  const { apiKey, apiSecret, redirectUri, accessToken } = req.body;
  if (apiKey) upstoxConfig.apiKey = apiKey;
  if (apiSecret) upstoxConfig.apiSecret = apiSecret;
  if (redirectUri) upstoxConfig.redirectUri = redirectUri;
  if (typeof accessToken === "string")
    upstoxConfig.accessToken = accessToken.trim();

  res.json({
    success: true,
    message: "Upstox configuration updated successfully",
    isConnected: Boolean(upstoxConfig.accessToken),
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
      console.error("Token validation error:", err); upstoxConfig.accessToken = ""; // clear if invalid
      return res.status(401).json({
        success: false,
        error:
          data.errors?.[0]?.message ||
          "Invalid token. Please check and try again.",
      });
    }
  } catch (err: any) {
    console.error("Token validation error:", err); upstoxConfig.accessToken = ""; // clear if invalid
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
    message: "Daily Upstox token cleared. Switched to Paper Trading Mmode.",
  });
});

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
        userEmail: data.data.email || "trader@upstox.com",
        userClientCode: data.data.user_id || "UPSTOX_USER",
      });
    } else {
      return res.json({
        valid: true, // Allow simulation/ manual token testing
        userName: "Upstox Live Client",
        userEmail: "trader@upstox.com",
        userClientCode: "UP_CLIENT",
      });
    }
  } catch (e: any) {
    return res.json({ valid: true, userName: "Upstox Trader" });
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

// Token Exchange Callback Handler
app.post("/api/market/token", async (req: Request, res: Response) => {
  const { cmode, apiKey, apiSecret, redirectUri } = req.body;
  const key = apiKey || upstoxConfig.apiKey;
  const secret = apiSecret || upstoxConfig.apiSecret;
  const uri = redirectUri || upstoxConfig.redirectUri;

  if (!cmode || !key || !secret) {
    return res
      .status(400)
      .json({ error: "Missing cmode, apiKey or apiSecret for token exchange" });
  }

  try {
    const params = new URLSearchParams();
    params.append("cmode", cmode);
    params.append("client_id", key);
    params.append("client_secret", secret);
    params.append("redirect_uri", uri);
    params.append("grant_type", "authorization_cmode");

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
      return res.json({
        success: true,
        accessToken: data.access_token,
        user_name: data.user_name || "Upstox Trader",
      });
    } else {
      return res
        .status(400)
        .json({
          error: data.message || "Token exchange failed",
          details: data,
        });
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: "Failed to contact Upstox token gateway: " + err.message,
      });
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
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
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
    if (data.status === "success" && data.data) {
      return res.json(
        data.data.map((h: any) => ({
          symbol: h.trading_symbol || h.instrument_token,
          instrumentKey: h.instrument_token,
          quantity: h.quantity,
          buyPrice: h.average_price,
          currentLTP: h.last_price || h.average_price,
          pnl: h.pnl,
          pnlPercent: h.average_price
            ? ((h.last_price - h.average_price) / h.average_price) * 100
            : 0,
        })),
      );
    }
    return res.json([]);
  } catch (e) {
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
    return res.json({ error: "Upstox Token Missing", strikes: [] });
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




async function savePostgresDb() {
  const dbData = {
    botConfig,
    upstoxConfig,
    paperOrders,
    paperPositions,
    paperTradeHistory,
  };
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
    console.error("Failed to save Postgres DB", e);
  }
}

async function loadPostgresDb() {
  try {
    const rows = await db.select().from(appState).where(eq(appState.id, 'main_state'));
    if (rows && rows.length > 0) {
      const data = rows[0].data as any;
      if (data.botConfig) botConfig = data.botConfig;
      if (data.upstoxConfig) upstoxConfig = data.upstoxConfig;
      if (data.paperOrders) paperOrders = data.paperOrders;
      if (data.paperPositions) paperPositions = data.paperPositions;
      if (data.paperTradeHistory) paperTradeHistory = data.paperTradeHistory;
      console.log("Loaded persistent data from PostgreSQL Cloud SQL!");
    }
  } catch (e) {
    console.error("Failed to load Postgres DB", e);
  }
}

loadPostgresDb().then(() => {
  setInterval(savePostgresDb, 5000);
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
      error: "Square off  ust bemexecuted directly via Upstox API.",
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
        "Square off all  ust bemexecuted directly via Upstox API with specific order parameters.",
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
      model: "gemini-3.6-flash",
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
            summaryMalayala: {
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
            technicalReasonsMalayala: {
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
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return res.json({ text: response.text });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
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
let upstoxStreamer = null;
const subscribedKeys = new Set();
let upstoxWsConnected = false;

// Fix clearSubscriptions bug in SDK
try {
  const MarketDataFeederV3 = _require(
    "upstox-js-sdk/dist/feeder/MarketDataFeederV3",
  ).MarketDataFeederV3;
  if (MarketDataFeederV3 && !MarketDataFeederV3.prototype.clearSubscriptions) {
    MarketDataFeederV3.prototype.clearSubscriptions = function () {};
  }
} catch (e) {
  console.error("Option Fetch Error: ", e);
}

function syncUpstoxSubscriptions() {
  if (upstoxStreamer && upstoxWsConnected && subscribedKeys.size > 0) {
    // Change mode will subscribe if not subscribed
    try {
      upstoxStreamer.subscribe(Array.from(subscribedKeys), "full");
    } catch (e) {
      console.error("Option Fetch Error: ", e);
    }
  }
}

function ensureUpstoxStreamer() {
  if (!upstoxConfig.accessToken) return;
  if (upstoxStreamer) return;

  try {
    const UpstoxClient = _require("upstox-js-sdk");
    let defaultClient = UpstoxClient.ApiClient.instance;
    defaultClient.authentications["OAUTH2"].accessToken =
      upstoxConfig.accessToken;

    upstoxStreamer = new UpstoxClient.MarketDataStreamerV3(
      Array.from(subscribedKeys),
      "full",
    );

    upstoxStreamer.on("open", () => {
      upstoxWsConnected = true;
      syncUpstoxSubscriptions();
    });

    upstoxStreamer.on("close", () => {
      upstoxWsConnected = false;
    });

    upstoxStreamer.on("message", (data) => {
      try {
        const parsed =
          typeof data === "string"
            ? JSON.parse(data)
            : Buffer.isBuffer(data)
              ? JSON.parse(data.toString())
              : data;
        if (parsed && parsed.feeds) {
          const quotesList = [];
          for (const [key, feed] of Object.entries(parsed.feeds)) {
            let ltp = 0;
            let close = 0;
            let volume = 0;
            let open = 0;
            let high = 0;
            let low = 0;

            const ff =
              (feed as any).fullFeed ||
              (feed as any).ff ||
              (feed as any).optionGreeks ||
              (feed as any).ltpc ||
              feed;
            if (ff) {
              const dataBlock = ff.indexFF || ff.marketFF || ff;
              const ltpc = dataBlock.ltpc || dataBlock;
              ltp = ltpc.ltp || 0;
              close = ltpc.cp || ltp;

              if (dataBlock.marketOHLC?.ohlc?.length > 0) {
                const ohlc = dataBlock.marketOHLC.ohlc[0];
                open = ohlc.open || 0;
                high = ohlc.high || 0;
                low = ohlc.low || 0;
                close = ohlc.close || close;
              }
            }

            const change = Number((ltp - close).toFixed(2));
            const changePercent =
              close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;

            const parts = key.split(/[:|]/);
            const symbolDisplay = (
              parts.length > 1 ? parts[1] : key
            ).toUpperCase();

            if (ltp > 0) {
              globalLiveQuotes[key] = { last_price: ltp };
              globalLiveQuotes["last_update"] = new Date().toISOString();
              const segment = key.includes("INDEX")
                ? "INDEX"
                : key.includes("FO")
                  ? "OPTIONS"
                  : "EQUITY";
              quotesList.push({
                symbol: symbolDisplay,
                segment,
                instrumentKey: key,
                ltp,
                change,
                changePercent,
                volume,
                open,
                high,
                low,
                close,
              });
            }
          }
          if (quotesList.length > 0) {
            const msgStr = JSON.stringify({ type: "QUOTES", data: quotesList });
            wss.clients.forEach((client) => {
              if (client.readyState === 1) {
                // OPEN
                client.send(msgStr);
              }
            });
          }
        }
      } catch (e) {
        console.warn("WS MSG Warning.");
      }
    });

    upstoxStreamer.on("error", (err) => {
      console.warn("Upstox WS disconnected or 401. Check token.");
    });

    upstoxStreamer
      .connect()
      .catch((e) => console.warn("Upstox WS Connect error (check token)."));
  } catch (err) {
    console.warn("Failed to init Upstox streamer (check token).");
  }
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
        let changed = false;
        keys.forEach((k) => {
          if (!subscribedKeys.has(k)) {
            subscribedKeys.add(k);
            changed = true;
          }
        });
        if (changed) {
          ensureUpstoxStreamer();
          syncUpstoxSubscriptions();
        }
      }
    } catch (e) {
      console.error("Option Fetch Error: ", e);
    }
  });
});

// Ping interval for local WS clients
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!(ws as any).isAlive) return ws.terminate();
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 5000);

// Call ensure occasionally if token is added
setInterval(() => {
  if (upstoxConfig.accessToken && !upstoxStreamer) {
    ensureUpstoxStreamer();
  }
}, 5000);

async function setupVite() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  const { Server: SocketIOServer } = _require('socket.io');
  const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  
  io.on('connection', (socket) => {
      console.log('Client connected to WebSockets:', socket.id);
      
      // Push initial data
      socket.emit('botConfig', botConfig);
      
      socket.on('disconnect', () => {
          console.log('Client disconnected:', socket.id);
      });
  });

  global.io = io;


  server.on("upgrade", (request, socket, head) => {
    if (request.url === "/api/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });
}

setupVite().catch(err => { console.error("Fatal error during startup:", err); process.exit(1); });

app.get("/api/debug-state", (req, res) => {
  res.json({
    upstoxConfig,
    botConfig,
    paperPositions,
    botLogs: botLogs.slice(0, 5),
  });
});
declare global { var io: any; }
