process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || "") + " --dns-result-order=ipv4first";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

import dotenv from "dotenv";
import express from "express";
import compression from "compression";
import { startWakeupEngine } from "./server/services/wakeup";
import { bootstrap } from "./server/bootstrap";
import {
  applyCorsMiddleware, applySecurityFirewall, applyApiTokenAdoption, applyApiErrorHandler,
} from "./server/middleware";
import { registerSystemRoutes } from "./server/routes/system";
import { registerRoutes } from "./server/routes";
import { registerTradingRoutes } from "./server/routes/trading";
import { registerAiRoutes } from "./server/routes/ai";
import { registerMarketRoutes } from "./server/routes/market";
import { registerBotRoutes } from "./server/routes/bot";
import { registerRealtimeRoutes } from "./server/realtime";

dotenv.config();

const app = express();
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json({ limit: '10mb' }));
applyCorsMiddleware(app);
applySecurityFirewall(app);

const portArgIdx = process.argv.indexOf("--port");
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
// In AI Studio Build development environment, dev server must strictly run on port 3000 (PORT=8080 is reserved by internal proxy)
const PORT = cliPort || (process.env.RENDER ? (Number(process.env.PORT) || 3000) : 3000);

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================= API ROUTES =================
registerSystemRoutes(app);
registerRoutes(app);
registerTradingRoutes(app);
registerAiRoutes(app);
registerMarketRoutes(app);
registerBotRoutes(app);

// Render 24x7 anti-sleep / keep-alive wakeup engine
startWakeupEngine(PORT);

applyApiTokenAdoption(app);
applyApiErrorHandler(app);

registerRealtimeRoutes(app);

bootstrap(app, PORT).catch(err => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});

declare global { var io: any; }
