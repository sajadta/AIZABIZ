// Paper & live order placement route.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, invalidTokens, botLogs, paperOrders, paperPositions, paperTradeHistory } from "../../state";
import { getPaperInitialCapital, savePostgresDb } from "../../services/persistence";
import { calculateTradeCharges } from "../../../src/utils/indicators";
import { getInstrumentKey } from "../../lib/instruments";
import { isUpstoxAuthFailureError } from "../../utils";
import { placeUpstoxOrderIpv4, getDetectedContainerIp } from "../../services/upstoxTransport";

export function registerOrderRoutes(app: express.Application) {
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
      const realizedPnLSum = paperTradeHistory
        .filter((t: any) => !t.mode || t.mode === "PAPER_TRADING")
        .reduce((sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0);
      const openPositionsCost = paperPositions
        .filter((p: any) => !p.mode || p.mode === "PAPER_TRADING")
        .reduce((sum: number, p: any) => sum + (Number(p.buyPrice || 0) * Number(p.quantity || 1)), 0);
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
    const headerToken = req.headers.authorization?.replace("Bearer ", "").trim() || "";
    const token =
      headerToken && !invalidTokens.has(headerToken)
        ? headerToken
        : upstoxConfig.accessToken;
    if (!token || invalidTokens.has(token)) {
      return res
        .status(401)
        .json({ success: false, error: "Upstox Token missing or expired" });
    }

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
        paperOrders.unshift({
          id: "ORD" + Date.now(),
          orderId: data.data?.order_id || "LIVE_" + Date.now().toString().slice(-6),
          symbol,
          instrumentKey: instrKey,
          transactionType: initialType || "BUY",
          type: initialType || "BUY",
          orderType: upstoxOrderType,
          productType: productType || "INTRADAY",
          quantity: Number(quantity) || 1,
          price: Number(price) || 0,
          executedPrice: Number(price) || 0,
          status: "COMPLETE",
          timestamp: new Date().toLocaleTimeString("en-IN"),
          time: new Date().toISOString(),
          mode: "UPSTOX_LIVE",
        });
        if (paperOrders.length > 200) paperOrders.length = 200;
        savePostgresDb().catch(() => { /* ignore */ });
        return res.json({ success: true, order: data.data });
      } else {
        if (isUpstoxAuthFailureError(200, data)) {
          invalidTokens.add(token);
        }
        let errDetail = data.errors?.[0]?.message || data.message || "Order failed";
        if (errDetail.includes("static IP") || errDetail.includes("UDAPI1154")) {
          const detectedIp = await getDetectedContainerIp();
          errDetail = `Upstox Static IP error: Whitelist ${detectedIp || "container IP"} in Upstox Developer Console. (${errDetail})`;
        }
        botLogs.unshift({
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[MANUAL LIVE ORDER REJECTED] ${symbol}: ${errDetail}`,
          type: "ERROR",
        });
        if (botLogs.length > 200) botLogs.length = 200;
        return res.status(400).json({
          success: false,
          error: errDetail,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  res.json({ success: false, error: "Invalid mode" });
});
}
