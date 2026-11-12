// Paper & live trading REST routes (order placement, history, positions,
// square-off and paper sync).
import express from "express";
import type { Request, Response } from "express";
import {
  upstoxConfig, invalidTokens, paperOrders, paperPositions, paperTradeHistory,
} from "../state";
import { getPaperInitialCapital, savePostgresDb, loadPostgresDb } from "../services/persistence";
import { calculateTradeCharges } from "../../src/utils/indicators";
import { getInstrumentKey } from "../lib/instruments";
import { placeUpstoxOrderIpv4 } from "../services/upstoxTransport";
import { syncTokenFromRenderWebhookBridge } from "../services/tokenSync";
import { setCachedUpstoxLivePositions } from "../state";

export function registerTradingRoutes(app: express.Application) {
app.post("/api/trading/order", async (req: Request, res: Response) => {
  const { mode, symbol, instrumentKey, productType, orderType, initialType, quantity, price, stopLoss, target } = req.body;
  if (mode === "PAPER_TRADING") {
    const resolvedKey =
      instrumentKey ||
      (/\b(CE|PE)\b/i.test(symbol || "") ? `NSE_FO|${symbol}` : getInstrumentKey(symbol));
    const isOpt = /\b(CE|PE)\b/i.test(symbol || "") || String(resolvedKey).includes("FO");
    // Guard against dummy ₹100 fallback option orders without a real Upstox instrument_key
    if (
      isOpt &&
      (Number(price) === 100 || !String(resolvedKey).match(/^(NSE_FO|BSE_FO)\|\d+/))
    ) {
      return res.status(400).json({
        success: false,
        error: "Blocked dummy ₹100 option order without real Upstox option chain contract.",
      });
    }
    const orderQty = Number(quantity) || 1;
    const orderPrice = Number(price) || 0;
    const totalOrderCost = orderQty * orderPrice;

    // Check available paper balance for BUY orders so orders exceeding capital are blocked
    if ((initialType || "BUY") === "BUY") {
      const realizedPnLSum = paperTradeHistory.reduce((sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0);
      const openPositionsCost = paperPositions.reduce((sum: number, p: any) => sum + (Number(p.buyPrice || 0) * Number(p.quantity || 1)), 0);
      const availablePaperCash = Math.max(0, getPaperInitialCapital() + realizedPnLSum - openPositionsCost);
      const charges = calculateTradeCharges(orderPrice, orderQty, isOpt, orderPrice * 1.25);
      const totalRequired = totalOrderCost + charges.roundTripCharges;
      if (totalRequired > availablePaperCash) {
        return res.status(400).json({
          success: false,
          error: `Insufficient paper balance! Required: ₹${totalRequired.toFixed(2)} (Premium: ₹${totalOrderCost.toFixed(2)} + Charges: ₹${charges.roundTripCharges.toFixed(2)}), but available paper balance is only ₹${availablePaperCash.toFixed(2)}. Order rejected.`,
        });
      }
    }

    const newOrder = {
      id: "ORD" + Date.now(),
      orderId: "PAP_" + Date.now().toString().slice(-6),
      symbol,
      instrumentKey: resolvedKey,
      transactionType: initialType || "BUY",
      type: initialType || "BUY",
      orderType: orderType || "MARKET",
      productType: productType || "INTRADAY",
      quantity: Number(quantity) || 1,
      price: Number(price) || 0,
      executedPrice: Number(price) || 0,
      status: "COMPLETE",
      timestamp: new Date().toLocaleTimeString("en-IN"),
      time: new Date().toISOString(),
      mode: "PAPER_TRADING",
    };
    paperOrders.unshift(newOrder);

    // Add or update paper positions
    const pos = paperPositions.find((p: any) => p.symbol === symbol);
    if (pos) {
      if (initialType === "SELL" && pos.type === "BUY") {
        // Selling an existing BUY position -> realize PnL and record to history
        const sellQty = Math.min(pos.quantity, newOrder.quantity);
        const realized = (newOrder.price - pos.buyPrice) * sellQty;
        const closedSnapshot = {
          ...pos,
          quantity: sellQty,
          sellPrice: newOrder.price,
          realizedPnL: Number(realized.toFixed(2)),
          closeTime: new Date().toISOString(),
          mode: "PAPER_TRADING",
        };
        paperTradeHistory.unshift(closedSnapshot);
        if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
        pos.quantity -= sellQty;
        if (pos.quantity <= 0) {
          paperPositions.splice(paperPositions.indexOf(pos), 1);
        }
      } else {
        const totalCost = pos.buyPrice * pos.quantity + newOrder.price * newOrder.quantity;
        pos.quantity += newOrder.quantity;
        pos.buyPrice = Number((totalCost / (pos.quantity || 1)).toFixed(2));
        pos.currentLTP = newOrder.price;
      }
    } else {
      paperPositions.push({
        id: "POS" + Date.now(),
        symbol,
        instrumentKey: resolvedKey,
        productType: productType || "INTRADAY",
        quantity: newOrder.quantity,
        buyPrice: newOrder.price,
        currentLTP: newOrder.price,
        pnl: 0,
        pnlPercent: 0,
        stopLoss,
        target,
        type: initialType || "BUY",
        mode: "PAPER_TRADING",
        openedAt: new Date().toLocaleTimeString("en-IN"),
        isOption: /\b(CE|PE)\b/i.test(symbol || "") || String(resolvedKey).includes("FO"),
      });
    }
    savePostgresDb().catch(() => { /* ignore */ });
    return res.json({ success: true, order: newOrder });
  }
  if (mode === "UPSTOX_LIVE") {
    const token = upstoxConfig.accessToken;
    if (!token)
      return res
        .status(401)
        .json({ success: false, error: "Upstox Token missing" });

    // Attempt real order
    try {
      const { instrumentKey, productType, orderType, triggerPrice, is_amo } = req.body;
      let instrKey = instrumentKey || getInstrumentKey(symbol);
      if (!instrKey.includes("|")) {
        if (/\b(CE|PE)\b/.test(symbol)) instrKey = "NSE_FO|" + symbol;
        else if (symbol.includes("CRUDEOIL")) instrKey = "MCX_FO|" + symbol;
        else instrKey = "NSE_EQ|" + symbol;
      }

      // If it looks like NSE_EQ|SYMBOL (not an ISIN INE...), check Upstox holdings for exact ISIN instrument_token
      if (instrKey.startsWith("NSE_EQ|") && !instrKey.includes("INE")) {
        try {
          const hRes = await fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          });
          const hData = await hRes.json();
          if (hData.status === "success" && Array.isArray(hData.data)) {
            const matchedH = hData.data.find(
              (item: any) =>
                (item.trading_symbol || item.tradingsymbol || "").toUpperCase() ===
                String(symbol).toUpperCase(),
            );
            if (matchedH?.instrument_token) {
              instrKey = matchedH.instrument_token;
            }
          }
        } catch {
      // Ignored
    }
      }

      const upstoxProduct = productType === "INTRADAY" ? "I" : "D";
      const upstoxOrderType =
        orderType === "LIMIT" || orderType === "SL" || orderType === "SL-M"
          ? orderType
          : Number(price) > 0
            ? "LIMIT"
            : "MARKET";

      const data = await placeUpstoxOrderIpv4({
        quantity: Number(quantity) || 1,
        product: upstoxProduct,
        validity: "DAY",
        price: upstoxOrderType === "MARKET" || upstoxOrderType === "SL-M" ? 0 : Number((Math.round(Number(price || 0) * 20) / 20).toFixed(2)),
        tag: "manual_ui_order",
        instrument_token: instrKey,
        order_type: upstoxOrderType,
        transaction_type: initialType,
        disclosed_quantity: 0,
        trigger_price: Number(triggerPrice) > 0 ? Number((Math.round(Number(triggerPrice) * 20) / 20).toFixed(2)) : 0,
        is_amo: Boolean(is_amo),
      }, token);
      if (data.status === "success") {
        return res.json({ success: true, order: data.data });
      } else {
        return res.json({
          success: false,
          error: data.errors?.[0]?.message || "Order failed",
        });
      }
    } catch (err: any) {
      return res.json({ success: false, error: err.message });
    }
  }
  res.json({ success: false, error: "Invalid mode" });
});



loadPostgresDb().then(() => {
  setInterval(savePostgresDb, 5000);
  // Continuously poll public webhook relay & Render bridge every 6 seconds when not connected
  setInterval(() => {
    if (!upstoxConfig.accessToken || invalidTokens.has(upstoxConfig.accessToken)) {
      syncTokenFromRenderWebhookBridge().catch(() => { /* ignore */ });
    }
  }, 6000);
});

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
  } catch (err) {}
  return res.json(cachedUpstoxLiveHistory.list || []);
});

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
  } catch (e) {}
  return res.json([]);
});

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
            buyPrice: Number(p.buy_price ?? p.average_price ?? 0),
            currentLTP: Number(p.last_price ?? 0),
            pnl: Number(p.pnl ?? p.unrealised ?? 0),
            realizedPnL: Number(p.realised ?? 0),
            mode: "UPSTOX_LIVE",
          })),
      );
    }
  } catch (e) {}
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
    const { mode, symbol, instrumentKey, quantity, productType, sellPrice } = req.body;
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
      const instrKey = instrumentKey || getInstrumentKey(symbol || posId);
      const isOptionContract =
        /\b(CE|PE)\b/i.test(symbol || posId || "") || String(instrKey).includes("FO");
      const upstoxProduct =
        productType === "INTRADAY" && !isOptionContract
          ? "I"
          : productType === "INTRADAY"
            ? "I"
            : "D";

      const data = await placeUpstoxOrderIpv4({
        quantity: Math.abs(Number(quantity) || 1),
        product: upstoxProduct,
        validity: "DAY",
        price: 0,
        tag: "square_off_order",
        instrument_token: instrKey,
        order_type: "MARKET",
        transaction_type: "SELL",
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

app.post("/api/trading/paper-sync", (req: Request, res: Response) => {
  const { quotes } = req.body;
  if (quotes && Array.isArray(quotes)) {
    paperPositions.splice(0, paperPositions.length, ...paperPositions.map((pos) => {
      const q = quotes.find((x: any) => x.instrumentKey === pos.instrumentKey);
      if (q) {
        if (pos.isOption && q.ltp > pos.buyPrice * 50) {
          // Skip, this is the underlying index price
        } else {
          pos.currentLTP = q.ltp;
          pos.pnl = (q.ltp - pos.buyPrice) * pos.quantity;
          pos.pnlPercent = ((q.ltp - pos.buyPrice) / pos.buyPrice) * 100;
        }
      }
      return pos;
    }));
  }
  res.json({ success: true });
});
}
