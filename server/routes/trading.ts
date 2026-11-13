// Paper & live trading REST routes (order placement, history, positions,
// square-off and paper sync). Route groups live in ./trading/*.
import express from "express";
import { upstoxConfig, invalidTokens } from "../state";
import { savePostgresDb, loadPostgresDb } from "../services/persistence";
import { syncTokenFromRenderWebhookBridge } from "../services/tokenSync";
import { registerOrderRoutes } from "./trading/order";
import { registerTradeHistoryRoutes } from "./trading/history";
import { registerOrdersRoutes } from "./trading/orders";
import { registerPositionsRoutes } from "./trading/positions";
import { registerSquareOffRoutes } from "./trading/squareOff";
import { registerPaperSyncRoutes } from "./trading/paperSync";

export function registerTradingRoutes(app: express.Application) {
  loadPostgresDb().then(() => {
    setInterval(savePostgresDb, 5000);
    // Continuously poll public webhook relay & Render bridge every 6 seconds when not connected
    setInterval(() => {
      if (!upstoxConfig.accessToken || invalidTokens.has(upstoxConfig.accessToken)) {
        syncTokenFromRenderWebhookBridge().catch(() => { /* ignore */ });
      }
    }, 6000);
  });

  registerOrderRoutes(app);
  registerTradeHistoryRoutes(app);
  registerOrdersRoutes(app);
  registerPositionsRoutes(app);
  registerSquareOffRoutes(app);
  registerPaperSyncRoutes(app);
}
