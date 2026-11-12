import express from "express";

export function registerHealthRoutes(app: express.Application) {
  let lastWakeupPingAt = new Date().toISOString();
  let wakeupPingCount = 0;

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      lastWakeupPingAt,
      wakeupPingCount,
      broker: "Upstox v2 Engine",
    });
  });

  app.get("/api/ping", (_req, res) => {
    res.json({
      status: "awake",
      time: new Date().toISOString(),
      uptime: process.uptime(),
      lastWakeupPingAt,
      wakeupPingCount,
    });
  });

  app.get("/api/wakeup", (_req, res) => {
    res.json({
      status: "awake_24x7",
      message: "Render Anti-Sleep Wakeup Engine Active",
      time: new Date().toISOString(),
      uptime: process.uptime(),
      lastWakeupPingAt,
      wakeupPingCount,
    });
  });

  return () => {
    wakeupPingCount += 1;
    lastWakeupPingAt = new Date().toISOString();
  };
}