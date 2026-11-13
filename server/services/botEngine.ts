// Autonomous trading bot engine.
// Runs the ultra-low-latency 200ms tick loop that evaluates entries/exits,
// manages trailing stops, and places live/paper orders.
import {
  getEngineHeartbeatTicks, setEngineHeartbeatTicks, setLastEngineTickAt,
  getIsBotTickRunning, setIsBotTickRunning, getLastBotTickStartedAt, setLastBotTickStartedAt,
} from "../state";
import { botConfig } from "../state";
import { prepareTickContext } from "./bot/liveFeed";
import { monitorActivePositions } from "./bot/positionMonitor";
import { runEntryScan } from "./bot/entryScan";

export function startBotEngine() {
setInterval(async () => {
  setEngineHeartbeatTicks(getEngineHeartbeatTicks() + 1);
  setLastEngineTickAt(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));

  // Watchdog auto-release: if a previous tick held the lock for >3000ms, force release it!
  if (getIsBotTickRunning() && Date.now() - getLastBotTickStartedAt() > 3000) {
    setIsBotTickRunning(false);
  }

  if (!botConfig.enabled || getIsBotTickRunning()) return;
  setIsBotTickRunning(true);
  setLastBotTickStartedAt(Date.now());

  try {
    const ctx = await prepareTickContext();
    if (!ctx) {
      setIsBotTickRunning(false);
      return;
    }

    // 1. Process active positions for Auto-Square Off (Target/SL)
    await monitorActivePositions({
      token: ctx.token,
      activePositions: ctx.activePositions,
      liveQuotesMap: ctx.liveQuotesMap,
      isEodSquareOff: ctx.isEodSquareOff,
    });

    // 2. If no positions, look for entry
    await runEntryScan({
      token: ctx.token,
      activePositions: ctx.activePositions,
      liveQuotesMap: ctx.liveQuotesMap,
      nowIst: ctx.nowIst,
    });
  } catch (err) {
    console.error("Bot loop error:", err);
  } finally {
    setIsBotTickRunning(false);
  }}, 200);
}
