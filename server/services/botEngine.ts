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

let activeTickId = 0;

export function startBotEngine() {
setInterval(async () => {
  setEngineHeartbeatTicks(getEngineHeartbeatTicks() + 1);
  setLastEngineTickAt(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));

  // Watchdog auto-release only after 25s (a 6-index scan takes ~3-7s, so 3s previously overlapped concurrent ticks!)
  if (getIsBotTickRunning() && Date.now() - getLastBotTickStartedAt() > 25000) {
    setIsBotTickRunning(false);
  }

  if (!botConfig.enabled || getIsBotTickRunning()) return;
  const myTickId = ++activeTickId;
  setIsBotTickRunning(true);
  setLastBotTickStartedAt(Date.now());

  try {
    const ctx = await prepareTickContext();
    if (!ctx) {
      return;
    }

    // 1. Process active positions for Auto-Square Off (Target/SL)
    await monitorActivePositions({
      token: ctx.token,
      activePositions: ctx.activePositions,
      liveQuotesMap: ctx.liveQuotesMap,
      isEodSquareOff: ctx.isEodSquareOff,
    });

    // 2. Scan markets & evaluate entries (runEntryScan internally blocks new orders when dailyLossLocked is true)
    await runEntryScan({
      token: ctx.token,
      activePositions: ctx.activePositions,
      liveQuotesMap: ctx.liveQuotesMap,
      nowIst: ctx.nowIst,
    });
  } catch (err) {
    console.error("Bot loop error:", err);
  } finally {
    if (activeTickId === myTickId) {
      setIsBotTickRunning(false);
    }
  }}, 200);
}
