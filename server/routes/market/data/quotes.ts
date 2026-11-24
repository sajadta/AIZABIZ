// Live market quotes route with NSE fallback feed.
import type { Request, Response } from "express";
import { upstoxConfig, getLastQuotesCache } from "../../../state";
import { refreshCentralUpstoxQuotes, fetchRealNseQuotesFallback } from "../../../services/marketData";

export function registerQuoteRoutes(app: any) {
  app.get("/api/market/quotes", async (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      upstoxConfig.accessToken;

    const customSymbols = req.query.symbols as string | undefined;
    if (!customSymbols && getLastQuotesCache().quotes.length > 0 && Date.now() - getLastQuotesCache().timestamp < 1000) {
      return res.json({ status: "success", data: getLastQuotesCache().data, quotes: getLastQuotesCache().quotes });
    }

    if (token) {
      const result = await refreshCentralUpstoxQuotes(token, customSymbols);
      if (result.quotes.length > 0) {
        if (!customSymbols) {
          // Also merge commodities and global feeds if Upstox segment doesn't provide MCX/Global
          const fallbackQuotes = await fetchRealNseQuotesFallback();
          const mergedMap = new Map<string, any>();
          result.quotes.forEach((q: any) => {
            if (q && (q.instrumentKey || q.symbol)) {
              mergedMap.set(q.instrumentKey || q.symbol, q);
            }
          });
          fallbackQuotes.forEach((fb: any) => {
            if (fb && (fb.instrumentKey || fb.symbol)) {
              const key = fb.instrumentKey || fb.symbol;
              if (!mergedMap.has(key) || (mergedMap.get(key)?.ltp || 0) <= 0) {
                mergedMap.set(key, fb);
              }
            }
          });
          const combinedQuotes = Array.from(mergedMap.values());
          return res.json({ status: "success", data: result.data, quotes: combinedQuotes });
        }
        return res.json({ status: "success", data: result.data, quotes: result.quotes });
      }
    }

    // Automatic Real NSE/BSE Market Quote Fallback (when Upstox daily token is expired or after market hours)
    const fallbackQuotes = await fetchRealNseQuotesFallback();
    if (fallbackQuotes.length > 0) {
      return res.json({ status: "success", data: {}, quotes: fallbackQuotes, source: "NSE_OFFICIAL_FEED" });
    }

    return res.status(503).json({ error: "Waiting for Upstox live quote tick" });
  });
}
