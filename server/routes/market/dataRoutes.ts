// Brokerage, live quotes and historical/intraday candle routes.
import express from "express";
import { registerBrokerageRoutes } from "./data/brokerage";
import { registerQuoteRoutes } from "./data/quotes";
import { registerCandleRoutes } from "./data/candles";

export function registerMarketDataRoutes(app: express.Application) {
  registerBrokerageRoutes(app);
  registerQuoteRoutes(app);
  registerCandleRoutes(app);
}
