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
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
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
  maxCapitalPerTrade: 25000,
  riskPerTradePercent: 1.5,
  stopLossPercent: 10,
  targetProfitPercent: 30,
  trailingStopLoss: true,
  trailingStepPercent: 5,
  tradeQuantity: 50,
  multiTimeframeEnabled: true,
  optionStrikeSelector: true,
  tradeMmode: "OPTIONS_ONLY", // 'OPTIONS_ONLY'
  maxOptionLossCount: 3,
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
  const incoming = req.body || {};
  if (incoming.enabled === true || incoming.dailyLossLocked === false) {
    incoming.dailyLossLocked = false;
    incoming.circuitBreakerResetAt = Date.now();
  }
  botConfig = { ...botConfig, ...incoming };
  botConfig.maxOptionLossCount = Math.min(
    3,
    Math.max(1, Number(botConfig.maxOptionLossCount || 3)),
  );
  botLogs.unshift({
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString(),
    message: "Bot configuration updated.",
    type: "INFO",
  });
  if (botLogs.length > 200) botLogs.length = 200;
  savePostgresDb().catch(() => {});
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

// Cache Option Contracts and Option Chains to prevent Upstox 429 rate-limit errors
const optionContractCache: Record<string, { timestamp: number; data: any }> = {};
const optionChainCache: Record<string, { timestamp: number; data: any }> = {};
const optionIntradayCandleCache: Record<string, { timestamp: number; raw: any[] }> = {};
let lastTradeExitTime = 0;
const recentClosedStrikes: Record<
  string,
  { exitTime: number; highestLTP: number; sellPrice: number }
> = {};

// Bot Loop Interval
setInterval(async () => {
  if (!botConfig.enabled) return;

  try {
    // 1. Process active positions for Auto-Square Off (Target/SL)
    let activePositions: any[] =
      botConfig.mode === "PAPER_TRADING" ? [...paperPositions] : [];

    // Fetch live positions if in UPSTOX_LIVE mode (strictly real Upstox positions only, never dummy/paper)
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
              product: p.product || "D",
              productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
              type: p.quantity > 0 ? "BUY" : p.quantity < 0 ? "SELL" : "CLOSED",
              quantity: Math.abs(p.quantity || p.net_quantity || 0),
              buyPrice: p.average_price || p.buy_amount / (p.buy_quantity || 1),
              currentLTP: p.last_price || p.average_price,
              pnl: p.pnl || p.m2m,
              mode: "UPSTOX_LIVE",
              isOption:
                /\b(CE|PE)\b/i.test(p.trading_symbol || "") ||
                String(p.instrument_token || "").includes("FO"),
            }))
            .filter((p: any) => p.type !== "CLOSED" && p.quantity > 0);
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

    let liveQuotesMap: any = { ...(lastQuotesCache.data || {}) };
    if (token && Object.keys(liveQuotesMap).length === 0) {
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
        }
      } catch (e) {}
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
    paperPositions = paperPositions.filter(
      (p) =>
        p &&
        p.instrumentKey &&
        !String(p.instrumentKey).includes("INDEX") &&
        !(p.buyPrice === 100 && p.currentLTP === 100),
    );

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
        // Cap stopLossPercent at 3.8% so a single failed breakout NEVER turns into a -11% (₹2,750) loss!
        const effectiveSlPct = Math.min(3.8, Math.max(2.0, Number(botConfig.stopLossPercent || 3.5)));
        const staticStopLossPrice =
          pos.buyPrice * (1 - effectiveSlPct / 100);
        const staticTargetPrice =
          pos.buyPrice * (1 + (botConfig.targetProfitPercent || 30) / 100);

        // 1. BROKERAGE-AWARE NET PROFIT RETENTION VAULT & 100% PEAK HARVEST
        // Always calculate Net Profit AFTER deducting full round-trip brokerage & statutory taxes!
        const posPnL = (ltp - pos.buyPrice) * (pos.quantity || 1);
        const posChargesNow = calculateTradeCharges(
          pos.buyPrice,
          pos.quantity || 1,
          true,
          ltp,
        );
        const roundTripTax = posChargesNow.roundTripCharges;
        const posNetPnL = posPnL - roundTripTax;
        pos.highestPnl = Math.max(pos.highestPnl || 0, posPnL);
        pos.highestNetPnl = Math.max(pos.highestNetPnl || 0, posNetPnL);

        // Tiered Net-Profit Vault: Locks net profit AFTER brokerage & taxes
        if (pos.highestNetPnl >= 8000) {
          const maxAllowedPullback = Math.min(350, pos.highestNetPnl * 0.04);
          if (posNetPnL <= pos.highestNetPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[ULTRA PROFIT VAULT] Peak net profit touched +₹${pos.highestNetPnl.toFixed(0)}! Locked +₹${posNetPnL.toFixed(2)} net (Gross +₹${posPnL.toFixed(2)}) on micro-exhaustion.`;
          }
        } else if (pos.highestNetPnl >= 4000) {
          const maxAllowedPullback = Math.min(200, pos.highestNetPnl * 0.05);
          if (posNetPnL <= pos.highestNetPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[HIGH PROFIT LOCK] Peak net was +₹${pos.highestNetPnl.toFixed(0)}. Secured +₹${posNetPnL.toFixed(2)} net profit!`;
          }
        } else if (pos.highestNetPnl >= 1500) {
          const maxAllowedPullback = Math.min(120, pos.highestNetPnl * 0.08);
          if (posNetPnL <= pos.highestNetPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[PEAK HARVEST] Peak net reached +₹${pos.highestNetPnl.toFixed(0)}. Captured +₹${posNetPnL.toFixed(2)} net profit!`;
          }
        } else if (pos.highestNetPnl >= 600) {
          const maxAllowedPullback = Math.min(85, pos.highestNetPnl * 0.14);
          if (posNetPnL <= pos.highestNetPnl - maxAllowedPullback) {
            shouldSell = true;
            sellReason = `[PROFIT SHIELD] Net profit reached +₹${pos.highestNetPnl.toFixed(0)}. Locked +₹${posNetPnL.toFixed(2)} net (Gross +₹${posPnL.toFixed(2)}) before reversal!`;
          }
        } else if (pos.highestNetPnl >= 260) {
          // Early Net-Profit Lock: Only triggers once NET profit (after full brokerage & tax) is >= +₹260, and locks at least +₹180 NET profit!
          const maxAllowedPullback = Math.min(75, pos.highestNetPnl * 0.25);
          if (posNetPnL <= Math.max(180, pos.highestNetPnl - maxAllowedPullback)) {
            shouldSell = true;
            sellReason = `[FAST PROFIT HARVEST] Trade reached +₹${pos.highestNetPnl.toFixed(0)} net profit. Locked +₹${posNetPnL.toFixed(2)} net (Gross +₹${posPnL.toFixed(2)}) above brokerage!`;
          }
        }

        // Hard Floor Guarantee: Once net profit gained >= ₹1,000, NEVER allow net profit to drop below 85% of peak
        if (!shouldSell && pos.highestNetPnl >= 1000) {
          const absoluteFloor = Math.max(800, pos.highestNetPnl * 0.85);
          if (posNetPnL <= absoluteFloor) {
            shouldSell = true;
            sellReason = `[ABSOLUTE PROFIT FLOOR] Protected +₹${posNetPnL.toFixed(2)} net profit from peak of +₹${pos.highestNetPnl.toFixed(0)}!`;
          }
        }

        // Post-Entry Theta Stagnation Shield: If trade has been open >= 8 minutes without breaking out (highestNetPnl < 250)
        // and is currently sitting above brokerage break-even (posNetPnL >= 35), exit in net profit before Theta decay erodes premium!
        const openedMs =
          Number(pos.openedAtMs || 0) ||
          (String(pos.id || "").startsWith("POS")
            ? Number(String(pos.id).replace(/\D+/g, ""))
            : 0);
        if (
          !shouldSell &&
          openedMs > 0 &&
          Date.now() - openedMs >= 8 * 60 * 1000 &&
          pos.highestNetPnl < 250 &&
          posNetPnL >= 35
        ) {
          shouldSell = true;
          sellReason = `[THETA STAGNATION SHIELD] Position held >8m in sideways range. Locked +₹${posNetPnL.toFixed(2)} net profit above brokerage before Theta decay!`;
        }

        if (!shouldSell && ltp >= staticTargetPrice) {
          shouldSell = true;
          sellReason = `Perfect Target Profit hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Maximum profit locked!`;
        }
        // 2. Trailing Stop Loss (Brokerage-Protected Smart Trailing)
        else if (!shouldSell && botConfig.trailingStopLoss) {
          const breakEvenWithBrokerage =
            pos.buyPrice +
            roundTripTax / Math.max(1, pos.quantity || 1);
          const minProfitablePrice =
            breakEvenWithBrokerage + 180 / Math.max(1, pos.quantity || 1);

          // Only activate trailing above break-even once the option has achieved at least +₹260 NET profit after brokerage
          const isCostToCostActive = pos.highestNetPnl >= 260;
          const trailingStopPrice = isCostToCostActive
            ? Math.max(
                pos.highestLTP * (1 - Math.min(3.0, botConfig.trailingStepPercent || 3) / 100),
                minProfitablePrice,
              )
            : staticStopLossPrice;

          if (ltp <= trailingStopPrice) {
            shouldSell = true;
            const profitDiff = ((ltp - pos.buyPrice) / pos.buyPrice) * 100;
            if (posNetPnL > 0) {
              sellReason = `Smart Trailing Stop triggered! Secured +₹${posNetPnL.toFixed(2)} net profit (${profitDiff.toFixed(2)}%) on ${pos.symbol}.`;
            } else {
              sellReason = `Smart Momentum Stop hit (${profitDiff.toFixed(2)}%) for ${pos.symbol}. Minimizing loss early.`;
            }
          }
        }
        // 3. Static Stop Loss (if trailing is off)
        else if (!shouldSell && ltp <= staticStopLossPrice) {
          shouldSell = true;
          sellReason = `Strict Stop Loss hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Squaring off to prevent further loss.`;
        }

        if (shouldSell) {
          lastTradeExitTime = Date.now();
          if (pos.instrumentKey) {
            recentClosedStrikes[pos.instrumentKey] = {
              exitTime: Date.now(),
              highestLTP: Math.max(pos.highestLTP || pos.buyPrice, ltp),
              sellPrice: ltp,
            };
          }
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
          if (pos.mode === "PAPER_TRADING" || paperPositions.some((p) => p.id === pos.id)) {
            const closedPos = paperPositions.find((p) => p.id === pos.id);
            if (closedPos) {
              closedPos.sellPrice = closedPos.currentLTP;
              closedPos.realizedPnL = Number((closedPos.pnl || 0).toFixed(2));
              closedPos.closeTime = new Date().toISOString();
              closedPos.mode = "PAPER_TRADING";
              paperTradeHistory.unshift(closedPos);
              if (paperTradeHistory.length > 200)
                paperTradeHistory.length = 200;
              paperOrders.unshift({
                id: "ORD" + Date.now(),
                orderId: "PAP_" + Date.now().toString().slice(-6),
                symbol: closedPos.symbol,
                instrumentKey: closedPos.instrumentKey,
                transactionType: "SELL",
                type: "SELL",
                orderType: "MARKET",
                productType: closedPos.productType || "INTRADAY",
                quantity: closedPos.quantity,
                price: closedPos.currentLTP,
                executedPrice: closedPos.currentLTP,
                status: "COMPLETE",
                timestamp: new Date().toLocaleTimeString("en-IN"),
                time: new Date().toISOString(),
                mode: "PAPER_TRADING",
              });
            }
            paperPositions = paperPositions.filter((p) => p.id !== pos.id);
            savePostgresDb().catch(() => {});
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
          if (pos.mode === "PAPER_TRADING" || paperPositions.some((p) => p.id === pos.id)) {
            const closedPos = paperPositions.find((p) => p.id === pos.id);
            if (closedPos) {
              closedPos.sellPrice = closedPos.currentLTP;
              closedPos.realizedPnL = Number((closedPos.pnl || 0).toFixed(2));
              closedPos.closeTime = new Date().toISOString();
              closedPos.mode = "PAPER_TRADING";
              paperTradeHistory.unshift(closedPos);
              if (paperTradeHistory.length > 200)
                paperTradeHistory.length = 200;
              paperOrders.unshift({
                id: "ORD" + Date.now(),
                orderId: "PAP_" + Date.now().toString().slice(-6),
                symbol: closedPos.symbol,
                instrumentKey: closedPos.instrumentKey,
                transactionType: "SELL",
                type: "SELL",
                orderType: "MARKET",
                productType: closedPos.productType || "INTRADAY",
                quantity: closedPos.quantity,
                price: closedPos.currentLTP,
                executedPrice: closedPos.currentLTP,
                status: "COMPLETE",
                timestamp: new Date().toLocaleTimeString("en-IN"),
                time: new Date().toISOString(),
                mode: "PAPER_TRADING",
              });
            }
            paperPositions = paperPositions.filter((p) => p.id !== pos.id);
            savePostgresDb().catch(() => {});
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
                  product: pos.product || (pos.productType === "INTRADAY" ? "I" : "D"),
                  validity: "DAY",
                  price: 0,
                  tag: "bot_stop_loss",
                  instrument_token: pos.instrumentKey,
                  order_type: "MARKET",
                  transaction_type: pos.type === "SELL" ? "BUY" : "SELL",
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
    // Check Circuit Breaker (Only count losses after last circuitBreakerResetAt so user reset works cleanly)
    const resetCutoff = Number((botConfig as any).circuitBreakerResetAt || 0);
    const activeSessionTrades = paperTradeHistory.filter((trade) => {
      const closeTs = trade.closeTime ? new Date(trade.closeTime).getTime() : 0;
      return closeTs > resetCutoff;
    });
    const todayOptionLossCount = activeSessionTrades.filter(
      (trade) => (trade.realizedPnL || 0) < 0,
    ).length;
    const maxAllowedOptionLosses = Math.min(
      3,
      Math.max(1, Number(botConfig.maxOptionLossCount || 3)),
    );
    let todayRealizedPnL = activeSessionTrades.reduce(
      (acc, trade) => acc + (trade.realizedPnL || 0),
      0,
    );
    if (
      todayRealizedPnL <= -botConfig.dailyMaxLossLimit ||
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
              ? `Circuit Breaker: Max daily option loss count (${maxAllowedOptionLosses} losses) reached. Bot halted for today.`
              : `Circuit Breaker: Daily max loss limit (₹${botConfig.dailyMaxLossLimit}) reached. Bot disabled for the day.`,
          type: "ERROR",
        });
      }
    }

    // 2. If no positions, look for entry
    // Enforce 120-second (2-minute) Anti-Overtrading Cooldown after any exit so the bot NEVER churns trades or wastes brokerage!
    const isInPostExitCooldown = Date.now() - lastTradeExitTime < 120000;

    // Check Market Open Time Window (09:15 AM to 15:15 PM IST on Trading Days Monday-Friday)
    const currentHour = nowIst.getHours();
    const currentMinute = nowIst.getMinutes();
    const currentDay = nowIst.getDay(); // 0: Sun, 6: Sat
    const isTradingDay = currentDay >= 1 && currentDay <= 5;
    const isTradingHours =
      (currentHour > 9 || (currentHour === 9 && currentMinute >= 15)) &&
      (currentHour < 15 || (currentHour === 15 && currentMinute <= 15));

    if (token) {
      // Fetch live Upstox available margin to ensure we only pick & execute trades that fit the account balance
      let liveAvailableMargin = 0;
      try {
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
        const fundsData = await fundsRes.json().catch(() => null);
        if (fundsData?.status === "success" && fundsData?.data?.equity) {
          liveAvailableMargin = Number(fundsData.data.equity.available_margin || 0);
        }
      } catch {}

      // Strict Capital Separation:
      // - In UPSTOX_LIVE mode: ONLY use actual cash in Upstox account (liveAvailableMargin). NEVER use dummy/paper cash!
      // - In PAPER_TRADING mode: Use allocated virtual/dummy capital (maxCapitalPerTrade || 25000).
      const effectiveCapital =
        botConfig.mode === "UPSTOX_LIVE"
          ? (botConfig as any).maxCapitalPerTrade > 0
            ? Math.min(liveAvailableMargin, Number((botConfig as any).maxCapitalPerTrade))
            : liveAvailableMargin
          : Number((botConfig as any).maxCapitalPerTrade || 25000);

      let scanIndices = [
        { key: "NSE_INDEX|Nifty 50", symbol: "NIFTY 50" },
        { key: "NSE_INDEX|Nifty Bank", symbol: "NIFTY BANK" },
        { key: "BSE_INDEX|SENSEX", symbol: "SENSEX" },
        { key: "NSE_INDEX|Nifty Fin Service", symbol: "NIFTY FIN SERVICE" },
        { key: "NSE_INDEX|NIFTY MID SELECT", symbol: "MIDCPNIFTY" },
        { key: "BSE_INDEX|BANKEX", symbol: "BANKEX" },
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
          let cData: any = null;
          const cachedIntraday = intradayCandleCache[idx.key];
          if (cachedIntraday && Date.now() - cachedIntraday.timestamp < 8000) {
            cData = { status: "success", data: { candles: cachedIntraday.raw } };
          } else {
            const cRes = await fetch(url, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" },
            });
            cData = await cRes.json();
            if (cData?.status === "success" && cData?.data?.candles?.length > 0) {
              intradayCandleCache[idx.key] = {
                timestamp: Date.now(),
                raw: cData.data.candles,
              };
            } else if (cachedIntraday?.raw?.length > 0) {
              cData = { status: "success", data: { candles: cachedIntraday.raw } };
            }
          }

          // If intraday returned no candles (e.g., after market hours or weekend), fetch recent 1-minute historical candles from Upstox so 7-Layer Quant Matrix signals remain populated
          if (!cData?.data?.candles || cData.data.candles.length === 0) {
            const fromDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0];
            const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(idx.key)}/1minute/${toDate}/${fromDate}`;
            try {
              const histRes = await fetch(histUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/json",
                  "Api-Version": "2.0",
                },
              });
              const histData = await histRes.json();
              if (histData?.status === "success" && histData?.data?.candles?.length > 0) {
                const recentCandles = histData.data.candles.slice(0, 180);
                cData = { status: "success", data: { candles: recentCandles } };
                intradayCandleCache[idx.key] = {
                  timestamp: Date.now(),
                  raw: recentCandles,
                };
              }
            } catch {}
          }

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

            // Get live quote for this specific index FIRST and merge into rawCandles BEFORE enrichCandlesWithIndicators
            // so that EMA9, EMA21, SuperTrend, RSI, and MACD are calculated on the real-time tick price!
            let liveLtp =
              globalLiveQuotes[idx.key]?.last_price ||
              rawCandles[rawCandles.length - 1].close;
            if (!globalLiveQuotes[idx.key]?.last_price) {
              try {
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
              } catch {}
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
                optionType: "CE",
                ltp: 0,
                expiry: "Current Weekly",
                lotSize: 1,
                corporateHeavyweightScore,
                corporateHeavyweightSummary,
                globalMacroAlignment,
              },
            );

            let verifiedRealOptionStrike = false;

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
                    const contractRes = await fetch(
                      `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(idxKey)}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          Accept: "application/json",
                        },
                      },
                    );
                    const cJson = await contractRes.json();
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
                      const chainRes = await fetch(
                        `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(idxKey)}&expiry_date=${expiryDate}`,
                        {
                          headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json",
                            "Api-Version": "2.0",
                          },
                        },
                      );
                      const chJson = await chainRes.json();
                      if (chJson?.data && Array.isArray(chJson.data)) {
                        chainData = chJson;
                        optionChainCache[chainCacheKey] = {
                          timestamp: Date.now(),
                          data: chJson,
                        };
                      }
                    }
                    if (chainData?.data && Array.isArray(chainData.data)) {
                      const isBullish = signal.signalType === "BUY";
                      const optType: "CE" | "PE" = isBullish ? "CE" : "PE";
                      const lotSz = liveIdxLotSize > 0 ? liveIdxLotSize : 1;

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
                      const affordableRows =
                        effectiveCapital > 0
                          ? allValidRows
                              .filter((r: any) => {
                                const optObj = isBullish ? r.call_options : r.put_options;
                                const ltp = Number(optObj?.market_data?.ltp || 0);
                                const absDelta = Math.abs(
                                  Number(optObj?.option_greeks?.delta ?? 0.35),
                                );
                                const charges = calculateTradeCharges(
                                  ltp,
                                  lotSz,
                                  true,
                                  ltp * 1.27,
                                );
                                return (
                                  ltp >= 5 &&
                                  charges.totalRequiredWithBrokerage <= effectiveCapital &&
                                  absDelta >= 0.18
                                );
                              })
                              .sort((a: any, b: any) => {
                                const optA = isBullish ? a.call_options : a.put_options;
                                const optB = isBullish ? b.call_options : b.put_options;
                                return (
                                  Number(optB?.market_data?.ltp || 0) -
                                  Number(optA?.market_data?.ltp || 0)
                                );
                              })
                              .slice(0, 6)
                          : [];

                      const candidateRows = Array.from(
                        new Set([...nearAtmRows, ...affordableRows]),
                      );

                      let bestCandidate: any = null;
                      let bestScore = -9999;

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
                          ltp > 0 ? ((askPrice - bidPrice) / ltp) * 100 : 0;

                        // Skip illiquid strikes or strikes with wide bid-ask spreads (> 1.5%) where entry immediately loses to spread!
                        if (volume < 2000 && oi < 10000) continue;
                        if (bidAskSpreadPct > 1.5) continue;

                        // Anti-Whipsaw Peak Breakout Guard: If this exact option strike was closed in the last 10 minutes,
                        // NEVER re-buy it unless its price has broken out strictly above the previous trade's peak (highestLTP * 1.008)!
                        const optKeyCandidate = optObj?.instrument_key;
                        const recentClosed = optKeyCandidate
                          ? recentClosedStrikes[optKeyCandidate]
                          : null;
                        if (
                          recentClosed &&
                          Date.now() - recentClosed.exitTime < 10 * 60 * 1000 &&
                          ltp < recentClosed.highestLTP * 1.008
                        ) {
                          continue;
                        }
                        const strikeCharges = calculateTradeCharges(
                          ltp,
                          lotSz,
                          true,
                          ltp * 1.27,
                        );
                        const oneLotCost = strikeCharges.tradeValue;
                        const estimatedBrokerage = strikeCharges.roundTripCharges;
                        const totalRequiredWithBrokerage =
                          strikeCharges.totalRequiredWithBrokerage;
                        const expectedNetProfit = Number(
                          (ltp * 0.27 * lotSz - estimatedBrokerage).toFixed(2),
                        );

                        const fitsCapital =
                          botConfig.mode === "UPSTOX_LIVE"
                            ? effectiveCapital > 0 &&
                              totalRequiredWithBrokerage <= effectiveCapital
                            : effectiveCapital <= 0 ||
                              totalRequiredWithBrokerage <= effectiveCapital;

                        // Score strike on Net Profitability after Brokerage + Delta sweet spot + strict account balance affordability (incl. brokerage)
                        let score = 0;
                        if (fitsCapital) score += 250; // Strictly prioritize strikes where (Premium + Brokerage) fits real account cash!
                        else score -= 150;

                        if (expectedNetProfit >= (botConfig.minOptionProfitAmount || 300)) {
                          score += 35; // High net profit after deducting full round-trip brokerage & taxes
                        } else if (expectedNetProfit < 120) {
                          score -= 75; // Avoid tiny strikes where brokerage eats most of the profit
                        }

                        if (absDelta >= 0.45 && absDelta <= 0.72) score += 55;
                        else if (absDelta >= 0.30 && absDelta < 0.45) score += 40; // High-momentum affordable slightly OTM
                        else if (absDelta >= 0.20 && absDelta < 0.30) score += 20; // Affordable momentum OTM for smaller accounts
                        else if (absDelta < 0.18) score -= 60; // Avoid deep OTM Theta traps

                        if (iv > 8 && iv <= 35) score += 15;
                        else if (iv > 45) score -= 20;

                        if (volume > 10000 || oi > 50000) score += 15;
                        // Bonus for option contract whose premium is actively rising above its previous close / intraday momentum
                        if (closePrice > 0 && ltp > closePrice) score += 25;

                        const distRatio =
                          Math.abs(Number(row.strike_price) - liveLtp) / (liveLtp || 1);
                        score -= distRatio * 600; // Prefer closer to ATM among affordable strikes

                        if (score > bestScore) {
                          bestScore = score;
                          bestCandidate = {
                            strikePrice: Number(row.strike_price),
                            ltp,
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
                          };
                        }
                      }

                      if (bestCandidate && bestCandidate.instrumentKey) {
                        // CRITICAL LAYER-2 LIVE OPTION CANDLE & REAL-TIME QUOTE VERIFICATION:
                        // Never trust a cached optionChain LTP! Fetch the option strike's real-time quote AND its own 1-minute candles
                        // to prove that the Option Premium itself is actively rising and breaking out right now!
                        let liveOptLtp = Number(
                          globalLiveQuotes[bestCandidate.instrumentKey]?.last_price ||
                            bestCandidate.ltp,
                        );
                        try {
                          const optQRes = await fetch(
                            `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(bestCandidate.instrumentKey)}`,
                            {
                              headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: "application/json",
                                "Api-Version": "2.0",
                              },
                            },
                          );
                          const optQJson = await optQRes.json();
                          const qItem =
                            optQJson?.data?.[bestCandidate.instrumentKey] ||
                            Object.values(optQJson?.data || {})[0];
                          if ((qItem as any)?.last_price > 0) {
                            liveOptLtp = Number((qItem as any).last_price);
                            globalLiveQuotes[bestCandidate.instrumentKey] = qItem;
                          }
                        } catch {}

                        bestCandidate.ltp = liveOptLtp;

                        // Check the Option Contract's own 1-minute intraday candles to verify option premium momentum
                        let optionMomentumConfirmed = true;
                        try {
                          let optRawCandles: any[] = [];
                          const cachedOptC =
                            optionIntradayCandleCache[bestCandidate.instrumentKey];
                          if (
                            cachedOptC &&
                            Date.now() - cachedOptC.timestamp < 5000
                          ) {
                            optRawCandles = cachedOptC.raw;
                          } else {
                            const optCRes = await fetch(
                              `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(bestCandidate.instrumentKey)}/1minute`,
                              {
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                  Accept: "application/json",
                                  "Api-Version": "2.0",
                                },
                              },
                            );
                            const optCJson = await optCRes.json();
                            if (
                              optCJson?.status === "success" &&
                              Array.isArray(optCJson?.data?.candles) &&
                              optCJson.data.candles.length > 0
                            ) {
                              optRawCandles = optCJson.data.candles;
                              optionIntradayCandleCache[bestCandidate.instrumentKey] = {
                                timestamp: Date.now(),
                                raw: optRawCandles,
                              };
                            }
                          }

                          if (optRawCandles.length >= 3) {
                            // Upstox returns newest candle first at index 0
                            const c0 = optRawCandles[0]; // current 1m candle: [time, open, high, low, close, vol]
                            const c1 = optRawCandles[1]; // 1m ago
                            const c2 = optRawCandles[2]; // 2m ago
                            const optOpen0 = Number(c0[1] || liveOptLtp);
                            const optHigh0 = Math.max(Number(c0[2] || liveOptLtp), liveOptLtp);
                            const optLow0 = Math.min(Number(c0[3] || liveOptLtp), liveOptLtp);
                            const optClose1 = Number(c1[4] || liveOptLtp);
                            const optClose2 = Number(c2[4] || liveOptLtp);
                            const recentOpt3mHigh = Math.max(
                              optHigh0,
                              Number(c1[2] || 0),
                              Number(c2[2] || 0),
                            );
                            const optCandleRange = Math.max(0.05, optHigh0 - optLow0);
                            const optClosePos = (liveOptLtp - optLow0) / optCandleRange;

                            // Strict Option Premium Breakout Requirements:
                            // 1. Option's current 1m candle must be green (liveOptLtp >= optOpen0)
                            // 2. Option's live price must be rising vs 1m or 2m ago (liveOptLtp >= optClose1 && liveOptLtp >= optClose2)
                            // 3. Option must not be in a deep pullback from its 3-minute high (liveOptLtp >= recentOpt3mHigh * 0.985)
                            // 4. Option must be in the upper half of its current 1m candle range (optClosePos >= 0.50)
                            if (
                              liveOptLtp < optOpen0 ||
                              liveOptLtp < optClose1 ||
                              liveOptLtp < optClose2 ||
                              liveOptLtp < recentOpt3mHigh * 0.985 ||
                              optClosePos < 0.50
                            ) {
                              optionMomentumConfirmed = false;
                            }
                          }
                        } catch {}

                        // Also re-check recentClosedStrikes with the fresh liveOptLtp
                        const recentClosed =
                          recentClosedStrikes[bestCandidate.instrumentKey];
                        if (
                          recentClosed &&
                          Date.now() - recentClosed.exitTime < 10 * 60 * 1000 &&
                          liveOptLtp < recentClosed.highestLTP * 1.008
                        ) {
                          optionMomentumConfirmed = false;
                        }

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
                        const freshCharges = calculateTradeCharges(
                          liveOptLtp,
                          lotSz,
                          true,
                          liveOptLtp * 1.27,
                        );
                        bestCandidate.oneLotCost = freshCharges.tradeValue;
                        bestCandidate.estimatedBrokerage = freshCharges.roundTripCharges;
                        bestCandidate.totalRequiredWithBrokerage =
                          freshCharges.totalRequiredWithBrokerage;
                        bestCandidate.expectedNetProfit = Number(
                          (liveOptLtp * 0.27 * lotSz - freshCharges.roundTripCharges).toFixed(2),
                        );

                        // Anti-Brokerage-Loss Guard: Expected Net Profit (after deducting full round-trip brokerage & taxes)
                        // must be at least ₹300 AND at least 2.5x the total round-trip brokerage charges!
                        if (
                          bestCandidate.expectedNetProfit <
                            Math.max(
                              botConfig.minOptionProfitAmount || 300,
                              bestCandidate.estimatedBrokerage * 2.5,
                            )
                        ) {
                          optionMomentumConfirmed = false;
                        }

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

                        if (signal && bestCandidate.instrumentKey && optionMomentumConfirmed) {
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
                        } else if (signal && !optionMomentumConfirmed) {
                          // Downgrade to HOLD if the option premium itself is falling or pulling back from its peak
                          signal.signalType = "HOLD";
                          signal.confidenceScore = 45;
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error("Option Fetch Error: ", e);
                }
              }

              // Keep botSignals updated with the latest confirmed BUY/SELL signal
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
                lastSignal.recommendedOptionStrike = signal.recommendedOptionStrike;
              }
            } else if (signal) {
              // Also update/show live HOLD analysis in botSignals so the UI always displays real-time index status while waiting for a breakout
              const existingIdx = botSignals.findIndex(
                (s) => s.underlyingInstrumentKey === idx.key || s.symbol === idx.symbol,
              );
              if (existingIdx === -1) {
                botSignals.push(signal);
                if (botSignals.length > 50) botSignals.length = 50;
              } else if (botSignals[existingIdx].signalType === "HOLD") {
                botSignals[existingIdx] = signal;
              }
            }

            if (
              activePositions.length === 0 &&
              !botConfig.dailyLossLocked &&
              !isInPostExitCooldown &&
              isTradingDay &&
              isTradingHours &&
              verifiedRealOptionStrike &&
              signal &&
              signal.instrumentKey &&
              !String(signal.instrumentKey).includes("INDEX") &&
              (signal.signalType === "BUY" || signal.signalType === "SELL") &&
              signal.confidenceScore >= botConfig.minConfidence
            ) {
              // Execute Trade on Option!
              const isBullish = signal.signalType === "BUY";
              const optionSymbol = signal.symbol;
              const optionPrice = Number(signal.price || 0);
              const optInstrumentKey =
                signal.instrumentKey || signal.underlyingInstrumentKey || "NSE_FO|" + optionSymbol;
              const lotSize = await getDynamicLotSize(optionSymbol, token, optInstrumentKey);
              const oneLotCharges = calculateTradeCharges(
                optionPrice,
                lotSize,
                true,
                signal.target1 || optionPrice * 1.25,
              );
              const oneLotCost = oneLotCharges.tradeValue;
              const oneLotBrokerage = oneLotCharges.roundTripCharges;
              const oneLotTotalWithBrokerage =
                oneLotCharges.totalRequiredWithBrokerage;

              // Strict Capital, Margin & Brokerage Guard in UPSTOX_LIVE mode:
              // NEVER use dummy cash in UPSTOX_LIVE mode! Only execute if real Upstox account cash >= (1 Lot Premium + Full Brokerage & Statutory Taxes).
              if (botConfig.mode === "UPSTOX_LIVE") {
                if (
                  liveAvailableMargin <= 0 ||
                  oneLotTotalWithBrokerage > liveAvailableMargin
                ) {
                  const warnMsg = `[LIVE CAPITAL & BROKERAGE GUARD] Cannot buy ${optionSymbol} in UPSTOX_LIVE mode: 1 Lot (${lotSize} Qty @ ₹${optionPrice}) requires ₹${oneLotTotalWithBrokerage.toLocaleString("en-IN")} (Premium ₹${oneLotCost.toLocaleString("en-IN")} + Brokerage & Taxes ₹${oneLotBrokerage.toFixed(2)}), but your Upstox Available Cash is ₹${liveAvailableMargin.toLocaleString("en-IN")}. Dummy cash is strictly disabled in Live mode.`;
                  const existingIdx = botLogs.findIndex((l) =>
                    l.message.includes(`Cannot buy ${optionSymbol} in UPSTOX_LIVE mode`),
                  );
                  if (existingIdx === -1) {
                    botLogs.unshift({
                      id: Date.now().toString(),
                      time: new Date().toLocaleTimeString(),
                      message: warnMsg,
                      type: "ERROR",
                    });
                    if (botLogs.length > 200) botLogs.length = 200;
                  } else {
                    botLogs[existingIdx].message = warnMsg;
                    botLogs[existingIdx].time = new Date().toLocaleTimeString();
                  }
                  continue; // Check next index for a lower-cost option lot (including brokerage) that fits real Upstox cash
                }
              }

              // Calculate optimal lot count strictly within available capital AFTER including full brokerage & taxes
              const lotCalc = calculateAffordableLotsWithBrokerage(
                optionPrice,
                lotSize,
                effectiveCapital,
                true,
                5,
              );
              let affordableLots =
                lotCalc.affordableLots > 0
                  ? lotCalc.affordableLots
                  : botConfig.mode === "PAPER_TRADING"
                    ? 1
                    : 0;
              if (botConfig.mode === "UPSTOX_LIVE" && affordableLots < 1) {
                continue;
              }
              affordableLots = Math.min(Math.max(1, affordableLots), 5);
              const targetQuantity = affordableLots * lotSize;
              const multiLotCharges = calculateTradeCharges(
                optionPrice,
                targetQuantity,
                true,
                signal.target1 || optionPrice * 1.25,
              );
              const totalTradeCost = multiLotCharges.tradeValue;
              const totalTradeBrokerage = multiLotCharges.roundTripCharges;
              const totalRequiredCashWithBrokerage =
                multiLotCharges.totalRequiredWithBrokerage;

              if (botConfig.mode === "PAPER_TRADING") {
                botLogs.unshift({
                  id: Date.now().toString(),
                  time: new Date().toLocaleTimeString(),
                  message: `[PAPER MODE] Signal Confirmed (${signal.confidenceScore}%): Buying ${optionSymbol} [${affordableLots} Lot = ${targetQuantity} Qty @ ₹${optionPrice} | Premium: ₹${totalTradeCost.toLocaleString("en-IN")} + Est. Brokerage: ₹${totalTradeBrokerage.toFixed(2)} = Total: ₹${totalRequiredCashWithBrokerage.toLocaleString("en-IN")}].`,
                  type: "TRADE",
                });
                if (botLogs.length > 200) botLogs.length = 200;

                paperOrders.unshift({
                  id: "ORD" + Date.now(),
                  orderId: "PAP_" + Date.now().toString().slice(-6),
                  symbol: optionSymbol,
                  instrumentKey: optInstrumentKey,
                  transactionType: "BUY",
                  type: "BUY",
                  orderType: "MARKET",
                  productType: "INTRADAY",
                  quantity: targetQuantity,
                  price: optionPrice,
                  executedPrice: optionPrice,
                  status: "COMPLETE",
                  timestamp: new Date().toLocaleTimeString("en-IN"),
                  time: new Date().toISOString(),
                  mode: "PAPER_TRADING",
                });
                paperPositions.push({
                  id: "POS" + Date.now(),
                  symbol: optionSymbol,
                  instrumentKey: optInstrumentKey,
                  productType: "INTRADAY",
                  quantity: targetQuantity,
                  buyPrice: optionPrice,
                  currentLTP: optionPrice,
                  pnl: 0,
                  pnlPercent: 0,
                  stopLoss: signal.stopLoss,
                  target: signal.target1,
                  type: "BUY",
                  mode: "PAPER_TRADING",
                  openedAt: new Date().toLocaleTimeString("en-IN"),
                  isOption: true,
                });
                savePostgresDb().catch(() => {});

                sendTelegramNotification(
                  `🟢 <b>PAPER BOT ENTRY TRIGGERED</b>\n\n` +
                  `📊 <b>Option Contract:</b> <code>${optionSymbol}</code>\n` +
                  `🎯 <b>Direction:</b> ${isBullish ? 'CE (Bullish Call Buy)' : 'PE (Bearish Put Buy)'}\n` +
                  `📦 <b>Quantity:</b> ${targetQuantity} Qty (${affordableLots} Lot × ${lotSize})\n` +
                  `💰 <b>Option Premium:</b> ₹${optionPrice} (Virtual Capital: ₹${totalTradeCost.toLocaleString("en-IN")})\n` +
                  `⚡ <b>Strategy:</b> ${botConfig.selectedStrategy}\n` +
                  `🛡️ <b>Mode:</b> PAPER_TRADING\n` +
                  `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                ).catch(() => {});
              } else if (botConfig.mode === "UPSTOX_LIVE" && token) {
                try {
                  const orderRes = await fetch("https://api.upstox.com/v2/order/place", {
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
                  const orderJson = await orderRes.json().catch(() => null);
                  if (orderJson?.status === "success") {
                    botLogs.unshift({
                      id: Date.now().toString(),
                      time: new Date().toLocaleTimeString(),
                      message: `[UPSTOX LIVE] Order Executed (${signal.confidenceScore}%): Bought ${optionSymbol} [${affordableLots} Lot = ${targetQuantity} Qty @ ₹${optionPrice} | Premium: ₹${totalTradeCost.toLocaleString("en-IN")} + Brokerage & Taxes: ₹${totalTradeBrokerage.toFixed(2)} = Total Cash Used: ₹${totalRequiredCashWithBrokerage.toLocaleString("en-IN")}].`,
                      type: "TRADE",
                    });
                    if (botLogs.length > 200) botLogs.length = 200;

                    sendTelegramNotification(
                      `🟢 <b>UPSTOX LIVE ENTRY EXECUTED</b>\n\n` +
                      `📊 <b>Option Contract:</b> <code>${optionSymbol}</code>\n` +
                      `🎯 <b>Direction:</b> ${isBullish ? 'CE (Bullish Call Buy)' : 'PE (Bearish Put Buy)'}\n` +
                      `📦 <b>Quantity:</b> ${targetQuantity} Qty (${affordableLots} Lot × ${lotSize})\n` +
                      `💰 <b>Premium:</b> ₹${optionPrice} (₹${totalTradeCost.toLocaleString("en-IN")})\n` +
                      `🧾 <b>Est. Brokerage & Taxes:</b> ₹${totalTradeBrokerage.toFixed(2)}\n` +
                      `💳 <b>Total Cash Used:</b> ₹${totalRequiredCashWithBrokerage.toLocaleString("en-IN")}\n` +
                      `⚡ <b>Strategy:</b> ${botConfig.selectedStrategy}\n` +
                      `🛡️ <b>Mode:</b> UPSTOX_LIVE\n` +
                      `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                    ).catch(() => {});
                  } else {
                    const errCode = orderJson?.errors?.[0]?.errorCode || orderJson?.errors?.[0]?.error_code || "";
                    const errMsg = orderJson?.errors?.[0]?.message || "Upstox Live Order Rejected";
                    const liveErrText = `[UPSTOX LIVE ORDER REJECTED] (${errCode || "API"}): ${errMsg} for ${optionSymbol}. Live mode never uses dummy cash.`;
                    if (!botLogs.some((l) => l.message === liveErrText)) {
                      botLogs.unshift({
                        id: Date.now().toString(),
                        time: new Date().toLocaleTimeString(),
                        message: liveErrText,
                        type: "ERROR",
                      });
                      if (botLogs.length > 200) botLogs.length = 200;
                    }
                  }
                } catch (err: any) {
                  console.error("Error placing live auto buy order:", err);
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
  // Align multi-minute candles (3m, 5m, 15m, 30m, 1h) to Indian Market Open (09:15 AM IST = +03:45 UTC = 13,500,000 ms offset)
  const IST_MARKET_OPEN_OFFSET_MS = (3 * 60 + 45) * 60 * 1000;

  for (const candle of candles) {
    // align timestamp to IST market session boundary (starting 09:15 IST)
    const alignedTime =
      Math.floor((candle.timestamp - IST_MARKET_OPEN_OFFSET_MS) / intervalMs) *
        intervalMs +
      IST_MARKET_OPEN_OFFSET_MS;

    if (!currentGroup || currentGroup.timestamp !== alignedTime) {
      if (currentGroup) aggregated.push(currentGroup);
      currentGroup = {
        timestamp: alignedTime,
        timeStr: new Date(alignedTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
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

const lotSizeCache: Record<string, { lotSize: number; timestamp: number; source: string; expiry?: string }> = {};

const getUnderlyingOptionInstrumentKey = (symbolOrKey: string): string => {
  const raw = String(symbolOrKey || "").trim();
  const s = raw.toUpperCase();
  if (s.includes("BANKEX")) return "BSE_INDEX|BANKEX";
  if (s.includes("SENSEX")) return "BSE_INDEX|SENSEX";
  if (s.includes("MID SELECT") || s.includes("MIDCP") || s.includes("MIDCAP"))
    return "NSE_INDEX|NIFTY MID SELECT";
  if (s.includes("FIN SERVICE") || s.includes("FINNIFTY"))
    return "NSE_INDEX|Nifty Fin Service";
  if (
    s.includes("NIFTY BANK") ||
    s.includes("BANKNIFTY") ||
    s.includes("BANK NIFTY") ||
    s === "BANK"
  )
    return "NSE_INDEX|Nifty Bank";
  if (s.includes("NIFTY")) return "NSE_INDEX|Nifty 50";
  return getInstrumentKey(raw);
};

const getDynamicLotSizeInfo = async (
  symbol: string,
  token: string,
  specificInstrumentKey?: string,
): Promise<{ lotSize: number; source: "UPSTOX_LIVE" | "CACHED_UPSTOX_LIVE" | "TOKEN_REQUIRED"; expiry?: string; underlyingKey: string }> => {
  const underlyingKey = getUnderlyingOptionInstrumentKey(symbol || specificInstrumentKey || "");
  const cacheKey = specificInstrumentKey && specificInstrumentKey.includes("FO|")
    ? specificInstrumentKey
    : underlyingKey;

  const now = Date.now();
  const cached = lotSizeCache[cacheKey] || lotSizeCache[underlyingKey];
  if (cached && cached.lotSize > 0 && now - cached.timestamp < 15 * 60 * 1000) {
    return {
      lotSize: cached.lotSize,
      source: "CACHED_UPSTOX_LIVE",
      expiry: cached.expiry,
      underlyingKey,
    };
  }

  if (token) {
    try {
      const contractRes = await fetch(
        `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(underlyingKey)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        },
      );
      if (contractRes.ok) {
        const contractData = await contractRes.json();
        if (Array.isArray(contractData.data) && contractData.data.length > 0) {
          // 1. If a specific option contract instrument_key was passed (e.g. NSE_FO|...), match it directly
          let matchedContract = specificInstrumentKey
            ? contractData.data.find((c: any) => c.instrument_key === specificInstrumentKey)
            : null;

          // 2. Otherwise pick the nearest upcoming active expiry contract from Upstox live data
          if (!matchedContract) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingContracts = contractData.data
              .filter((c: any) => c.expiry && new Date(c.expiry).getTime() >= today.getTime() && Number(c.lot_size || c.minimum_lot) > 0)
              .sort((a: any, b: any) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
            matchedContract = upcomingContracts.length > 0 ? upcomingContracts[0] : contractData.data[0];
          }

          const liveLotSize = Number(matchedContract?.lot_size || matchedContract?.minimum_lot || 0);
          if (liveLotSize > 0) {
            const entry = {
              lotSize: liveLotSize,
              timestamp: now,
              source: "UPSTOX_LIVE",
              expiry: matchedContract?.expiry,
            };
            lotSizeCache[underlyingKey] = entry;
            lotSizeCache[cacheKey] = entry;
            if (symbol) lotSizeCache[symbol.toUpperCase()] = entry;
            return {
              lotSize: liveLotSize,
              source: "UPSTOX_LIVE",
              expiry: matchedContract?.expiry,
              underlyingKey,
            };
          }
        }
      }
    } catch (e) {}
  }

  // If cached from earlier today, return that even if >15m old
  if (cached && cached.lotSize > 0) {
    return {
      lotSize: cached.lotSize,
      source: "CACHED_UPSTOX_LIVE",
      expiry: cached.expiry,
      underlyingKey,
    };
  }

  return {
    lotSize: 1,
    source: "TOKEN_REQUIRED",
    underlyingKey,
  };
};

const getDynamicLotSize = async (
  symbol: string,
  token: string,
  specificInstrumentKey?: string,
): Promise<number> => {
  const info = await getDynamicLotSizeInfo(symbol, token, specificInstrumentKey);
  return info.lotSize;
};

const getInstrumentKey = (symbolOrKey: string) => {
  const raw = String(symbolOrKey || "").trim();
  if (
    raw.startsWith("NSE_FO|") ||
    raw.startsWith("BSE_FO|") ||
    raw.startsWith("NSE_EQ|INE") ||
    raw.startsWith("BSE_EQ|INE")
  ) {
    return raw;
  }
  const s = raw.toUpperCase();
  // Check specific equity stocks first so bank stocks (HDFCBANK, ICICIBANK, AXISBANK) never match generic "BANK"
  if (s.includes("RELIANCE")) return "NSE_EQ|INE002A01018";
  if (s.includes("HDFCBANK") || s === "HDFC") return "NSE_EQ|INE040A01034";
  if (s.includes("TCS")) return "NSE_EQ|INE467B01029";
  if (s.includes("INFY")) return "NSE_EQ|INE009A01021";
  if (s.includes("ICICIBANK")) return "NSE_EQ|INE090A01021";
  if (s.includes("SBIN") || s === "SBI") return "NSE_EQ|INE062A01020";
  if (s.includes("AXISBANK")) return "NSE_EQ|INE238A01034";
  if (s.includes("KOTAKBANK")) return "NSE_EQ|INE237A01028";
  if (s.includes("INDUSINDBK")) return "NSE_EQ|INE095A01012";
  if (s.includes("HINDUNILVR")) return "NSE_EQ|INE030A01027";
  if (s.includes("ITC")) return "NSE_EQ|INE154A01025";
  if (s === "LT" || s.includes("INE018A01030")) return "NSE_EQ|INE018A01030";
  if (s.includes("BHARTIARTL")) return "NSE_EQ|INE397D01024";
  if (s.includes("BAJFINANCE")) return "NSE_EQ|INE296A01024";
  if (s.includes("HCLTECH")) return "NSE_EQ|INE860A01027";
  if (s.includes("ASIANPAINT")) return "NSE_EQ|INE021A01026";
  if (s.includes("TATAMOTORS")) return "NSE_EQ|INE155A01022";

  // Check indices in specific order
  if (s.includes("BANKEX")) return "BSE_INDEX|BANKEX";
  if (s.includes("SENSEX")) return "BSE_INDEX|SENSEX";
  if (s.includes("MID SELECT") || s.includes("MIDCP") || s.includes("MIDCAP"))
    return "NSE_INDEX|NIFTY MID SELECT";
  if (s.includes("FIN SERVICE") || s.includes("FINNIFTY"))
    return "NSE_INDEX|Nifty Fin Service";
  if (
    s.includes("NIFTY BANK") ||
    s.includes("BANKNIFTY") ||
    s.includes("BANK NIFTY") ||
    s === "BANK"
  )
    return "NSE_INDEX|Nifty Bank";
  if (s.includes("NIFTY"))
    return "NSE_INDEX|Nifty 50";

  // Convert colon separator (e.g. NSE_EQ:RELIANCE) if needed
  if (raw.includes(":") && !raw.includes("|")) {
    return raw.replace(":", "|");
  }
  return raw;
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

// Upstox In-Memory Credentials & Session Cache (pre-saved with user's exact credentials so Render deployments always have them ready)
let upstoxConfig = {
  apiKey: process.env.UPSTOX_API_KEY || "3ab5711d-8891-480b-b0c1-29662852de49",
  apiSecret: process.env.UPSTOX_API_SECRET || "jl5s7qy9r0",
  redirectUri: process.env.UPSTOX_REDIRECT_URI || "https://sajad-trading-view.onrender.com",
  accessToken: process.env.UPSTOX_ACCESS_TOKEN || "",
  userName: "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN",
  userEmail: "sajadthazhepeedikayila@gmail.com",
  userClientCode: "5VCABX",
  mobile: process.env.UPSTOX_MOBILE || "9847989434",
  pin: process.env.UPSTOX_PIN || "984798",
  totpSecret: "",
  tokenGeneratedAt: "",
  tokenExpiresAt: "",
};

// In- e ory Paper / Execution Order Book

// ================= API ROUTES =================

// 1. Health check & Render 24x7 Anti-Sleep / Keep-Alive Wakeup Engine
let lastWakeupPingAt = new Date().toISOString();
let wakeupPingCount = 0;

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    lastWakeupPingAt,
    wakeupPingCount,
    broker: "Upstox v2 Engine",
  });
});

app.get("/api/ping", (req: Request, res: Response) => {
  res.json({
    status: "awake",
    time: new Date().toISOString(),
    uptime: process.uptime(),
    lastWakeupPingAt,
    wakeupPingCount,
  });
});

app.get("/api/wakeup", (req: Request, res: Response) => {
  res.json({
    status: "awake_24x7",
    message: "Render Anti-Sleep Wakeup Engine Active",
    time: new Date().toISOString(),
    uptime: process.uptime(),
    lastWakeupPingAt,
    wakeupPingCount,
  });
});

// 24x7 Multi-Target Anti-Sleep Wakeup Loop for Render (runs every 5 minutes so Render's 15-min idle timer never triggers)
async function executeRenderWakeupPing() {
  const targets = Array.from(
    new Set(
      [
        process.env.RENDER_EXTERNAL_URL,
        "https://aizabiz.onrender.com",
        "https://sajad-trading-view.onrender.com",
        `http://127.0.0.1:${PORT}`,
      ].filter(Boolean) as string[],
    ),
  );

  wakeupPingCount += 1;
  lastWakeupPingAt = new Date().toISOString();

  for (const base of targets) {
    try {
      const cleanBase = base.replace(/\/+$/, "");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      await fetch(`${cleanBase}/api/ping?t=${Date.now()}`, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "AIZABIZ-24x7-Render-Wakeup-Engine/1.0",
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });
      clearTimeout(timer);
    } catch (err) {
      // Ignore unreachable secondary URLs quietly
    }
  }
}

// Run initial wakeup ping 15 seconds after boot, then every 5 minutes (300,000 ms)
setTimeout(executeRenderWakeupPing, 15 * 1000);
setInterval(executeRenderWakeupPing, 5 * 60 * 1000);

// 2. Upstox API Auth & Configuration
const invalidTokens = new Set<string>();

function isUpstoxAuthFailureError(resStatus: number, data: any): boolean {
  if (resStatus === 401) return true;
  const errCode = String(data?.errors?.[0]?.errorCode || data?.errors?.[0]?.code || "");
  if (
    errCode === "UDAPI100050" ||
    errCode === "UDAPI100057" ||
    errCode === "UDAPI100068" ||
    errCode === "UDAPI100016"
  ) {
    return true;
  }
  const msg = String(data?.errors?.[0]?.message || data?.message || "").toLowerCase();
  return msg.includes("invalid token") || msg.includes("token has expired") || msg.includes("unauthorized");
}

app.use(["/api/market", "/api/instrument", "/api/trading", "/api/bot"], (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token && token.length > 30 && !invalidTokens.has(token)) {
      if (upstoxConfig.accessToken !== token) {
        upstoxConfig.accessToken = token;
        savePostgresDb().catch(() => {});
      }
    }
  }
  next();
});

// Auto-Sync Approved Token from Public Webhook Relay (ntfy.sh) & Render Bridge
let lastWebhookDiagnostic = "";
const PUBLIC_WEBHOOK_RELAY_TOPIC = "upstox_live_sajad_5vcabx_3ab5711d";
export const PUBLIC_WEBHOOK_RELAY_URL = `https://ntfy.sh/${PUBLIC_WEBHOOK_RELAY_TOPIC}`;
let lastPublishedRelayToken = "";

async function publishTokenToCloudRelay(tokenToSave: string) {
  const clean = (tokenToSave || "").trim();
  if (!clean || clean.length < 30 || clean === lastPublishedRelayToken) return;
  lastPublishedRelayToken = clean;
  try {
    await fetch(PUBLIC_WEBHOOK_RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Title: "Upstox Daily Token Backup",
      },
      body: JSON.stringify({
        access_token: clean,
        user_id: upstoxConfig.userClientCode || "5VCABX",
        user_name: upstoxConfig.userName || "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN",
        saved_at: new Date().toISOString(),
      }),
    });
  } catch (e) {}
}

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
    } else if (isUpstoxAuthFailureError(pRes.status, pData)) {
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
      `https://ntfy.sh/${PUBLIC_WEBHOOK_RELAY_TOPIC}/json?poll=1&since=18h`,
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
          const ok = await activateDiscoveredToken(jwtMatch[0], "Cloud Token Backup Relay");
          if (ok) return true;
        }
        try {
          const wrapper = JSON.parse(line);
          const innerStr = typeof wrapper.message === "string" ? wrapper.message : JSON.stringify(wrapper);
          const innerJwt = innerStr.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
          if (innerJwt && innerJwt[0]) {
            const ok = await activateDiscoveredToken(innerJwt[0], "Cloud Token Backup Relay");
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

let cachedOutboundServerIp = "";
fetch("https://api.ipify.org")
  .then((r) => r.text())
  .then((ip) => {
    if (ip && ip.trim().length <= 45) cachedOutboundServerIp = ip.trim();
  })
  .catch(() => {});

app.get("/api/market/config", async (req: Request, res: Response) => {
  if (!cachedOutboundServerIp) {
    fetch("https://api.ipify.org")
      .then((r) => r.text())
      .then((ip) => {
        if (ip && ip.trim().length <= 45) cachedOutboundServerIp = ip.trim();
      })
      .catch(() => {});
  }
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
  let userName = upstoxConfig.userName || "SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN";
  let userEmail = upstoxConfig.userEmail || "sajadthazhepeedikayila@gmail.com";
  let userClientCode = upstoxConfig.userClientCode || "5VCABX";

  if (isConnected) {
    try {
      const [profileRes, fundsRes, holdingsRes] = await Promise.all([
        fetch("https://api.upstox.com/v2/user/profile", {
          headers: {
            Authorization: `Bearer ${upstoxConfig.accessToken}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        }),
        fetch("https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC", {
          headers: {
            Authorization: `Bearer ${upstoxConfig.accessToken}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        }).catch(() => null),
        fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
          headers: {
            Authorization: `Bearer ${upstoxConfig.accessToken}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        }).catch(() => null),
      ]);

      const profileData = await profileRes.json().catch(() => null);
      const fundsData = fundsRes ? await fundsRes.json().catch(() => null) : null;
      const holdingsData = holdingsRes ? await holdingsRes.json().catch(() => null) : null;

      if (holdingsData && holdingsData.status === "success" && Array.isArray(holdingsData.data)) {
        holdingsCount = holdingsData.data.length;
      }

      if (
        fundsData &&
        fundsData.status === "success" &&
        fundsData.data &&
        fundsData.data.equity
      ) {
        availableMargin = fundsData.data.equity.available_margin || 0;
        usedMargin = fundsData.data.equity.used_margin || 0;
      }

      if (profileData && profileData.status === "success" && profileData.data) {
        isConnected = true;
        userName = profileData.data.user_name || userName;
        userEmail = profileData.data.email || userEmail;
        userClientCode = profileData.data.user_id || userClientCode;
        upstoxConfig.userName = userName;
        upstoxConfig.userEmail = userEmail;
        upstoxConfig.userClientCode = userClientCode;
      } else if (profileData && isUpstoxAuthFailureError(profileRes.status, profileData)) {
        // Only invalidate token on explicit 401 / UDAPI100050 auth failure, never on weekend/evening margin maintenance or rate limit!
        invalidTokens.add(upstoxConfig.accessToken);
        upstoxConfig.accessToken = "";
        isConnected = false;
        tokenExpired = true;
      }
    } catch (e) {
      // Network hiccup: keep existing valid token instead of wiping it!
      isConnected = Boolean(upstoxConfig.accessToken);
    }
  }

  res.json({
    apiKey: upstoxConfig.apiKey || "3ab5711d-8891-480b-b0c1-29662852de49",
    apiSecret: upstoxConfig.apiSecret || "jl5s7qy9r0",
    hasApiSecret: true,
    redirectUri: upstoxConfig.redirectUri || "https://sajad-trading-view.onrender.com",
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
    mobile: upstoxConfig.mobile || "9847989434",
    pin: upstoxConfig.pin || "984798",
    serverOutboundIp: cachedOutboundServerIp || "34.34.254.223",
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
          await savePostgresDb().catch(() => {});
          publishTokenToCloudRelay(token).catch(() => {});
        } else if (isUpstoxAuthFailureError(response.status, data)) {
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
        return res
          .status(500)
          .json({ success: false, error: "Failed to validate token" });
      }
    }
  }

  await savePostgresDb().catch(() => {});

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
  if (typeof accessToken === "string" && accessToken.trim().length > 20) {
    const cleanToken = accessToken.trim();
    upstoxConfig.accessToken = cleanToken;
    invalidTokens.delete(cleanToken);
    publishTokenToCloudRelay(cleanToken).catch(() => {});
  }

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
      botConfig.mode = "UPSTOX_LIVE";
      invalidTokens.delete(token);
      await savePostgresDb().catch(() => {});
      publishTokenToCloudRelay(token).catch(() => {});

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
      if (isUpstoxAuthFailureError(response.status, data)) {
        invalidTokens.add(token);
      }
      upstoxConfig.accessToken = "";
      return res.status(401).json({
        success: false,
        error:
          data.errors?.[0]?.message ||
          "Invalid or expired token. Please generate a new token and try again.",
      });
    }
  } catch (err: any) {
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
        publishTokenToCloudRelay(data.access_token).catch(() => {});

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
        apiSecret: secret || "jl5s7qy9r0",
        redirectUri: uri,
        mobile: cleanMobile,
        pin: cleanPin,
        createdAt: Date.now(),
      };
      await savePostgresDb().catch(() => {});

      return res.json({
        success: true,
        mobile: cleanMobile,
        sessionBackup: activeAutoOtpSession,
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
  const { totp, pin, apiKey, apiSecret, mobile, sessionBackup } = req.body;
  const cleanTotp = String(totp || "").replace(/\D+/g, "").trim();
  const cleanPin = String(pin || upstoxConfig.pin || "984798").trim();
  const key = String(apiKey || upstoxConfig.apiKey || "3ab5711d-8891-480b-b0c1-29662852de49").trim();
  if (apiSecret && apiSecret !== "••••••••" && apiSecret.trim() !== "") {
    upstoxConfig.apiSecret = apiSecret.trim();
  }
  if (!upstoxConfig.apiSecret || upstoxConfig.apiSecret.includes("•")) {
    upstoxConfig.apiSecret = "jl5s7qy9r0";
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

  // Restore session from client backup if Render restarted between sending OTP and entering OTP
  if (!activeAutoOtpSession && sessionBackup && sessionBackup.validateOtpToken) {
    activeAutoOtpSession = sessionBackup;
  }

  // PATH A: If we have an active Automated SMS OTP session, complete Steps 3, 4, 5 automatically!
  if (activeAutoOtpSession && Date.now() - activeAutoOtpSession.createdAt < 15 * 60 * 1000) {
    try {
      const sess = activeAutoOtpSession;
      const pinToUse = cleanPin || sess.pin || "984798";
      const secretToUse = upstoxConfig.apiSecret || sess.apiSecret || "jl5s7qy9r0";

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
        publishTokenToCloudRelay(tokenData.access_token).catch(() => {});

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
      publishTokenToCloudRelay(token).catch(() => {});

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
      invalidTokens.delete(data.access_token);
      savePostgresDb();
      publishTokenToCloudRelay(data.access_token).catch(() => {});

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
        data.data
          .filter((p: any) => Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)) > 0)
          .map((p: any) => ({
            id: p.trading_symbol || p.instrument_token,
            symbol: p.trading_symbol || p.instrument_token,
            instrumentKey: p.instrument_token,
            productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
            quantity: Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)),
            type: Number(p.quantity ?? p.net_quantity ?? 0) < 0 ? "SELL" : "BUY",
            buyPrice: p.average_price || p.buy_amount / (p.buy_quantity || 1),
            currentLTP: p.last_price || p.average_price,
            pnl: p.pnl || p.m2m || 0,
            pnlPercent: p.average_price
              ? ((p.last_price - p.average_price) / p.average_price) * 100
              : 0,
            mode: "UPSTOX_LIVE",
            isOption:
              /\b(CE|PE)\b/i.test(p.trading_symbol || "") ||
              String(p.instrument_token || "").includes("FO"),
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
      const rawProduct = String(product || "I").toUpperCase().trim();
      const upstoxProduct =
        rawProduct === "INTRADAY" || rawProduct === "MIS" || rawProduct === "I"
          ? "I"
          : rawProduct === "DELIVERY" || rawProduct === "CNC" || rawProduct === "NRML" || rawProduct === "D"
            ? "D"
            : "I";
      const upstoxTxType = String(transactionType || "BUY").toUpperCase().trim() === "SELL" ? "SELL" : "BUY";
      const canonicalInstToken = getInstrumentKey(String(instrumentToken));

      const response = await fetch(
        `https://api.upstox.com/v2/charges/brokerage?instrument_token=${encodeURIComponent(canonicalInstToken)}&quantity=${quantity}&product=${upstoxProduct}&transaction_type=${upstoxTxType}&price=${price}`,
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
      }
    } catch (err) {
      // Fallback to local SEBI/Upstox charge calculation below
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

let lastQuotesCache: { timestamp: number; data: any; quotes: any[] } = {
  timestamp: 0,
  data: {},
  quotes: [],
};
let isFetchingCentralQuotes = false;
const intradayCandleCache: Record<string, { timestamp: number; raw: any[] }> = {};

function formatUpstoxQuotesToStandardList(upstoxData: any) {
  const list: any[] = [];
  for (const [key, val] of Object.entries(upstoxData || {})) {
    const v = val as any;
    if (!v) continue;
    const parts = key.split(/[:|]/);
    let symbolDisplay = (
      v.symbol && v.symbol !== "NA" ? v.symbol : parts.length > 1 ? parts[1] : key
    ).toUpperCase();
    const canonicalInstrumentKey = getInstrumentKey(
      v.instrument_token || key || symbolDisplay,
    );
    // Standardize index display names so NIFTY 50, BANKNIFTY, FINNIFTY, SENSEX, BANKEX match watchlist & charts seamlessly
    if (canonicalInstrumentKey === "NSE_INDEX|Nifty 50") symbolDisplay = "NIFTY 50";
    else if (canonicalInstrumentKey === "NSE_INDEX|Nifty Bank") symbolDisplay = "BANKNIFTY";
    else if (canonicalInstrumentKey === "NSE_INDEX|Nifty Fin Service") symbolDisplay = "FINNIFTY";
    else if (canonicalInstrumentKey === "BSE_INDEX|SENSEX") symbolDisplay = "SENSEX";
    else if (canonicalInstrumentKey === "BSE_INDEX|BANKEX") symbolDisplay = "BANKEX";
    else if (canonicalInstrumentKey === "NSE_INDEX|NIFTY MID SELECT") symbolDisplay = "MIDCPNIFTY";

    const segment = key.includes("INDEX")
      ? "INDEX"
      : key.includes("FO")
        ? "OPTIONS"
        : "EQUITY";
    const ltp = Number(v.last_price || 0);
    const netChange =
      v.net_change !== undefined && v.net_change !== null
        ? Number(v.net_change)
        : v.ohlc?.close && v.ohlc.close !== ltp
          ? Number((ltp - Number(v.ohlc.close)).toFixed(2))
          : 0;
    const prevClose =
      netChange !== 0
        ? Number((ltp - netChange).toFixed(2))
        : Number(v.ohlc?.close || v.close || ltp);
    const changePercent =
      prevClose > 0
        ? Number(((netChange / prevClose) * 100).toFixed(2))
        : 0;

    if (ltp > 0) {
      globalLiveQuotes[canonicalInstrumentKey] = {
        last_price: ltp,
        net_change: netChange,
        changePercent,
      };
      globalLiveQuotes[key] = {
        last_price: ltp,
        net_change: netChange,
        changePercent,
      };
      globalLiveQuotes["last_update"] = new Date().toISOString();
    }
    list.push({
      symbol: symbolDisplay,
      name: symbolDisplay,
      exchange: key.startsWith("BSE") ? "BSE" : "NSE",
      segment,
      instrumentKey: canonicalInstrumentKey,
      ltp,
      change: Number(netChange.toFixed(2)),
      changePercent,
      volume: Number(v.volume || 0),
      open: Number(v.ohlc?.open || v.open || ltp),
      high: Number(v.ohlc?.high || v.high || ltp),
      low: Number(v.ohlc?.low || v.low || ltp),
      close: prevClose,
    });
  }
  // Update paperPositions in-memory on every tick so P&L and P&L% are always live!
  if (paperPositions.length > 0) {
    paperPositions.forEach((pos: any) => {
      const match = list.find(
        (q) => q.instrumentKey === pos.instrumentKey || q.symbol === pos.symbol,
      );
      if (match && match.ltp > 0) {
        if (!(pos.isOption && match.ltp > pos.buyPrice * 50)) {
          pos.currentLTP = match.ltp;
          pos.pnl = Number(((match.ltp - pos.buyPrice) * (pos.quantity || 1)).toFixed(2));
          pos.pnlPercent =
            pos.buyPrice > 0
              ? Number((((match.ltp - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2))
              : 0;
        }
      }
    });
  }
  return list;
}

async function refreshCentralUpstoxQuotes(tokenOverride?: string, customSymbols?: string) {
  const token = tokenOverride || upstoxConfig.accessToken;
  if (!token || invalidTokens.has(token)) return lastQuotesCache;

  if (!customSymbols && isFetchingCentralQuotes && lastQuotesCache.quotes.length > 0) {
    return lastQuotesCache;
  }

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
  paperPositions.forEach((p: any) => {
    if (p.instrumentKey && !keysArray.includes(p.instrumentKey)) {
      keysArray.push(p.instrumentKey);
    }
  });

  const symbols = customSymbols || keysArray.join(",");
  if (!customSymbols) isFetchingCentralQuotes = true;

  try {
    const response = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(symbols)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Api-Version": "2.0",
        },
      },
    );
    if (response.ok) {
      const data = await response.json();
      if (data?.status === "success" && data?.data) {
        const formattedQuotes = formatUpstoxQuotesToStandardList(data.data);
        if (formattedQuotes.length > 0 && !customSymbols) {
          lastQuotesCache = {
            timestamp: Date.now(),
            data: data.data,
            quotes: formattedQuotes,
          };
        }
        return { timestamp: Date.now(), data: data.data, quotes: formattedQuotes };
      }
    }
  } catch (e) {
    // Return cached quotes on network/rate-limit hiccup
  } finally {
    if (!customSymbols) isFetchingCentralQuotes = false;
  }
  return lastQuotesCache;
}

app.get("/api/market/quotes", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;

  if (!token) {
    return res
      .status(401)
      .json({ status: "error", error: "Upstox login required for live data" });
  }

  const customSymbols = req.query.symbols as string | undefined;
  if (!customSymbols && lastQuotesCache.quotes.length > 0 && Date.now() - lastQuotesCache.timestamp < 1000) {
    return res.json({ status: "success", data: lastQuotesCache.data, quotes: lastQuotesCache.quotes });
  }

  const result = await refreshCentralUpstoxQuotes(token, customSymbols);
  if (result.quotes.length > 0) {
    return res.json({ status: "success", data: result.data, quotes: result.quotes });
  }
  return res.status(503).json({ error: "Waiting for Upstox live quote tick" });
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
    const rawKey = String(req.query.instrumentKey || symbol || "").trim();
    const instrumentKey = getInstrumentKey(symbol || rawKey);
    const normInterval = interval.toLowerCase().trim();
    let url = "";

    // Upstox API v2 historical candle interval accepts one of (1minute,30minute,day,week,month)
    if (normInterval === "1d") {
      const today = new Date();
      const toDate = today.toISOString().split("T")[0];
      const fromDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${toDate}/${fromDate}`;
    } else {
      url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/1minute`;
    }

    let data: any = { status: "error" };
    const cachedIntraday = intradayCandleCache[instrumentKey];
    if (normInterval !== "1d" && cachedIntraday && Date.now() - cachedIntraday.timestamp < 5000) {
      data = { status: "success", data: { candles: cachedIntraday.raw } };
    } else {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      });
      data = await response.json();
      if (normInterval !== "1d" && data?.status === "success" && data?.data?.candles?.length > 0) {
        intradayCandleCache[instrumentKey] = {
          timestamp: Date.now(),
          raw: data.data.candles,
        };
      } else if (normInterval !== "1d" && cachedIntraday?.raw?.length > 0) {
        data = { status: "success", data: { candles: cachedIntraday.raw } };
      }
    }

    // If intraday returned no candles (e.g., market is closed, weekend, or holiday), fetch recent 1-minute historical candles from Upstox
    if (!data?.data?.candles || data.data.candles.length === 0) {
      const today = new Date();
      const toDate = today.toISOString().split("T")[0];
      const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const histInterval = normInterval === "1d" ? "day" : "1minute";
      const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${histInterval}/${toDate}/${fromDate}`;
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
        } else if (normInterval !== "1d") {
          // Fallback to 30minute if 1minute historical exceeded range
          const hist30Url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/30minute/${toDate}/${fromDate}`;
          const hist30Res = await fetch(hist30Url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          });
          const hist30Data = await hist30Res.json();
          if (hist30Data.status === "success" && hist30Data.data?.candles?.length > 0) {
            data.status = "success";
            data.data = hist30Data.data;
          }
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
        .filter((c: any) => !isNaN(c.timestamp) && c.close > 0)
        .reverse();

      // Aggregate if needed
      let candles = rawCandles;
      if (normInterval === "3m") {
        candles = aggregateCandles(rawCandles, 3 * 60 * 1000);
      } else if (normInterval === "5m") {
        candles = aggregateCandles(rawCandles, 5 * 60 * 1000);
      } else if (normInterval === "15m") {
        candles = aggregateCandles(rawCandles, 15 * 60 * 1000);
      } else if (normInterval === "30m") {
        candles = aggregateCandles(rawCandles, 30 * 60 * 1000);
      } else if (normInterval === "1h") {
        candles = aggregateCandles(rawCandles, 60 * 60 * 1000);
      }

      // Merge real-time quote LTP into the latest candle so index & stock charts update live on every tick!
      let liveTickPrice = globalLiveQuotes[instrumentKey]?.last_price || 0;
      if (!liveTickPrice && token) {
        try {
          const lqRes = await fetch(
            `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Api-Version": "2.0",
              },
            },
          );
          if (lqRes.ok) {
            const lqJson = await lqRes.json();
            const firstQuote: any = Object.values(lqJson?.data || {})[0];
            if (firstQuote?.last_price) {
              liveTickPrice = Number(firstQuote.last_price);
              globalLiveQuotes[instrumentKey] = { last_price: liveTickPrice };
            }
          }
        } catch {}
      }

      if (liveTickPrice > 0 && candles.length > 0) {
        const lastC = candles[candles.length - 1];
        const diffRatio = Math.abs(liveTickPrice - lastC.close) / (lastC.close || 1);
        if (diffRatio <= 0.15) {
          lastC.close = liveTickPrice;
          if (liveTickPrice > lastC.high) lastC.high = liveTickPrice;
          if (liveTickPrice < lastC.low) lastC.low = liveTickPrice;
        }
      }

      return res.json({ success: true, symbol, instrumentKey, interval, candles, liveLtp: liveTickPrice });
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

// Real-time instrument lookup (100% Dynamic Live Lot Size from Upstox API)
app.get("/api/instrument/details", async (req: Request, res: Response) => {
  const symbol = String(req.query.symbol || "").trim();
  const rawInstrumentKey = String(req.query.instrumentKey || "").trim();
  const instrumentKey = rawInstrumentKey || getInstrumentKey(symbol);
  const token = upstoxConfig.accessToken;

  const symUpper = symbol.toUpperCase();
  const isOptionOrIndex =
    /\b(CE|PE|CALL|PUT|FUT)\b/.test(symUpper) ||
    symUpper.includes("NIFTY") ||
    symUpper.includes("BANKNIFTY") ||
    symUpper.includes("FINNIFTY") ||
    symUpper.includes("MIDCP") ||
    symUpper.includes("SENSEX") ||
    symUpper.includes("BANKEX") ||
    instrumentKey.includes("FO|") ||
    instrumentKey.includes("INDEX|");

  if (!isOptionOrIndex) {
    // Equity / Cash Stock uses exact Share Quantity (1 share step), never option lots
    return res.json({
      symbol,
      instrumentKey,
      lotSize: 1,
      source: "EQUITY_SHARES",
    });
  }

  const liveInfo = await getDynamicLotSizeInfo(symbol, token, rawInstrumentKey || undefined);

  res.json({
    symbol,
    instrumentKey: liveInfo.underlyingKey || instrumentKey,
    lotSize: liveInfo.lotSize,
    source: liveInfo.source,
    expiry: liveInfo.expiry,
  });
});

app.get("/api/market/optionchain", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string as string) || "NIFTY 50";
  const instrumentKey = getUnderlyingOptionInstrumentKey(symbol);
  const token = upstoxConfig.accessToken;

  if (!token) {
    // No fallback. Return error if disconnected.
    return res.status(401).json({ error: "Upstox Token Missing", strikes: [] });
  }

  try {
    // Fetch contract to get expiry dates and live lot_size
    const contractRes = await fetch(
      `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey as string)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
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
    const validExpiries: string[] = Array.from(
      new Set(
        contractData.data
          .map((c: any) => String(c.expiry || ""))
          .filter((e: string) => e && new Date(e).getTime() >= today.getTime()),
      ),
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const requestedExpiry = String(req.query.expiry || "").trim();
    const expiryDate =
      requestedExpiry && validExpiries.includes(requestedExpiry)
        ? requestedExpiry
        : validExpiries.length > 0
          ? validExpiries[0]
          : contractData.data[0].expiry;

    // Extract live lot_size for this expiry directly from Upstox contract response
    const activeContractForLot =
      contractData.data.find(
        (c: any) => c.expiry === expiryDate && Number(c.lot_size || c.minimum_lot) > 0,
      ) ||
      contractData.data.find((c: any) => Number(c.lot_size || c.minimum_lot) > 0);
    const liveLotSize = Number(
      activeContractForLot?.lot_size || activeContractForLot?.minimum_lot || 1,
    );

    if (liveLotSize > 0) {
      const cacheEntry = {
        lotSize: liveLotSize,
        timestamp: Date.now(),
        source: "UPSTOX_LIVE",
        expiry: expiryDate,
      };
      lotSizeCache[instrumentKey] = cacheEntry;
      lotSizeCache[symbol.toUpperCase()] = cacheEntry;
    }

    // Fetch option chain
    const chainRes = await fetch(
      `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(instrumentKey as string)}&expiry_date=${expiryDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
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
          lotSize: liveLotSize,
        };
      });

      const pcr =
        totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 1;

      const underlyingSpot = Number(
        chainData.data[0]?.underlying_spot_price ||
          chainData.data[0]?.underlying_price ||
          globalLiveQuotes[instrumentKey]?.last_price ||
          0,
      );

      // Compute ATM strike closest to underlyingSpot for accurate Max Pain / ATM highlight
      const closestAtmStrike =
        strikes.length > 0 && underlyingSpot > 0
          ? [...strikes].sort(
              (a, b) =>
                Math.abs(a.strikePrice - underlyingSpot) -
                Math.abs(b.strikePrice - underlyingSpot),
            )[0]?.strikePrice
          : strikes.length > 0
            ? strikes[Math.floor(strikes.length / 2)].strikePrice
            : 0;

      const result = {
        underlyingSymbol: symbol,
        underlyingLTP: underlyingSpot,
        lotSize: liveLotSize,
        timestamp: new Date().toISOString(),
        expiryDates: validExpiries.length > 0 ? validExpiries.slice(0, 6) : [expiryDate],
        selectedExpiry: expiryDate,
        strikes,
        pcr,
        maxPain: closestAtmStrike,
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
  const { mode, symbol, instrumentKey, productType, orderType, initialType, quantity, price, stopLoss, target } = req.body;
  if (mode === "PAPER_TRADING") {
    const resolvedKey =
      instrumentKey ||
      (/\b(CE|PE)\b/i.test(symbol || "") ? `NSE_FO|${symbol}` : getInstrumentKey(symbol));
    const newOrder = {
      id: "ORD" + Date.now(),
      orderId: "PAP_" + Date.now().toString().slice(-6),
      symbol,
      instrumentKey: resolvedKey,
      transactionType: initialType || "BUY",
      type: initialType || "BUY",
      orderType: orderType || "MARKET",
      productType: productType || "INTRADAY",
      quantity: Number(quantity) || 1,
      price: Number(price) || 0,
      executedPrice: Number(price) || 0,
      status: "COMPLETE",
      timestamp: new Date().toLocaleTimeString("en-IN"),
      time: new Date().toISOString(),
      mode: "PAPER_TRADING",
    };
    paperOrders.unshift(newOrder);

    // Add or update paper positions
    const pos = paperPositions.find((p: any) => p.symbol === symbol);
    if (pos) {
      if (initialType === "SELL" && pos.type === "BUY") {
        // Selling an existing BUY position -> realize PnL and record to history
        const sellQty = Math.min(pos.quantity, newOrder.quantity);
        const realized = (newOrder.price - pos.buyPrice) * sellQty;
        const closedSnapshot = {
          ...pos,
          quantity: sellQty,
          sellPrice: newOrder.price,
          realizedPnL: Number(realized.toFixed(2)),
          closeTime: new Date().toISOString(),
          mode: "PAPER_TRADING",
        };
        paperTradeHistory.unshift(closedSnapshot);
        if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
        pos.quantity -= sellQty;
        if (pos.quantity <= 0) {
          paperPositions.splice(paperPositions.indexOf(pos), 1);
        }
      } else {
        const totalCost = pos.buyPrice * pos.quantity + newOrder.price * newOrder.quantity;
        pos.quantity += newOrder.quantity;
        pos.buyPrice = Number((totalCost / (pos.quantity || 1)).toFixed(2));
        pos.currentLTP = newOrder.price;
      }
    } else {
      paperPositions.push({
        id: "POS" + Date.now(),
        symbol,
        instrumentKey: resolvedKey,
        productType: productType || "INTRADAY",
        quantity: newOrder.quantity,
        buyPrice: newOrder.price,
        currentLTP: newOrder.price,
        pnl: 0,
        pnlPercent: 0,
        stopLoss,
        target,
        type: initialType || "BUY",
        mode: "PAPER_TRADING",
        openedAt: new Date().toLocaleTimeString("en-IN"),
        isOption: /\b(CE|PE)\b/i.test(symbol || "") || String(resolvedKey).includes("FO"),
      });
    }
    savePostgresDb().catch(() => {});
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
      const { instrumentKey, productType, orderType, triggerPrice } = req.body;
      let instrKey = instrumentKey || getInstrumentKey(symbol);
      if (!instrKey.includes("|")) {
        if (/\b(CE|PE)\b/.test(symbol)) instrKey = "NSE_FO|" + symbol;
        else instrKey = "NSE_EQ|" + symbol;
      }

      // If it looks like NSE_EQ|SYMBOL (not an ISIN INE...), check Upstox holdings for exact ISIN instrument_token
      if (instrKey.startsWith("NSE_EQ|") && !instrKey.includes("INE")) {
        try {
          const hRes = await fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          });
          const hData = await hRes.json();
          if (hData.status === "success" && Array.isArray(hData.data)) {
            const matchedH = hData.data.find(
              (item: any) =>
                (item.trading_symbol || item.tradingsymbol || "").toUpperCase() ===
                String(symbol).toUpperCase(),
            );
            if (matchedH?.instrument_token) {
              instrKey = matchedH.instrument_token;
            }
          }
        } catch {}
      }

      const upstoxProduct = productType === "INTRADAY" ? "I" : "D";
      const upstoxOrderType =
        orderType === "LIMIT" || orderType === "SL" || orderType === "SL-M"
          ? orderType
          : Number(price) > 0
            ? "LIMIT"
            : "MARKET";

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
          product: upstoxProduct,
          validity: "DAY",
          price: upstoxOrderType === "MARKET" || upstoxOrderType === "SL-M" ? 0 : Number(price) || 0,
          tag: "manual_ui_order",
          instrument_token: instrKey,
          order_type: upstoxOrderType,
          transaction_type: initialType,
          disclosed_quantity: 0,
          trigger_price: Number(triggerPrice) || 0,
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
import os from "os";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

const LOCAL_DB_PATH = path.join(os.tmpdir(), "upstox_algo_local_db.json");
let lastSavedDbJson = "";

async function savePostgresDb() {
  const dbData = {
    botConfig,
    upstoxConfig,
    activeAutoOtpSession,
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
    if (!upstoxConfig.apiSecret || upstoxConfig.apiSecret.includes("•")) {
      upstoxConfig.apiSecret = process.env.UPSTOX_API_SECRET || "jl5s7qy9r0";
    }
    if (!upstoxConfig.mobile || String(upstoxConfig.mobile).replace(/\D+/g, "").length !== 10) {
      upstoxConfig.mobile = process.env.UPSTOX_MOBILE || "9847989434";
    }
    if (!upstoxConfig.pin) {
      upstoxConfig.pin = process.env.UPSTOX_PIN || "984798";
    }
    botConfig.maxOptionLossCount = Math.min(
      3,
      Math.max(1, Number(botConfig.maxOptionLossCount || 3)),
    );
    // Clean up any corrupted or stale paper positions that accidentally got an INDEX key, dummy ₹100 price, or old BSE_FO illiquid contract
    if (Array.isArray(paperPositions)) {
      paperPositions = paperPositions.filter(
        (p) =>
          p &&
          p.instrumentKey &&
          !String(p.instrumentKey).includes("INDEX") &&
          !(p.buyPrice === 100 && p.currentLTP === 100) &&
          p.id !== "POS1791178766034" &&
          p.id !== "POS1791181277347",
      );
    }
    if (Array.isArray(paperTradeHistory)) {
      const glitchReEntryIds = new Set([
        "POS1791180147116",
        "POS1791185205632",
        "POS1791185149176",
        "POS1791184764976",
        "POS1791183660094",
      ]);
      paperTradeHistory = paperTradeHistory.filter(
        (t) =>
          t &&
          !glitchReEntryIds.has(t.id) &&
          Number(t.quantity || 0) <= 500,
      );
    }
    if (Array.isArray(paperOrders)) {
      const glitchOrderIds = new Set([
        "ORD1791185245506",
        "ORD1791185205632",
        "ORD1791185200500",
        "ORD1791185149176",
        "ORD1791185144029",
        "ORD1791184764975",
        "ORD1791183734728",
        "ORD1791183660094",
      ]);
      paperOrders = paperOrders.filter((o) => o && !glitchOrderIds.has(o.id));
    }
    botConfig.stopLossPercent = Math.min(
      3.8,
      Math.max(2.0, Number(botConfig.stopLossPercent || 3.5)),
    );
    const activeLosses = (paperTradeHistory || []).filter(
      (t) => (t.realizedPnL || 0) < 0,
    ).length;
    if (activeLosses < (botConfig.maxOptionLossCount || 3)) {
      botConfig.dailyLossLocked = false;
      botConfig.enabled = true;
    }
  };

  // First load from local_db.json if available
  try {
    if (fsSync.existsSync(LOCAL_DB_PATH)) {
      const raw = fsSync.readFileSync(LOCAL_DB_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (data.botConfig) botConfig = { ...botConfig, ...data.botConfig };
      if (data.upstoxConfig) upstoxConfig = { ...upstoxConfig, ...data.upstoxConfig };
      if (data.activeAutoOtpSession) activeAutoOtpSession = data.activeAutoOtpSession;
      if (data.paperOrders) paperOrders = data.paperOrders;
      if (data.paperPositions) paperPositions = data.paperPositions;
      if (data.paperTradeHistory) paperTradeHistory = data.paperTradeHistory;
      normalizeUpstoxCfg();
    } else {
      normalizeUpstoxCfg();
    }
  } catch (err) {
    normalizeUpstoxCfg();
  }

  if (!postgresAvailable) return;

  try {
    const rows = await db.select().from(appState).where(eq(appState.id, 'main_state'));
    if (rows && rows.length > 0) {
      const data = rows[0].data as any;
      if (data.botConfig) botConfig = { ...botConfig, ...data.botConfig };
      if (data.upstoxConfig) upstoxConfig = { ...upstoxConfig, ...data.upstoxConfig };
      if (data.activeAutoOtpSession) activeAutoOtpSession = data.activeAutoOtpSession;
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
  async (req: Request, res: Response) => {
    const { mode, symbol, instrumentKey, quantity, productType, sellPrice } = req.body;
    const posId = req.params.positionId;

    if (mode === "PAPER_TRADING") {
      const idx = paperPositions.findIndex(
        (p) => p.id === posId || p.symbol === posId || (symbol && p.symbol === symbol),
      );
      if (idx >= 0) {
        const closedPos = paperPositions.splice(idx, 1)[0];
        const finalSellPrice = Number(sellPrice || closedPos.currentLTP || closedPos.buyPrice);
        closedPos.sellPrice = finalSellPrice;
        closedPos.realizedPnL = Number(
          ((finalSellPrice - closedPos.buyPrice) * (closedPos.quantity || 1)).toFixed(2),
        );
        const sqCharges = calculateTradeCharges(
          Number(closedPos.buyPrice || 0),
          Math.max(1, Number(closedPos.quantity || 1)),
          Boolean(closedPos.isOption),
          finalSellPrice,
        );
        closedPos.brokerageCharges = sqCharges.roundTripCharges;
        closedPos.netRealizedPnL = Number(
          (closedPos.realizedPnL - sqCharges.roundTripCharges).toFixed(2),
        );
        closedPos.closeTime = new Date().toISOString();
        closedPos.mode = "PAPER_TRADING";
        paperTradeHistory.unshift(closedPos);
        if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;

        paperOrders.unshift({
          id: "ORD" + Date.now(),
          orderId: "PAP_" + Date.now().toString().slice(-6),
          symbol: closedPos.symbol,
          instrumentKey: closedPos.instrumentKey,
          transactionType: "SELL",
          type: "SELL",
          orderType: "MARKET",
          productType: closedPos.productType || "INTRADAY",
          quantity: closedPos.quantity,
          price: finalSellPrice,
          executedPrice: finalSellPrice,
          status: "COMPLETE",
          timestamp: new Date().toLocaleTimeString("en-IN"),
          time: new Date().toISOString(),
          mode: "PAPER_TRADING",
        });
        savePostgresDb().catch(() => {});
        return res.json({ success: true, closedPosition: closedPos });
      }
      return res.json({ success: true });
    }

    // UPSTOX_LIVE Square-off via Upstox Order API
    const token =
      req.headers.authorization?.replace("Bearer ", "").trim() ||
      upstoxConfig.accessToken;
    if (!token) {
      return res.status(401).json({ success: false, error: "Upstox Token missing" });
    }

    try {
      const instrKey = instrumentKey || getInstrumentKey(symbol || posId);
      const isOptionContract =
        /\b(CE|PE)\b/i.test(symbol || posId || "") || String(instrKey).includes("FO");
      const upstoxProduct =
        productType === "INTRADAY" && !isOptionContract
          ? "I"
          : productType === "INTRADAY"
            ? "I"
            : "D";

      const orderRes = await fetch("https://api.upstox.com/v2/order/place", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Api-Version": "2.0",
        },
        body: JSON.stringify({
          quantity: Math.abs(Number(quantity) || 1),
          product: upstoxProduct,
          validity: "DAY",
          price: 0,
          tag: "square_off_order",
          instrument_token: instrKey,
          order_type: "MARKET",
          transaction_type: "SELL",
          disclosed_quantity: 0,
          trigger_price: 0,
          is_amo: false,
        }),
      });
      const data = await orderRes.json();
      if (data.status === "success") {
        return res.json({ success: true, order: data.data });
      }
      return res.json({
        success: false,
        error: data.errors?.[0]?.message || "Live square-off order failed",
      });
    } catch (err: any) {
      return res.json({ success: false, error: err.message });
    }
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
    res.write(":\n\n");
    const token = upstoxConfig.accessToken;
    if (!token) return;
    try {
      const result =
        Date.now() - lastQuotesCache.timestamp < 1000 && lastQuotesCache.quotes.length > 0
          ? lastQuotesCache
          : await refreshCentralUpstoxQuotes(token);
      if (result.quotes && result.quotes.length > 0) {
        res.write(
          `data: ${JSON.stringify({ type: "QUOTES", data: result.quotes })}\n\n`,
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
  const token = upstoxConfig.accessToken;
  if (!token || invalidTokens.has(token)) return;

  try {
    const result =
      Date.now() - lastQuotesCache.timestamp < 1000 && lastQuotesCache.quotes.length > 0
        ? lastQuotesCache
        : await refreshCentralUpstoxQuotes(token);
    if (result.quotes && result.quotes.length > 0 && wss.clients.size > 0) {
      const msgStr = JSON.stringify({ type: "QUOTES", data: result.quotes });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(msgStr);
        }
      });
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
  await loadPostgresDb().catch(() => {});
  if (!upstoxConfig.accessToken) {
    await syncTokenFromRenderWebhookBridge().catch(() => {});
  }
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
