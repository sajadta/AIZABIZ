// Positions route (paper + live Upstox positions).
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, paperOrders, paperPositions, paperTradeHistory, livePositionStateTracker, getCachedUpstoxLivePositions } from "../../state";
import { savePostgresDb } from "../../services/persistence";
import { calculateTradeCharges } from "../../../src/utils/indicators";
import { getInstrumentKey } from "../../lib/instruments";
import { placeUpstoxOrderIpv4 } from "../../services/upstoxTransport";
import { normalizeUpstoxShortTermPositionsWithOrders, isDeliverySoldHoldingPosition } from "../../lib/portfolioNormalize";
import { getCachedLiveDayOrders } from "../../lib/upstoxHistory";

export function registerPositionsRoutes(app: express.Application) {
app.get("/api/trading/positions", async (req: Request, res: Response) => {
  const mode = req.query.mode;
  if (mode === "PAPER_TRADING") {
    return res.json(paperPositions);
  }
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  if (!token) return res.json([]);
  try {
    const [response, dayOrders] = await Promise.all([
      fetch("https://api.upstox.com/v2/portfolio/short-term-positions", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      }),
      getCachedLiveDayOrders(token, 2500),
    ]);
    const data = await response.json();
    if (data.status === "success" && data.data) {
      return res.json(normalizeUpstoxShortTermPositionsWithOrders(data.data, dayOrders, livePositionStateTracker));
    }
  } catch { /* ignore */ }
  return res.json([]);
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
    const { mode, symbol, instrumentKey, quantity, productType, sellPrice, type } = req.body;
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
        savePostgresDb().catch(() => { /* ignore */ });
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
      if (isDeliverySoldHoldingPosition({ symbol: symbol || posId, instrumentKey, productType, type })) {
        return res.json({
          success: false,
          error: "This Delivery holding was already sold today — no open trade to square off.",
        });
      }
      let instrKey = instrumentKey || getInstrumentKey(symbol || posId);
      if (!instrKey) {
        const cachedPos = (getCachedUpstoxLivePositions().list || []).find(
          (p: any) => p.id === posId || p.symbol === (symbol || posId),
        );
        if (cachedPos?.instrumentKey) {
          instrKey = cachedPos.instrumentKey;
        }
      }
      const isOptionContract =
        /\b(CE|PE)\b/i.test(symbol || posId || "") || String(instrKey || "").includes("FO");
      const upstoxProduct =
        productType === "INTRADAY" && !isOptionContract
          ? "I"
          : productType === "INTRADAY"
            ? "I"
            : "D";
      const exitTxType = String(type || "BUY").toUpperCase() === "SELL" ? "BUY" : "SELL";

      const data = await placeUpstoxOrderIpv4({
        quantity: Math.abs(Number(quantity) || 1),
        product: upstoxProduct,
        validity: "DAY",
        price: 0,
        tag: "square_off_order",
        instrument_token: instrKey,
        order_type: "MARKET",
        transaction_type: exitTxType,
        disclosed_quantity: 0,
        trigger_price: 0,
        is_amo: false,
      }, token);
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
}
