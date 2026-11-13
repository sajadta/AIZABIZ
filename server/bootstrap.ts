// Server bootstrap: loads persisted state, wires the Vite dev middleware or the
// production static build, starts the HTTP listener and attaches Socket.IO plus
// the raw WebSocket upgrade handler.
import express from "express";
import path from "path";
import type { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";
import { upstoxConfig, botConfig } from "./state";
import { loadPostgresDb } from "./services/persistence";
import { syncTokenFromRenderWebhookBridge } from "./services/tokenSync";
import { warmUpUpstoxTransport } from "./services/upstoxTransport";
import { wss } from "./realtime";

const _require = typeof require !== "undefined" ? require : createRequire(import.meta.url);

export async function bootstrap(app: express.Application, port: number) {
  await loadPostgresDb().catch(() => { /* ignore */ });
  warmUpUpstoxTransport();
  if (!upstoxConfig.accessToken) {
    syncTokenFromRenderWebhookBridge().catch(() => {});
  }
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { maxAge: "30d", dotfiles: "allow" }));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Upstox Live Algo Server running on http://0.0.0.0:${port}`);
  });

  try {
    const { Server: SocketIOServer } = _require("socket.io");
    const io = new SocketIOServer(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    io.on("connection", (socket: any) => {
      console.log("Client connected to WebSockets:", socket.id);
      socket.emit("botConfig", botConfig);
      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });

    (global as any).io = io;
  } catch (e) {
    console.warn("Socket.IO initialization warning:", e);
  }

  server.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/api/ws")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else if (!request.url?.startsWith("/socket.io")) {
      socket.destroy();
    }
  });
}
