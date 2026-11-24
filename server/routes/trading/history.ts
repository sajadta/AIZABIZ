// Live/paper trade history route with chronological FIFO pairing + FY Upstox history.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, paperTradeHistory } from "../../state";
import { pairLiveDayOrders, getCachedHistoricalUpstoxTrades } from "../../lib/upstoxHistory";
import { isDeliverySoldHoldingPosition } from "../../lib/portfolioNormalize";

import { fetchLiveUpstoxCharges } from "../../lib/charges";

export function registerTradeHistoryRoutes(app: express.Application) {
  let cachedUpstoxLiveHistory: { timestamp: number; list: any[] } = { timestamp: 0, list: [] };

  app.get("/api/trading/history", async (req: Request, res: Response) => {
    const mode = req.query.mode;
    if (mode === "PAPER_TRADING") {
      return res.json(paperTradeHistory);
    }

    const forceRefresh = req.query.refresh === "1";

    // If cached within 4s, return cache
    if (!forceRefresh && Date.now() - cachedUpstoxLiveHistory.timestamp < 4000 && cachedUpstoxLiveHistory.list.length > 0) {
      return res.json(cachedUpstoxLiveHistory.list);
    }

    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      upstoxConfig.accessToken;
    if (!token) return res.json(cachedUpstoxLiveHistory.list || []);

    try {
      const [ordRes, historicalTrades] = await Promise.all([
        fetch("https://api.upstox.com/v2/order/retrieve-all", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        }).catch(() => null),
        getCachedHistoricalUpstoxTrades(token, forceRefresh).catch(() => []),
      ]);

      let todayTrades: any[] = [];
      if (ordRes && ordRes.ok) {
        const ordData = await ordRes.json().catch(() => null);
        const completed = (ordData?.data || []).filter((o: any) => o.status === "complete");
        todayTrades = pairLiveDayOrders(completed);
        await Promise.all(
          todayTrades.map(async (trd) => {
            if (trd.instrumentKey && trd.quantity > 0 && trd.buyPrice > 0 && trd.sellPrice > 0) {
              try {
                const liveChg = await fetchLiveUpstoxCharges(
                  trd.instrumentKey,
                  trd.quantity,
                  trd.buyPrice,
                  trd.sellPrice,
                  trd.productType === "INTRADAY" ? "I" : "D",
                );
                if (liveChg?.totalRoundTrip > 0) {
                  trd.brokerageCharges = liveChg.totalRoundTrip;
                  trd.netRealizedPnL = Number((trd.realizedPnL - liveChg.totalRoundTrip).toFixed(2));
                }
              } catch {
                // Keep calculated fallback
              }
            }
          }),
        );
      }

      // If no orders paired via order/retrieve-all today, fall back to closed short-term-positions only
      if (todayTrades.length === 0) {
        const posRes = await fetch(
          "https://api.upstox.com/v2/portfolio/short-term-positions",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          },
        ).catch(() => null);
        const posJson = posRes ? await posRes.json().catch(() => null) : null;
        if (posJson?.status === "success" && Array.isArray(posJson.data)) {
          todayTrades = posJson.data
            .filter((p: any) => !isDeliverySoldHoldingPosition(p) && (Number(p.quantity || 0) === 0 || Number(p.net_quantity || 0) === 0))
            .map((p: any) => ({
              id: `POS_CLOSED_${p.trading_symbol || p.instrument_token}`,
              symbol: p.trading_symbol || p.instrument_token,
              instrumentKey: p.instrument_token,
              productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
              quantity: Math.abs(p.buy_quantity || p.sell_quantity || 0),
              buyPrice: p.buy_amount / (p.buy_quantity || 1),
              sellPrice: p.sell_amount / (p.sell_quantity || 1),
              realizedPnL: Number(p.realised || p.pnl || p.m2m || 0),
              closeTime: new Date().toISOString(),
              openedAtMs: Date.now(),
              mode: "UPSTOX_LIVE",
            }));
        }
      }

      const combined = [...todayTrades, ...historicalTrades];
      cachedUpstoxLiveHistory = { timestamp: Date.now(), list: combined };
      return res.json(combined);
    } catch {
      /* ignore */
    }
    return res.json(cachedUpstoxLiveHistory.list || []);
  });
}
