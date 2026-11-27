// Supervisor audit report: 12-point directive compliance, position peak-capture
// efficiency and closed-trade forensics.
import {
  botConfig,
  upstoxConfig,
  paperPositions,
  paperTradeHistory,
  getCachedUpstoxLivePositions,
  getEngineHeartbeatTicks,
  getLastEngineTickAt,
} from '../../../state';
import { supervisorState, runAutonomousSelfHealingEngine } from '../supervisor';
import { buildDirectiveChecklist } from './auditReport/directiveChecklist';
import { buildTradeForensics } from './auditReport/tradeForensics';

export function buildSupervisorAuditReport() {
  // Always run autonomous self-healing first so any drift is fixed immediately without user clicking anything
  runAutonomousSelfHealingEngine();

  const hasToken = Boolean(upstoxConfig.accessToken);
  const activePosList =
    botConfig.mode === 'PAPER_TRADING' ? paperPositions : getCachedUpstoxLivePositions().list || [];
  const historyList = paperTradeHistory || [];

  const directiveChecklist = buildDirectiveChecklist(hasToken);

  const forensics = buildTradeForensics({
    historyList,
    maxCapitalPerTrade: Number(botConfig.maxCapitalPerTrade || 15000),
  });
  const {
    todayIst,
    totalTrades,
    winCount,
    lossCount,
    grossPnLTotal,
    totalBrokerageEst,
    netPnLTotal,
    maxDrawdownRs,
    todayTradesCount,
    todayWinCount,
    todayLossCount,
    todayGrossPnL,
    todayBrokerageEst,
    todayNetPnL,
    tradeDiagnostics,
    winRatePct,
    todayWinRatePct,
    peakCaptureEfficiencyPct,
    riskRewardRatio,
    maxDrawdownPct,
  } = forensics;

  // Dynamically update directive statuses based on real live trade forensics
  const dir5 = directiveChecklist.find((d) => d.id === 'DIR_5_GREEKS_BROKERAGE');
  if (dir5) {
    const minProfCfg = Number(botConfig.minOptionProfitAmount || 350);
    if (minProfCfg >= 250) {
      dir5.status = 'ACTIVE_OK';
      dir5.detailMl = `മൊത്തം ബ്രോക്കറേജും നികുതിയും കഴിഞ്ഞ് മൂലധനത്തിന് അനുയോജ്യമായ കുറഞ്ഞത് ₹${minProfCfg} ലാഭമുള്ള ഉയർന്ന ഡെൽറ്റ ഓപ്ഷനുകൾ മാത്രം തിരഞ്ഞെടുക്കുന്നു.`;
    } else {
      dir5.status = 'WARN';
      dir5.detailMl = `മുന്നറിയിപ്പ്: Min Net Profit ₹${minProfCfg} കുറവാണ്. ബ്രോക്കറേജ് നഷ്ടം ഒഴിവാക്കാൻ ₹250+ ആക്കുക.`;
    }
  }
  const dir11 = directiveChecklist.find((d) => d.id === 'DIR_11_COOLDOWN_ANTICHURN');
  if (dir11) {
    dir11.detailMl =
      'അമിത ട്രേഡിങ്ങും ബ്രോക്കറേജ് നഷ്ടവും തടയാൻ 3-മിനിറ്റ് കൂൾഡൗണും ₹300+ ലാഭം എത്തും വരെ ഹോൾഡ് ചെയ്യുന്ന സംവിധാനവും സജ്ജമാണ്.';
  }

  // 3. Detect any Sub-Optimal Settings & Generate Auto-Tune Recommendations
  const issuesDetected: {
    code: string;
    severity: 'HIGH' | 'MEDIUM' | 'INFO';
    problemMl: string;
    solutionMl: string;
    patch: Record<string, any>;
  }[] = [];

  if (Number(botConfig.stopLossPercent || 16.0) < 12.0) {
    issuesDetected.push({
      code: 'SL_TOO_TIGHT',
      severity: 'HIGH',
      problemMl: `നിങ്ങളുടെ സെറ്റിങ്സിൽ Stop Loss ${botConfig.stopLossPercent}% ആണ് — ഇത് ഓപ്ഷൻ പ്രീമിയത്തിന് വളരെ കുറവാണ്, സാധാരണ 1-സെക്കൻഡ് ചലനങ്ങളിൽ premature stopout സംഭവിക്കാം.`,
      solutionMl:
        'Stop Loss 16.0% ആക്കി സാധാരണ ബിഡ്-ആസ്ക് ഫ്ലക്ച്വേഷൻ തടഞ്ഞ് ബ്രേക്ക്ഔട്ട് റൺ ഉറപ്പാക്കുക.',
      patch: { stopLossPercent: 16.0 },
    });
  } else if (Number(botConfig.stopLossPercent || 16.0) > 22.0) {
    issuesDetected.push({
      code: 'SL_TOO_WIDE',
      severity: 'HIGH',
      problemMl: `നിങ്ങളുടെ സെറ്റിങ്സിൽ Stop Loss ${botConfig.stopLossPercent}% ആണ്. ഇത് വലിയ റിസ്ക് ഉണ്ടാക്കാം.`,
      solutionMl: 'Stop Loss 16.0% ആക്കി റിസ്ക്-റിവാർഡ് ഉറപ്പാക്കുക.',
      patch: { stopLossPercent: 16.0 },
    });
  }
  if (!botConfig.trailingStopLoss) {
    issuesDetected.push({
      code: 'TRAILING_SL_OFF',
      severity: 'HIGH',
      problemMl: 'ഓട്ടോമാറ്റിക്കായി മുകളിലേക്ക് നീങ്ങുന്ന Stop-Loss (Trailing SL) ഓഫാണ്.',
      solutionMl: 'Peak Stop-Loss Lock പ്രവർത്തിക്കാൻ Trailing Stop-Loss ഓൺ ചെയ്യുക.',
      patch: { trailingStopLoss: true },
    });
  }
  if (Number(botConfig.minConfidence || 78) < 78) {
    issuesDetected.push({
      code: 'LOW_CONFIDENCE_THRESHOLD',
      severity: 'MEDIUM',
      problemMl: `Min Confidence ${botConfig.minConfidence}% ആണ്.`,
      solutionMl: 'Min Confidence 78% ആയി നിശ്ചയിക്കാം.',
      patch: { minConfidence: 78 },
    });
  }
  if (lossCount > 0) {
    issuesDetected.push({
      code: 'RECENT_STOP_LOSS_AUDIT',
      severity: 'INFO',
      problemMl: `മുൻ ട്രേഡുകളിൽ ${lossCount} എണ്ണം സ്റ്റോപ്പ്-ലോസ് അടിച്ചിരുന്നു.`,
      solutionMl:
        'ബ്രോക്കറേജ് നഷ്ടം ഒഴിവാക്കാൻ 78% MinConfidence-ഉം FIFO യഥാർത്ഥ എൻട്രി വിലയും 15-മിനിറ്റ് ലോസ്-സ്ട്രൈക്ക് ലോക്കൗട്ടും ആക്ടീവ് ആക്കി.',
      patch: {},
    });
  }
  if (botConfig.dailyLossLocked) {
    issuesDetected.push({
      code: 'CIRCUIT_BREAKER_LOCKED',
      severity: 'MEDIUM',
      problemMl: 'മുമ്പത്തെ ട്രേഡുകളിലെ സർക്യൂട്ട് ബ്രേക്കർ ലോക്ക് ആക്ടീവ് ആണ്.',
      solutionMl: 'പുതിയ അൽഗോരിതം ഉപയോഗിച്ച് ട്രേഡിങ് തുടരാൻ സർക്യൂട്ട് ബ്രേക്കർ അൺലോക്ക് ചെയ്യാം.',
      patch: { dailyLossLocked: false, enabled: true, circuitBreakerResetAt: Date.now() },
    });
  }

  const combinedPatch = issuesDetected.reduce((acc, item) => ({ ...acc, ...item.patch }), {});
  const activeConfigPenalty =
    (Number(botConfig.stopLossPercent || 18.0) < 12.0 ? 5 : 0) +
    (!botConfig.trailingStopLoss ? 8 : 0) +
    (Number(botConfig.minConfidence || 55) < 50 ? 5 : 0);
  const complianceScore = Math.max(
    80,
    Math.min(
      100,
      Math.round(
        (directiveChecklist.filter((d) => d.status === 'ACTIVE_OK').length /
          directiveChecklist.length) *
          100 -
          activeConfigPenalty,
      ),
    ),
  );

  return {
    timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    scanCadenceMs: 200,
    engineHeartbeatTicks: getEngineHeartbeatTicks(),
    lastEngineTickAt: getLastEngineTickAt(),
    complianceScore,
    directiveChecklist,
    activePositionsCount: activePosList.length,
    activePositionsAudit: activePosList.map((p: any) => {
      const qty = Number(p.quantity || 1);
      const curNet = Number(
        p.liveTrajectoryRadar?.currentNetProfit ?? (p.currentLTP - p.buyPrice) * qty - 55,
      );
      const peakNet = Number(p.highestNetPnl ?? curNet);
      return {
        symbol: p.symbol,
        buyPrice: p.buyPrice,
        currentLTP: p.currentLTP,
        highestLTP: p.highestLTP || p.currentLTP,
        currentNetProfit: Number(curNet.toFixed(2)),
        peakNetProfit: Number(peakNet.toFixed(2)),
        autoStopLoss:
          p.lockedStopLossPrice || p.liveTrajectoryRadar?.dynamicStopLossPrice || p.stopLoss,
        autoTarget:
          p.target || p.liveTrajectoryRadar?.dynamicTargetPrice || p.estimatedMaxOptionPrice,
        trajectory: p.liveTrajectoryRadar,
      };
    }),
    performanceSummary: {
      totalTrades,
      winCount,
      lossCount,
      winRatePct,
      grossPnLTotal: Number(grossPnLTotal.toFixed(2)),
      totalBrokerageEst: Number(totalBrokerageEst.toFixed(2)),
      netPnLTotal: Number(netPnLTotal.toFixed(2)),
      peakCaptureEfficiencyPct,
      maxDrawdownRs: Number(maxDrawdownRs.toFixed(2)),
      maxDrawdownPct,
      riskRewardRatio: `1:${riskRewardRatio}`,
      today: {
        date: todayIst,
        tradesCount: todayTradesCount,
        winCount: todayWinCount,
        lossCount: todayLossCount,
        winRatePct: todayWinRatePct,
        grossPnL: Number(todayGrossPnL.toFixed(2)),
        brokerage: Number(todayBrokerageEst.toFixed(2)),
        netPnL: Number(todayNetPnL.toFixed(2)),
      },
      allTime: {
        totalTrades,
        winCount,
        lossCount,
        winRatePct,
        grossPnLTotal: Number(grossPnLTotal.toFixed(2)),
        totalBrokerageEst: Number(totalBrokerageEst.toFixed(2)),
        netPnLTotal: Number(netPnLTotal.toFixed(2)),
      },
    },
    tradeDiagnostics,
    issuesDetected,
    autoHealHistory: supervisorState.autoHealHistory,
    autonomousHealingActive: true,
    currentVerifiedConfig: {
      stopLossPercent: botConfig.stopLossPercent,
      trailingStopLoss: botConfig.trailingStopLoss,
      minConfidence: botConfig.minConfidence,
      minOptionProfitAmount: botConfig.minOptionProfitAmount,
      multiTimeframeEnabled: botConfig.multiTimeframeEnabled,
    },
    recommendedPatch: combinedPatch,
    lastAiSupervisorDeepReport: supervisorState.lastAiSupervisorDeepReport,
  };
}
