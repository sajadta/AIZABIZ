process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || "") + " --dns-result-order=ipv4first";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

import { HttpsProxyAgent } from "https-proxy-agent";
import https from "https";
import { FIXED_PRIMARY_IP, FIXED_SECONDARY_IP, placeUpstoxOrderIpv4, getUpstoxAgent } from "./server/services/upstoxTransport";
import { registerRoutes } from "./server/routes";
import fsSync from "fs";
import { resilientFetch, resilientFetchJson } from "./server/lib/http";
import { fetchLiveUpstoxCharges } from "./server/lib/charges";
import { isJwtTokenActuallyExpired, saveTokenBackupToDisk, loadTokenBackupFromDisk } from "./server/lib/tokens";
import { savePostgresDb, loadPostgresDb, isPostgresAvailable, setPostgresAvailable, getPaperInitialCapital, setPaperInitialCapital } from "./server/services/persistence";
import { sendTelegramNotification } from "./server/services/notifications";
import { YAHOO_NSE_MAP } from "./server/data/yahooMap";
import { startBotEngine } from "./server/services/botEngine";
import { refreshCentralUpstoxQuotes, fetchRealNseQuotesFallback } from "./server/services/marketData";
import { registerTradingRoutes } from "./server/routes/trading";
import { registerAiRoutes } from "./server/routes/ai";
import { registerMarketRoutes } from "./server/routes/market";
import { registerBotRoutes } from "./server/routes/bot";
import {
  publishTokenToCloudRelay, syncTokenFromRenderWebhookBridge, getLiveOutboundIp,
  lastVerifiedTokenStatus, setLastVerifiedTokenStatus,
} from "./server/services/tokenSync";
import { setLastWebhookDiagnostic, getLastWebhookDiagnostic } from "./server/state";
import {
  aggregateCandles,
  getUnderlyingOptionInstrumentKey,
  shouldHoldOvernightBTST,
  getDynamicLotSizeInfo,
  getDynamicLotSize,
  getInstrumentKey,
  getNextExpiry,
  lotSizeCache,
} from "./server/lib/instruments";

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
import express from "express";
import compression from "compression";
import type { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import zlib from "zlib";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

import { 
  botConfig as sharedBotConfig,
  botLogs as sharedBotLogs,
  botSignals as sharedBotSignals,
  upstoxConfig as sharedUpstoxConfig,
  paperOrders,
  paperPositions,
  paperTradeHistory,
  globalLiveQuotes,
  invalidTokens as sharedInvalidTokens,
  livePositionStateTracker as sharedLivePositionStateTracker,
  optionIntradayCandleCache as sharedOptionIntradayCandleCache,
  recentClosedStrikes as sharedRecentClosedStrikes,
  fiveYearHistoricalRegimeCache as sharedFiveYearHistoricalRegimeCache,
  getLastQuotesCache,
  optionContractCache as sharedOptionContractCache,
  optionChainCache as sharedOptionChainCache,
  subscribedKeys as sharedSubscribedKeys,
  getEngineHeartbeatTicks, getLastEngineTickAt, getLatestMultiIndexAlphaMatrix,
  getCachedUpstoxLivePositions, setCachedUpstoxLivePositions,
  PERSISTENT_TOKEN_BACKUP_PATH,
  customHoldingBuyPrices,
  setBotConfig, setUpstoxConfig, resetPaperTradingState
} from "./server/state";

const botConfig = sharedBotConfig;
const botLogs = sharedBotLogs;
const botSignals = sharedBotSignals;




dotenv.config();


const app = express();
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Bulletproof Security Firewall: Strictly block any direct HTTP access to dotfiles, state databases, tokens, or server files
app.use((req, res, next) => {
  const cleanPath = req.path.toLowerCase();
  // Allow PWA .well-known assetlinks
  if (cleanPath.startsWith('/.well-known/')) {
    return next();
  }
  if (
    cleanPath.startsWith('/.') ||
    cleanPath.includes('.upstox') ||
    cleanPath.includes('.json') && !cleanPath.startsWith('/api') && !cleanPath.includes('manifest') ||
    cleanPath.endsWith('.ts') && cleanPath.includes('server') ||
    cleanPath.includes('render.yaml')
  ) {
    return res.status(403).json({ error: "Access Denied: Protected Security Resource" });
  }
  next();
});

// Dedicated PWA Manifest & Service Worker Endpoints for Android Native Installability
app.get(['/manifest.webmanifest', '/manifest.json'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  const p = path.join(process.cwd(), 'public', 'manifest.webmanifest');
  if (fsSync.existsSync(p)) {
    return res.sendFile(p);
  }
  res.json({
    name: "AIZABIZ PRO Trading Terminal",
    short_name: "AIZABIZ",
    start_url: "/",
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      { src: "/launchericon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/launchericon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/launchericon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  });
});

app.get('/sw.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  const p = path.join(process.cwd(), 'public', 'sw.js');
  if (fsSync.existsSync(p)) {
    return res.sendFile(p);
  }
  res.send('self.addEventListener("install",e=>self.skipWaiting());self.addEventListener("activate",e=>event.waitUntil(self.clients.claim()));');
});

// 1-Click Mobile App Launcher Download (Works on all Android phones without store restrictions)
app.get('/api/download/launcher', (req: Request, res: Response) => {
  res.setHeader('Content-Disposition', 'attachment; filename="AIZABIZ-Trading-Terminal.html"');
  res.setHeader('Content-Type', 'text/html');
  const rawHost = req.get('x-forwarded-host') || req.get('host') || '';
  const isLocal = !rawHost || rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
  const cleanHost = isLocal ? 'ais-dev-2kuhbzz5qyj5zbysxk6da3-173711515136.asia-southeast1.run.app' : rawHost;
  const target = `https://${cleanHost}/?source=mobile_launcher`;
  const launcherHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>AIZABIZ PRO Trading Terminal</title>
  <style>
    body { margin: 0; background: #070a12; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; }
    .loader { width: 44px; height: 44px; border: 4px solid #10b981; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader"></div>
  <h2>AIZABIZ PRO</h2>
  <p>Loading Live Trading Terminal...</p>
  <script>
    window.location.replace("${target}");
  </script>
</body>
</html>`;
  res.send(launcherHtml);
});

// Direct download for high-res 512x512 app icon
app.get('/api/download/icon', (req: Request, res: Response) => {
  const p = path.join(process.cwd(), 'public', 'launchericon-512x512.png');
  res.download(p, 'aizabiz-icon-512.png');
});

app.get('/api/history', async (req, res) => {
  if (!isPostgresAvailable()) {
    return res.json(paperTradeHistory);
  }
  try {
    const rows = await db.select().from(tradeHistory).orderBy(desc(tradeHistory.closeTime)).limit(200);
    res.json(rows.length > 0 ? rows : paperTradeHistory);
  } catch (e) {
    setPostgresAvailable(false);
    res.json(paperTradeHistory);
  }
});

app.post('/api/paper-trading/reset', async (req: Request, res: Response) => {
  resetPaperTradingState();
  if (isPostgresAvailable()) {

    try {
      await db.delete(tradeHistory);
    } catch {
      // Ignored
    }
  }
  savePostgresDb().catch(() => { /* ignore */ });
  return res.json({
    success: true,
    message: "Paper trading account successfully reset to ₹2,000 initial balance with 0 trade history.",
    balance: 2000,
    positions: [],
    orders: [],
    history: []
  });
});

app.post('/api/bot/clear-ip-warning', (req: Request, res: Response) => {
  botLogs.splice(0, botLogs.length, ...botLogs.filter((l) => !l.message?.includes('static IP restrictions')));
  savePostgresDb().catch(() => { /* ignore */ });
  return res.json({ success: true, count: botLogs.length });
});


// Cache Option Contracts, Option Chains, and 5-Year Historical Daily Candles to prevent Upstox 429 rate-limit errors
const optionContractCache = sharedOptionContractCache;

const optionChainCache = sharedOptionChainCache;

const optionIntradayCandleCache = sharedOptionIntradayCandleCache;
const fiveYearHistoricalRegimeCache = sharedFiveYearHistoricalRegimeCache;

const livePositionStateTracker = sharedLivePositionStateTracker;

const recentClosedStrikes = sharedRecentClosedStrikes;

// Smart Dynamic Anti-Churn & Re-entry Guard:
// - Standard 30-minute lockout prevents small churns and brokerage drain on choppy sideways action
// - Big Profit / High Alpha Breakouts bypass the long lockout after 3 mins of consolidation if previous trade was in profit!

/**
 * Resilient HTTP fetch utility with automatic retry, timeout control, and graceful error handling.
 * Prevents unhandled ECONNRESET, socket hangups, and TypeError: fetch failed from crashing polling loops.
 */


// Bot Loop Interval (Runs Every 1 Second / 1000ms for Real-Time Second-by-Second Entry & Exit Evaluation)


startBotEngine();

const portArgIdx = process.argv.indexOf("--port");
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
// In AI Studio Build development environment, dev server must strictly run on port 3000 (PORT=8080 is reserved by internal proxy)
const PORT = cliPort || (process.env.RENDER ? (Number(process.env.PORT) || 3000) : 3000);

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


// Upstox In-Memory Credentials & Session Cache (pre-saved with user's exact credentials so Render deployments always have them ready)
const upstoxConfig = sharedUpstoxConfig;


// In- e ory Paper / Execution Order Book

// ================= API ROUTES =================

// 1. Health check & Render 24x7 Anti-Sleep / Keep-Alive Wakeup Engine
registerRoutes(app);
registerTradingRoutes(app);
registerAiRoutes(app);
registerMarketRoutes(app);
registerBotRoutes(app);

app.post("/api/bot/sync-history-brokerage", async (req: Request, res: Response) => {
  try {
    const token = upstoxConfig.accessToken;
    if (!token) return res.status(401).json({ error: "No Upstox token" });

    let updatedCount = 0;
    for (const t of paperTradeHistory) {
      if (!t.brokerageCharges || Number(t.brokerageCharges) < 60) {
        const live = await fetchLiveUpstoxCharges(
          t.instrumentKey || t.symbol,
          t.quantity || 1,
          t.buyPrice,
          t.sellPrice || t.currentLTP || t.buyPrice,
          t.product || "D"
        );
        if (live && live.source === "UPSTOX_LIVE_API") {
          t.brokerageCharges = live.totalRoundTrip;
          t.netRealizedPnL = Number(((t.realizedPnL || 0) - live.totalRoundTrip).toFixed(2));
          t.brokerageSource = "UPSTOX_LIVE_API";
          updatedCount++;
        }
      }
    }
    savePostgresDb().catch(() => { /* ignore */ });
    return res.json({ success: true, updatedCount });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 24x7 Multi-Target Anti-Sleep Wakeup Loop for Render (runs every 5 minutes so Render's 15-min idle timer never triggers)
async function executeRenderWakeupPing() {
  const targets = Array.from(
    new Set(
      [
        process.env.RENDER_EXTERNAL_URL,
        "https://aizabiz.onrender.com",
        process.env.UPSTOX_REDIRECT_URI || "",
        `http://127.0.0.1:${PORT}`,
      ].filter(Boolean) as string[],
    ),
  );



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

// Persistent Token Backup File inside project directory so restarts never lose today's valid token
// PERSISTENT_TOKEN_BACKUP_PATH is imported from ./server/state

const invalidTokens = sharedInvalidTokens;


app.use(["/api/market", "/api/instrument", "/api/trading", "/api/bot"], (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (
      token &&
      token.length > 30 &&
      !invalidTokens.has(token) &&
      !isJwtTokenActuallyExpired(token)
    ) {
      // Logic Fix: Only adopt token from client if server's current token is missing or expired.
      // This prevents stale localStorage tokens from overwriting a fresh server-synced token.
      const currentToken = upstoxConfig.accessToken;
      if (!currentToken || isJwtTokenActuallyExpired(currentToken) || invalidTokens.has(currentToken)) {
        if (currentToken !== token) {
          upstoxConfig.accessToken = token;
          saveTokenBackupToDisk(token);
          savePostgresDb().catch(() => { /* ignore */ });
        }
      }
    }
  }
  next();
});


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
        Date.now() - getLastQuotesCache().timestamp < 300 && getLastQuotesCache().quotes.length > 0
          ? getLastQuotesCache()
          : await refreshCentralUpstoxQuotes(token);
      if (result.quotes && result.quotes.length > 0) {
        res.write(
          `data: ${JSON.stringify({ type: "QUOTES", data: result.quotes })}\n\n`,
        );
      }
    } catch (err) {
      // Quietly ignored
    }
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
      Date.now() - getLastQuotesCache().timestamp < 1100 && getLastQuotesCache().quotes.length > 0
        ? getLastQuotesCache()
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
    } catch (e) {
      // Ignored
    }
  });
});

// Real-Time WS Broadcast & Heartbeat (800ms)
let wsPingCounter = 0;
setInterval(() => {
  wsPingCounter += 1;
  if (wsPingCounter % 10 === 0) {
    wss.clients.forEach((ws) => {
      if (!(ws as any).isAlive) return ws.terminate();
      (ws as any).isAlive = false;
      ws.ping();
    });
  }
  broadcastUpstoxQuotesToWs();
}, 800);

app.get("/api/debug-state", (req, res) => {
  res.json({
    upstoxConfig,
    botConfig,
    paperPositions,
    botLogs: botLogs.slice(0, 5),
  });
});

async function setupVite() {
  await loadPostgresDb().catch(() => { /* ignore */ });
  if (!upstoxConfig.accessToken) {
    syncTokenFromRenderWebhookBridge().catch(() => {});
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
    app.use(express.static(distPath, { maxAge: "30d", dotfiles: "allow" }));
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
