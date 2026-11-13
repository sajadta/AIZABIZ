// Real-time Upstox positions and orders routes.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, invalidTokens, getCachedUpstoxLivePositions } from "../../state";

export function registerPositionRoutes(app: express.Application) {
  // Real-time Upstox Positions
  app.get("/api/market/positions", async (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      upstoxConfig.accessToken;
    if (!token) return res.json([]);

    if (Date.now() - getCachedUpstoxLivePositions().timestamp < 3500 && Array.isArray(getCachedUpstoxLivePositions().list)) {
      return res.json(getCachedUpstoxLivePositions().list);
    }

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
              buyPrice: Number(
                p.day_buy_price ||
                p.buy_price ||
                p.average_price ||
                (p.day_buy_value && p.day_buy_quantity ? p.day_buy_value / p.day_buy_quantity : 0) ||
                0
              ),
              currentLTP: Number(p.last_price || 0),
              pnl: Number(p.pnl || p.unrealised || p.realised || 0),
              pnlPercent: Number(
                p.day_buy_price || p.buy_price || p.average_price
                  ? (((p.last_price || 0) - (p.day_buy_price || p.buy_price || p.average_price)) /
                      (p.day_buy_price || p.buy_price || p.average_price)) *
                      100
                  : 0
              ),
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

  // Real-time Upstox Orders
  app.get("/api/market/orders", async (req: Request, res: Response) => {
    const headerToken = req.headers.authorization?.replace("Bearer ", "").trim() || "";
    const token =
      headerToken && !invalidTokens.has(headerToken)
        ? headerToken
        : upstoxConfig.accessToken;
    if (!token) return res.json([]);

    try {
      const response = await fetch("https://api.upstox.com/v2/order/retrieve-all", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.data)) {
          const mapped = data.data.map((o: any) => ({
            id: o.order_id || String(Date.now()),
            orderId: o.order_id,
            symbol: o.trading_symbol || o.symbol || "UNKNOWN",
            instrumentKey: o.instrument_token || o.instrument_key,
            type: o.transaction_type || "BUY",
            transactionType: o.transaction_type || "BUY",
            orderType: o.order_type || "MARKET",
            productType: o.product === "I" ? "INTRADAY" : "DELIVERY",
            quantity: Number(o.quantity) || 1,
            price: Number(o.average_price || o.price) || 0,
            status: o.status || "COMPLETE",
            timestamp: o.order_timestamp ? new Date(o.order_timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
            mode: "UPSTOX_LIVE",
          }));
          return res.json(mapped);
        }
      }
      return res.json([]);
    } catch (e) {
      return res.json([]);
    }
  });
}
