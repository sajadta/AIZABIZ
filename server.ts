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
import { registerSystemRoutes } from "./server/routes/system";
import { registerRealtimeRoutes, wss } from "./server/realtime";
import {
  applyCorsMiddleware, applySecurityFirewall, applyApiTokenAdoption, applyApiErrorHandler,
} from "./server/middleware";
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
applyCorsMiddleware(app);
applySecurityFirewall(app);
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
registerSystemRoutes(app);
registerRoutes(app);
registerTradingRoutes(app);
registerAiRoutes(app);
registerMarketRoutes(app);
registerBotRoutes(app);

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


applyApiTokenAdoption(app);


applyApiErrorHandler(app);


// Vite middleware for development vs static dist for production

registerRealtimeRoutes(app);


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
