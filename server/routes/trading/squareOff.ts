// Square-off-all route for paper and live positions.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, paperPositions, paperTradeHistory } from "../../state";
import { savePostgresDb } from "../../services/persistence";
import { placeUpstoxOrderIpv4 } from "../../services/upstoxTransport";
import { setCachedUpstoxLivePositions } from "../../state";
import { isDeliverySoldHoldingPosition, isOptionInstrument } from "../../lib/portfolioNormalize";
import { calculateTradeCharges } from "../../../src/utils/indicators";

export function registerSquareOffRoutes(app: express.Application) {
  // Exit all equity trades (short-term positions) while leaving long-term holdings untouched
  app.post("/api/trading/squareoff-equity-only", async (req: Request, res: Response) => {
    const { mode } = req.body;
    if (mode === "PAPER_TRADING") {
      const equityPositions = paperPositions.filter(
        (p) => !p.isOption && !p.symbol.includes("CE") && !p.symbol.includes("PE")
      );
      equityPositions.forEach((p) => {
        const exitPx = Number(p.currentLTP || p.buyPrice || 0);
        const qty = Math.max(1, Number(p.quantity || 1));
        const gross = Number(((exitPx - Number(p.buyPrice || 0)) * qty).toFixed(2));
        const chg = calculateTradeCharges(Number(p.buyPrice || 0), qty, Boolean(p.isOption), exitPx, p.instrumentKey);
        p.sellPrice = exitPx;
        p.realizedPnL = gross;
        p.brokerageCharges = chg.roundTripCharges;
        p.netRealizedPnL = Number((gross - chg.roundTripCharges).toFixed(2));
        p.closeTime = new Date().toISOString();
        paperTradeHistory.unshift(p);
        if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
      });
      for (const ep of equityPositions) {
        const idx = paperPositions.findIndex((p) => p.id === ep.id);
        if (idx !== -1) paperPositions.splice(idx, 1);
      }
      savePostgresDb().catch(() => { /* ignore */ });
      return res.json({ success: true, squaredOffCount: equityPositions.length });
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
        ? posData.data.filter((p: any) => {
            const qty = Math.abs(Number(p.quantity ?? p.net_quantity ?? 0));
            if (qty <= 0) return false;
            if (isDeliverySoldHoldingPosition(p)) return false;
            return !isOptionInstrument(p.trading_symbol, p.instrument_token);
          })
        : [];

      for (const p of openList) {
        const qty = Math.abs(Number(p.quantity ?? p.net_quantity ?? 0));
        const txType = Number(p.quantity ?? p.net_quantity ?? 0) < 0 ? "BUY" : "SELL";
        await placeUpstoxOrderIpv4({
          quantity: qty,
          product: p.product || "D",
          validity: "DAY",
          price: 0,
          tag: "square_off_equity_only",
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
        error: err?.message || "Failed to square off equity positions",
      });
    }
  });

  app.post("/api/trading/squareoff-all", async (req: Request, res: Response) => {
    const { mode } = req.body;
    if (mode === "PAPER_TRADING") {
      paperPositions.forEach((p) => {
        const exitPx = Number(p.currentLTP || p.buyPrice || 0);
        const qty = Math.max(1, Number(p.quantity || 1));
        const isOpt = Boolean(p.isOption || /\b(CE|PE)\b/i.test(String(p.symbol || "")));
        const gross = Number(((exitPx - Number(p.buyPrice || 0)) * qty).toFixed(2));
        const chg = calculateTradeCharges(Number(p.buyPrice || 0), qty, isOpt, exitPx, p.instrumentKey);
        p.sellPrice = exitPx;
        p.realizedPnL = gross;
        p.brokerageCharges = chg.roundTripCharges;
        p.netRealizedPnL = Number((gross - chg.roundTripCharges).toFixed(2));
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
            (p: any) =>
              Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)) > 0 &&
              !isDeliverySoldHoldingPosition(p),
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
