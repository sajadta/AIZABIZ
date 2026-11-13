// System-level routes: PWA manifest/service worker, mobile launcher download,
// app icon, trade history, paper-trading reset, IP-warning clear and the
// brokerage-history sync endpoint.
import express from "express";
import type { Request, Response } from "express";
import fsSync from "fs";
import path from "path";
import { botConfig, botLogs, paperPositions, paperTradeHistory, upstoxConfig, resetPaperTradingState } from "../state";
import { savePostgresDb, isPostgresAvailable, setPostgresAvailable } from "../services/persistence";
import { fetchLiveUpstoxCharges } from "../lib/charges";
import { db } from "../../src/db/index";
import { tradeHistory } from "../../src/db/schema";
import { desc } from "drizzle-orm";

export function registerSystemRoutes(app: express.Application) {
app.get("/api/debug-state", (req, res) => {
  res.json({
    upstoxConfig,
    botConfig,
    paperPositions,
    botLogs: botLogs.slice(0, 5),
  });
});

// Dedicated PWA Manifest & Service Worker Endpoints for Android Native Installability
app.get(['/manifest.webmanifest', '/manifest.json'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  const p = path.join(process.cwd(), 'public', 'manifest.webmanifest');
  if (fsSync.existsSync(p)) {
    return res.sendFile(p);
  }
  res.json({
    name: "AIZABIZ PRO Trading Terminal",
    short_name: "AIZABIZ",
    start_url: "/",
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      { src: "/launchericon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/launchericon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/launchericon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  });
});

app.get('/sw.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  const p = path.join(process.cwd(), 'public', 'sw.js');
  if (fsSync.existsSync(p)) {
    return res.sendFile(p);
  }
  res.send('self.addEventListener("install",e=>self.skipWaiting());self.addEventListener("activate",e=>event.waitUntil(self.clients.claim()));');
});

// 1-Click Mobile App Launcher Download (Works on all Android phones without store restrictions)
app.get('/api/download/launcher', (req: Request, res: Response) => {
  res.setHeader('Content-Disposition', 'attachment; filename="AIZABIZ-Trading-Terminal.html"');
  res.setHeader('Content-Type', 'text/html');
  const rawHost = req.get('x-forwarded-host') || req.get('host') || '';
  const isLocal = !rawHost || rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
  const cleanHost = isLocal ? 'ais-dev-2kuhbzz5qyj5zbysxk6da3-173711515136.asia-southeast1.run.app' : rawHost;
  const target = `https://${cleanHost}/?source=mobile_launcher`;
  const launcherHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>AIZABIZ PRO Trading Terminal</title>
  <style>
    body { margin: 0; background: #070a12; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; }
    .loader { width: 44px; height: 44px; border: 4px solid #10b981; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader"></div>
  <h2>AIZABIZ PRO</h2>
  <p>Loading Live Trading Terminal...</p>
  <script>
    window.location.replace("${target}");
  </script>
</body>
</html>`;
  res.send(launcherHtml);
});

// Direct download for high-res 512x512 app icon
app.get('/api/download/icon', (req: Request, res: Response) => {
  const p = path.join(process.cwd(), 'public', 'launchericon-512x512.png');
  res.download(p, 'aizabiz-icon-512.png');
});

app.get('/api/history', async (req, res) => {
  if (!isPostgresAvailable()) {
    return res.json(paperTradeHistory);
  }
  try {
    const rows = await db.select().from(tradeHistory).orderBy(desc(tradeHistory.closeTime)).limit(200);
    res.json(rows.length > 0 ? rows : paperTradeHistory);
  } catch (e) {
    setPostgresAvailable(false);
    res.json(paperTradeHistory);
  }
});

app.post('/api/paper-trading/reset', async (req: Request, res: Response) => {
  resetPaperTradingState();
  if (isPostgresAvailable()) {

    try {
      await db.delete(tradeHistory);
    } catch {
      // Ignored
    }
  }
  savePostgresDb().catch(() => { /* ignore */ });
  return res.json({
    success: true,
    message: "Paper trading account successfully reset to ₹2,000 initial balance with 0 trade history.",
    balance: 2000,
    positions: [],
    orders: [],
    history: []
  });
});

app.post('/api/bot/clear-ip-warning', (req: Request, res: Response) => {
  botLogs.splice(0, botLogs.length, ...botLogs.filter((l) => !l.message?.includes('static IP restrictions')));
  savePostgresDb().catch(() => { /* ignore */ });
  return res.json({ success: true, count: botLogs.length });
});

app.post("/api/bot/sync-history-brokerage", async (req: Request, res: Response) => {
  try {
    const token = upstoxConfig.accessToken;
    if (!token) return res.status(401).json({ error: "No Upstox token" });

    let updatedCount = 0;
    for (const t of paperTradeHistory) {
      if (!t.brokerageCharges || Number(t.brokerageCharges) < 60) {
        const live = await fetchLiveUpstoxCharges(
          t.instrumentKey || t.symbol,
          t.quantity || 1,
          t.buyPrice,
          t.sellPrice || t.currentLTP || t.buyPrice,
          t.product || "D"
        );
        if (live && live.source === "UPSTOX_LIVE_API") {
          t.brokerageCharges = live.totalRoundTrip;
          t.netRealizedPnL = Number(((t.realizedPnL || 0) - live.totalRoundTrip).toFixed(2));
          t.brokerageSource = "UPSTOX_LIVE_API";
          updatedCount++;
        }
      }
    }
    savePostgresDb().catch(() => { /* ignore */ });
    return res.json({ success: true, updatedCount });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});
}
