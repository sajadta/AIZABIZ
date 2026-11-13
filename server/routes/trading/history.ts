// Live/paper trade history route with pairing + short cache.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, paperTradeHistory } from "../../state";

export function registerTradeHistoryRoutes(app: express.Application) {
let cachedUpstoxLiveHistory: { timestamp: number; list: any[] } = { timestamp: 0, list: [] };

app.get("/api/trading/history", async (req: Request, res: Response) => {
  const mode = req.query.mode;
  if (mode === "PAPER_TRADING") {
    return res.json(paperTradeHistory);
  }

  // If cached within 4s, return cache
  if (Date.now() - cachedUpstoxLiveHistory.timestamp < 4000 && cachedUpstoxLiveHistory.list.length > 0) {
    return res.json(cachedUpstoxLiveHistory.list);
  }

  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  if (!token) return res.json(cachedUpstoxLiveHistory.list || []);

  try {
    // 1. Try order/retrieve-all first which contains all filled orders today
    const ordRes = await fetch("https://api.upstox.com/v2/order/retrieve-all", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (ordRes.ok) {
      const ordData = await ordRes.json();
      const completed = (ordData.data || []).filter((o: any) => o.status === "complete");
      if (completed.length > 0) {
        // Group by symbol to pair BUY and SELL into completed round-trip trades
        const tradesBySymbol: Record<string, { buys: any[]; sells: any[] }> = {};
        for (const o of completed) {
          const sym = o.trading_symbol || o.symbol;
          if (!tradesBySymbol[sym]) tradesBySymbol[sym] = { buys: [], sells: [] };
          if (o.transaction_type === "BUY") tradesBySymbol[sym].buys.push(o);
          else tradesBySymbol[sym].sells.push(o);
        }

        const pairedTrades: any[] = [];
        for (const [sym, grp] of Object.entries(tradesBySymbol)) {
          const minLen = Math.min(grp.buys.length, grp.sells.length);
          for (let i = 0; i < minLen; i++) {
            const b = grp.buys[i];
            const s = grp.sells[i];
            const qty = Math.min(Number(b.quantity || 1), Number(s.quantity || 1));
            const buyPx = Number(b.average_price || b.price || 0);
            const sellPx = Number(s.average_price || s.price || 0);
            const pnl = Number(((sellPx - buyPx) * qty).toFixed(2));
            const isOption = sym.includes("CE") || sym.includes("PE");
            const brokerage = isOption ? 40 : 20;
            const netPnl = Number((pnl - brokerage).toFixed(2));
            pairedTrades.push({
              id: "TRD_" + (s.order_id || b.order_id),
              symbol: sym,
              instrumentKey: b.instrument_token || s.instrument_token || `NSE_FO|${sym}`,
              productType: (b.product || s.product) === "I" ? "INTRADAY" : "DELIVERY",
              quantity: qty,
              buyPrice: buyPx,
              sellPrice: sellPx,
              realizedPnL: pnl,
              brokerageCharges: brokerage,
              netRealizedPnL: netPnl,
              closeTime: s.order_timestamp || new Date().toISOString(),
              mode: "UPSTOX_LIVE",
            });
          }
        }
        if (pairedTrades.length > 0) {
          cachedUpstoxLiveHistory = { timestamp: Date.now(), list: pairedTrades };
          return res.json(pairedTrades);
        }
      }
    }

    // 2. Fallback to short-term-positions if order retrieve was empty
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
    if (data.status === "success" && Array.isArray(data.data)) {
      const history = data.data
        .filter((p: any) => p.quantity === 0 || p.net_quantity === 0)
        .map((p: any) => ({
          id: p.trading_symbol || p.instrument_token,
          symbol: p.trading_symbol || p.instrument_token,
          instrumentKey: p.instrument_token,
          productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
          quantity: Math.abs(p.buy_quantity || p.sell_quantity || 0),
          buyPrice: p.buy_amount / (p.buy_quantity || 1),
          sellPrice: p.sell_amount / (p.sell_quantity || 1),
          realizedPnL: p.realised || p.pnl || p.m2m || 0,
          closeTime: new Date().toISOString(),
          mode: "UPSTOX_LIVE",
        }));
      cachedUpstoxLiveHistory = { timestamp: Date.now(), list: history };
      return res.json(history);
    }
  } catch { /* ignore */ }
  return res.json(cachedUpstoxLiveHistory.list || []);
});
}
