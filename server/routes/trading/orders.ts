// Order book route (paper + live Upstox orders).
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, invalidTokens, paperOrders } from "../../state";

export function registerOrdersRoutes(app: express.Application) {
app.get("/api/trading/orders", async (req: Request, res: Response) => {
  const mode = req.query.mode;
  if (mode === "PAPER_TRADING") {
    return res.json(paperOrders);
  }
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
        return res.json(
          data.data.map((o: any) => ({
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
          })),
        );
      }
    }
  } catch { /* ignore */ }
  return res.json([]);
});
}
