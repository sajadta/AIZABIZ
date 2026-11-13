// Real-time quote streaming: Server-Sent Events endpoint plus the raw
// WebSocket server used for /api/ws quote broadcasts.
import express from "express";
import { WebSocketServer } from "ws";
import { upstoxConfig, invalidTokens, getLastQuotesCache } from "./state";
import { refreshCentralUpstoxQuotes } from "./services/marketData";

export const wss = new WebSocketServer({ noServer: true });

export function registerRealtimeRoutes(app: express.Application) {
app.get("/api/stream/quotes", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let symbols =
    "NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX,BSE_INDEX|BANKEX,NSE_INDEX|Nifty Fin Service";
  if (req.query.symbols as string) {
    symbols = req.query.symbols as string;
  }

  // Send an initial connected message
  res.write('data: {"type": "CONNECTED"}\n\n');

  const fetchAndPushQuotes = async () => {
    res.write(":\n\n");
    const token = upstoxConfig.accessToken;
    if (!token) return;
    try {
      const result =
        Date.now() - getLastQuotesCache().timestamp < 300 && getLastQuotesCache().quotes.length > 0
          ? getLastQuotesCache()
          : await refreshCentralUpstoxQuotes(token);
      if (result.quotes && result.quotes.length > 0) {
        res.write(
          `data: ${JSON.stringify({ type: "QUOTES", data: result.quotes })}\n\n`,
        );
      }
    } catch (err) {
      // Quietly ignored
    }
  };

  const quoteInterval = setInterval(fetchAndPushQuotes, 1000);
  req.on("close", () => {
    clearInterval(quoteInterval);
  });
});

const subscribedKeys = new Set<string>([
  "NSE_INDEX|Nifty 50",
  "NSE_INDEX|Nifty Bank",
  "BSE_INDEX|SENSEX",
  "BSE_INDEX|BANKEX",
  "NSE_INDEX|Nifty Fin Service",
]);

async function broadcastUpstoxQuotesToWs() {
  const token = upstoxConfig.accessToken;
  if (!token || invalidTokens.has(token)) return;

  try {
    const result =
      Date.now() - getLastQuotesCache().timestamp < 1100 && getLastQuotesCache().quotes.length > 0
        ? getLastQuotesCache()
        : await refreshCentralUpstoxQuotes(token);
    if (result.quotes && result.quotes.length > 0 && wss.clients.size > 0) {
      const msgStr = JSON.stringify({ type: "QUOTES", data: result.quotes });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(msgStr);
        }
      });
    }
  } catch (e) {}
}

wss.on("connection", (ws) => {
  (ws as any).isAlive = true;
  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG" }));
      }
      if (msg.type === "SUBSCRIBE") {
        const keys = msg.keys || [];
        keys.forEach((k: string) => {
          if (k) subscribedKeys.add(k);
        });
        broadcastUpstoxQuotesToWs();
      }
    } catch (e) {
      // Ignored
    }
  });
});

// Real-Time WS Broadcast & Heartbeat (800ms)
let wsPingCounter = 0;
setInterval(() => {
  wsPingCounter += 1;
  if (wsPingCounter % 10 === 0) {
    wss.clients.forEach((ws) => {
      if (!(ws as any).isAlive) return ws.terminate();
      (ws as any).isAlive = false;
      ws.ping();
    });
  }
  broadcastUpstoxQuotesToWs();
}, 800);
}
