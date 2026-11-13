// Square-off-all route for paper and live positions.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, paperPositions, paperTradeHistory } from "../../state";
import { savePostgresDb } from "../../services/persistence";

import { placeUpstoxOrderIpv4 } from "../../services/upstoxTransport";

import { setCachedUpstoxLivePositions } from "../../state";

export function registerSquareOffRoutes(app: express.Application) {
app.post("/api/trading/squareoff-all", async (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode === "PAPER_TRADING") {
    paperPositions.forEach((p) => {
      p.sellPrice = p.currentLTP;
      p.realizedPnL = p.pnl;
      p.closeTime = new Date().toISOString();
      paperTradeHistory.unshift(p);
      if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
    });
    paperPositions.length = 0;
    savePostgresDb().catch(() => { /* ignore */ });
    return res.json({ success: true });
  }

  const token =
    req.headers.authorization?.replace("Bearer ", "").trim() ||
    upstoxConfig.accessToken;
  if (!token) {
    return res.status(401).json({ success: false, error: "Upstox Token missing" });
  }

  try {
    const posRes = await fetch(
      "https://api.upstox.com/v2/portfolio/short-term-positions",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const posData = await posRes.json();
    const openList = Array.isArray(posData?.data)
      ? posData.data.filter(
          (p: any) => Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)) > 0,
        )
      : [];

    for (const p of openList) {
      const qty = Math.abs(Number(p.quantity ?? p.net_quantity ?? 0));
      const txType = Number(p.quantity ?? p.net_quantity ?? 0) < 0 ? "BUY" : "SELL";
      await placeUpstoxOrderIpv4({
        quantity: qty,
        product: p.product || "D",
        validity: "DAY",
        price: 0,
        tag: "square_off_all",
        instrument_token: p.instrument_token,
        order_type: "MARKET",
        transaction_type: txType,
        disclosed_quantity: 0,
        trigger_price: 0,
        is_amo: false,
      }, token).catch(() => { /* ignore */ });
    }
    setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
    return res.json({ success: true, squaredOffCount: openList.length });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to square off live positions",
    });
  }
});
}
