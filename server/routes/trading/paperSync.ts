// Paper position LTP sync route.
import express from "express";
import type { Request, Response } from "express";
import { paperPositions } from "../../state";

export function registerPaperSyncRoutes(app: express.Application) {
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
