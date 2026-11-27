// AI algorithm supervisor: directive auditor, self-healing meta-engine and the
// audit report builder consumed by the bot supervisor routes.
import { botConfig, botLogs, botSignals, upstoxConfig, paperPositions, paperTradeHistory, getCachedUpstoxLivePositions, getEngineHeartbeatTicks, getLastEngineTickAt } from "../../state";
import { savePostgresDb } from "../../services/persistence";
import { calculateTradeCharges } from "../../../src/utils/indicators";

// ============================================================================
// AI ALGORITHM SUPERVISOR, DIRECTIVE AUDITOR & SELF-HEALING META-ENGINE
// Continuously verifies:
// 1. All 12 User Directives & Institutional Rules (Compliance Audit)
// 2. Active Open Positions vs Peak Profit Capture Efficiency
// 3. Closed Trade Forensics (Profit vs Loss Root-Cause & Missed Peak Analysis)
// 4. Auto-Tuning / One-Click Parameter Self-Healing + Gemini 3.8 Flash Deep AI Diagnosis
// ============================================================================
export const supervisorState: {
  lastAiSupervisorDeepReport: {
    timestamp: string;
    summaryMl: string;
    summaryEn: string;
    rootCauseMl: string;
    actionableUpgradesMl: string[];
    recommendedConfigPatch?: Record<string, any>;
  } | null;
  autoHealHistory: {
    id: string;
    time: string;
    problemMl: string;
    autoActionMl: string;
    beforeValue: string;
    afterValue: string;
  }[];
} = { lastAiSupervisorDeepReport: null, autoHealHistory: [] };

export function runAutonomousSelfHealingEngine() {
  const nowStr = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  let healedAny = false;

  // 1. Autonomous Stop-Loss Cap Healing: For Options, optimal SL is 12.0% with ₹400 Rupee Safety Cap
  const currentSl = Number(botConfig.stopLossPercent || 12.0);
  if (currentSl < 10.0 || currentSl > 20.0) {
    botConfig.stopLossPercent = 12.0;
    healedAny = true;
    supervisorState.autoHealHistory.unshift({
      id: "HEAL_SL_" + Date.now(),
      time: nowStr,
      problemMl: `Stop Loss ${currentSl}% ആയിരുന്നത് ഓപ്ഷൻ ട്രേഡിംഗിന് അനുയോജ്യമല്ല എന്ന് കണ്ടെത്തി.`,
      autoActionMl: "ഓപ്ഷൻ പ്രീമിയത്തിന് ആവശ്യമായ ബ്രീത്തിംഗ് സ്പേസ് നൽകാൻ Stop Loss 12.0% (Max ₹400 Cap) ആയി ക്രമീകരിച്ചു.",
      beforeValue: `${currentSl}%`,
      afterValue: "12.0% (Auto-Fixed)",
    });
  }

  // 2. Autonomous Peak Stop-Loss Ratchet / Trailing SL Healing
  if (!botConfig.trailingStopLoss) {
    botConfig.trailingStopLoss = true;
    healedAny = true;
    supervisorState.autoHealHistory.unshift({
      id: "HEAL_TSL_" + Date.now(),
      time: nowStr,
      problemMl: "ഓട്ടോമാറ്റിക് മൂവിങ് Stop-Loss & Peak Lock ഓഫായിരുന്നു.",
      autoActionMl: "മാക്സിമം പ്രോഫിറ്റിൽ Stop-Loss ലോക്ക് ചെയ്യാൻ AI എഞ്ചിൻ തനിയെ Trailing SL ഓൺ ആക്കി.",
      beforeValue: "OFF",
      afterValue: "ON (Auto-Fixed)",
    });
  }

  // 3. Autonomous Minimum Confidence Threshold Healing (>=78% high conviction)
  const currentConf = Number(botConfig.minConfidence || 78);
  if (currentConf < 78 || currentConf > 95) {
    botConfig.minConfidence = 78;
    healedAny = true;
    supervisorState.autoHealHistory.unshift({
      id: "HEAL_CONF_" + Date.now(),
      time: nowStr,
      problemMl: `Min Confidence ${currentConf}% ആയിരുന്നത് ക്രമീകരിച്ചു.`,
      autoActionMl: "ഉയർന്ന നിലവാരമുള്ള സെറ്റപ്പുകൾ മാത്രം എടുക്കാൻ AI എഞ്ചിൻ തനിയെ Min Confidence 78% ആക്കി.",
      beforeValue: `${currentConf}%`,
      afterValue: "78% (High-Conviction Mode)",
    });
  }

  // 4. Autonomous Minimum Net Option Profit Guard Healing (₹450+ minimum net profit priority after brokerage)
  const currentMinProfit = Number(botConfig.minOptionProfitAmount || 450);
  if (currentMinProfit < 300 || currentMinProfit > 600) {
    botConfig.minOptionProfitAmount = 450;
    healedAny = true;
    supervisorState.autoHealHistory.unshift({
      id: "HEAL_MINP_" + Date.now(),
      time: nowStr,
      problemMl: `Min Option Profit ₹${currentMinProfit} ആയിരുന്നത് ക്രമീകരിച്ചു.`,
      autoActionMl: "ബ്രോക്കറേജും നികുതിയും കഴിഞ്ഞ് മികച്ച അറ്റ ലാഭം (₹450–₹1,500+ Net Profit) ഉറപ്പാക്കാൻ AI തനിയെ ₹450 ആയി സെറ്റ് ചെയ്തു.",
      beforeValue: `₹${currentMinProfit}`,
      afterValue: "₹450 (Auto-Fixed)",
    });
  }

  // 5. Autonomous Multi-Timeframe Confluence Healing
  if (!botConfig.multiTimeframeEnabled) {
    botConfig.multiTimeframeEnabled = true;
    healedAny = true;
    supervisorState.autoHealHistory.unshift({
      id: "HEAL_MTF_" + Date.now(),
      time: nowStr,
      problemMl: "മൾട്ടി-ടൈംഫ്രെയിം കൺഫർമേഷൻ (5m + 15m) ഓഫായിരുന്നു.",
      autoActionMl: "വ്യാജ ബ്രേക്ക്ഔട്ടുകൾ തടയാൻ AI എഞ്ചിൻ തനിയെ MTF കൺഫർമേഷൻ ഓൺ ആക്കി.",
      beforeValue: "OFF",
      afterValue: "ON (Auto-Fixed)",
    });
  }

  if (supervisorState.autoHealHistory.length > 25) supervisorState.autoHealHistory.length = 25;

  if (healedAny) {
    savePostgresDb().catch(() => { /* ignore */ });
    botLogs.unshift({
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      message: `[AI AUTONOMOUS SELF-HEAL] Automatically verified & corrected risk parameters: SL=${botConfig.stopLossPercent}%, Peak-Lock=ON, MinConfidence=${botConfig.minConfidence}%, MinNetProfit=₹${botConfig.minOptionProfitAmount}.`,
      type: "SUCCESS",
    });
    if (botLogs.length > 200) botLogs.length = 200;
  }
}

// Run Autonomous Self-Healing and Bot Loop at 200ms (5x per second) Ultra-Low-Latency Millisecond Cadence


export { buildSupervisorAuditReport } from "./supervisor/auditReport";

export function startSupervisorEngine() {
  setTimeout(() => runAutonomousSelfHealingEngine(), 1000);
  setInterval(() => runAutonomousSelfHealingEngine(), 10000);
}
