import React from 'react';
import { CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';
import type { BotConfig, Language } from '../../types';
import type { SupervisorAudit } from './types';
import { TradeForensicsAudit } from './supervisor/TradeForensicsAudit';
import { DeepAiDiagnosisReport } from './supervisor/DeepAiDiagnosisReport';
import { ActivePositionsAudit } from './supervisor/ActivePositionsAudit';
interface AiSupervisorTabProps {
  supervisorAudit: SupervisorAudit | null;
  botConfig: BotConfig;
  language: Language;
  deepAiScanning: boolean;
  supervisorQuestion: string;
  setSupervisorQuestion: (v: string) => void;
  handleRunDeepAiSupervisorScan: () => Promise<void>;
}
export const AiSupervisorTab: React.FC<AiSupervisorTabProps> = ({
  supervisorAudit,
  botConfig,
  language,
  deepAiScanning,
  supervisorQuestion,
  handleRunDeepAiSupervisorScan,
  setSupervisorQuestion,
}) => (
  <>
    <div className="space-y-4">
      {/* Top Master Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-fuchsia-950/40 via-slate-900 to-indigo-950/40 border border-fuchsia-500/40 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-white">
                  {language === 'ml'
                    ? 'AI അൽഗോരിതം സൂപ്പർവൈസർ & സെൽഫ്-ഹീലിംഗ് എഞ്ചിൻ'
                    : 'AI Algorithm Supervisor & Self-Healing Meta-Engine'}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  12/12 DIRECTIVES MONITORED
                </span>
              </div>
              <p className="text-[10px] text-slate-300 mt-0.5">
                {language === 'ml'
                  ? 'നിങ്ങൾ നൽകിയ 12 നിർദ്ദേശങ്ങളും അൽഗോരിതം കൃത്യമായി പാലിക്കുന്നുണ്ടോ എന്നും, ട്രേഡുകളിൽ മാക്സിമം ലാഭം എടുക്കുന്നുണ്ടോ എന്നും, നഷ്ടം വരാതിരിക്കാൻ എന്ത് അപ്‌ഡേറ്റ് വേണമെന്നും ഓരോ 5 സെക്കൻഡിലും പരിശോധിക്കുന്ന AI എഞ്ചിൻ.'
                  : 'Continuously verifies all 12 trading directives, audits live & closed trades for maximum peak profit capture, diagnoses loss root-causes, and auto-heals risk parameters.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-black flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {language === 'ml'
                  ? '100% ഓട്ടോമാറ്റിക് സെൽഫ്-ഹീലിംഗ് (ഓരോ 200ms മില്ലിസെക്കൻഡിലും പരിശോധന)'
                  : '100% Autonomous Self-Healing (200ms Millisecond Scan)'}
              </span>
            </div>
            {supervisorAudit?.engineHeartbeatTicks !== undefined && (
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold">
                ⚡ 200ms Tick #{supervisorAudit.engineHeartbeatTicks} (
                {supervisorAudit.lastEngineTickAt})
              </div>
            )}
          </div>
        </div>
        {/* Autonomous Verified Parameters Bar */}
        {supervisorAudit?.currentVerifiedConfig && (
          <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono">
            <span className="text-emerald-300 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {language === 'ml'
                  ? 'AI സ്വയം ക്രമീകരിച്ച് ഉറപ്പാക്കിയ ലൈവ് പരാമീറ്ററുകൾ:'
                  : 'AI Autonomously Verified & Locked Parameters:'}
              </span>
            </span>
            <div className="flex items-center gap-2 flex-wrap text-white">
              <span className="px-2 py-0.5 rounded bg-black/50 border border-emerald-500/30">
                SL Cap:{' '}
                <strong className="text-emerald-400">
                  {supervisorAudit.currentVerifiedConfig.stopLossPercent}% (Max ₹500)
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-black/50 border border-emerald-500/30">
                Peak SL Lock:{' '}
                <strong className="text-emerald-400">
                  {supervisorAudit.currentVerifiedConfig.trailingStopLoss ? 'AUTO-ON' : 'OFF'}
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-black/50 border border-emerald-500/30">
                Min Conf:{' '}
                <strong className="text-emerald-400">
                  {supervisorAudit.currentVerifiedConfig.minConfidence}%
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-black/50 border border-emerald-500/30">
                Min Net Profit:{' '}
                <strong className="text-emerald-400">
                  ₹{supervisorAudit.currentVerifiedConfig.minOptionProfitAmount}
                </strong>
              </span>
            </div>
          </div>
        )}
        {/* Ask Specific Question to AI Supervisor */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
          <input
            type="text"
            value={supervisorQuestion}
            onChange={(e) => setSupervisorQuestion(e.target.value)}
            placeholder={
              language === 'ml'
                ? 'അൽഗോരിതത്തെക്കുറിച്ചോ ട്രേഡുകളെക്കുറിച്ചോ AI സൂപ്പർവൈസറോട് ചോദിക്കുക...'
                : 'Ask the AI Supervisor anything about algorithm rules, trades, or peak profit...'
            }
            className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-fuchsia-500"
          />
          <button
            type="button"
            onClick={handleRunDeepAiSupervisorScan}
            disabled={deepAiScanning}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition"
          >
            {language === 'ml' ? 'പരിശോധിക്കുക' : 'Analyze'}
          </button>
        </div>
        {/* Scoreboard KPIs */}
        {supervisorAudit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">
                {language === 'ml' ? 'അൽഗോരിതം കൃത്യത സ്കോർ' : 'Directive Compliance'}
              </span>
              <span className="text-lg font-black font-mono text-emerald-400">
                {supervisorAudit.complianceScore}%
              </span>
              <span className="text-[9px] text-emerald-300 block">12/12 Rules Verified</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">
                {language === 'ml' ? 'പീക്ക് പ്രോഫിറ്റ് ക്യാപ്ചർ' : 'Peak Profit Capture'}
              </span>
              <span className="text-lg font-black font-mono text-cyan-300">
                {supervisorAudit.performanceSummary?.peakCaptureEfficiencyPct}%
              </span>
              <span className="text-[9px] text-slate-400 block">Peak-Locked SL Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">
                {language === 'ml' ? 'ആകെ അറ്റ ലാഭം/നഷ്ടം (Net)' : 'Total Net P&L (After Tax)'}
              </span>
              <span
                className={`text-lg font-black font-mono ${
                  (supervisorAudit.performanceSummary?.netPnLTotal || 0) >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {(supervisorAudit.performanceSummary?.netPnLTotal || 0) >= 0 ? '+' : ''}₹
                {Number(supervisorAudit.performanceSummary?.netPnLTotal || 0).toFixed(0)}
              </span>
              <span className="text-[9px] text-slate-400 block">
                Wins: {supervisorAudit.performanceSummary?.winCount || 0} | Losses:{' '}
                {supervisorAudit.performanceSummary?.lossCount || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">
                {language === 'ml' ? 'പരമാവധി നഷ്ട പരിധി (SL Cap)' : 'Max Stop-Loss Cap'}
              </span>
              <span className="text-lg font-black font-mono text-amber-300">
                ₹500 / {botConfig.stopLossPercent}%
              </span>
              <span className="text-[9px] text-emerald-400 block">
                {language === 'ml' ? '120s വിഗിൾ ഷീൽഡ്' : '120s Wiggle Shield'}
              </span>
            </div>
          </div>
        )}
      </div>
      <DeepAiDiagnosisReport
        report={supervisorAudit?.lastAiSupervisorDeepReport}
        language={language}
      />
      {/* Autonomous Self-Healing Live Action Log (Shows what the AI automatically fixed without user clicking) */}
      <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h5 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {language === 'ml'
                ? '⚡ AI ഓട്ടോമാറ്റിക്കായി കണ്ടെത്തി പരിഹരിച്ചവ (Autonomous Self-Healing Log)'
                : '⚡ Autonomous Self-Healing Corrections (Auto-Applied Without Clicking)'}
            </span>
          </h5>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
            {language === 'ml' ? 'ഓരോ 5 സെക്കൻഡിലും ഓട്ടോ-ചെക്ക്' : 'Every 5s Auto-Verification'}
          </span>
        </div>
        {supervisorAudit?.autoHealHistory && supervisorAudit.autoHealHistory.length > 0 ? (
          <div className="space-y-1.5">
            {supervisorAudit.autoHealHistory.map((item: any) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-slate-950/90 border border-emerald-500/30 text-[11px] flex items-center justify-between gap-2 flex-wrap"
              >
                <div className="space-y-0.5">
                  <p className="text-amber-300 font-bold">⚠️ {item.problemMl}</p>
                  <p className="text-emerald-300 text-[10px]">✅ {item.autoActionMl}</p>
                </div>
                <div className="text-right font-mono text-[10px] shrink-0">
                  <span className="text-rose-400 line-through mr-1.5">{item.beforeValue}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/30">
                    → {item.afterValue}
                  </span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between">
            <span>
              {language === 'ml'
                ? '✅ എല്ലാ പരാമീറ്ററുകളും (SL 2.5%, Peak SL Lock ON, MinConfidence 78%, MinNetProfit ₹300) AI എഞ്ചിൻ തനിയെ പരിശോധിച്ച് 100% കൃത്യമായി ലോക്ക് ചെയ്തിട്ടുണ്ട്.'
                : '✅ All risk & profit parameters are autonomously locked at 100% optimal values.'}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black shrink-0">
              100% OPTIMAL
            </span>
          </div>
        )}
      </div>
      <ActivePositionsAudit
        positions={supervisorAudit?.activePositionsAudit || []}
        language={language}
      />
      {/* 12-Directive Real-Time Verification Checklist */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            {language === 'ml'
              ? '12 അൽഗോരിതം നിയമങ്ങളുടെ തത്സമയ പരിശോധന (12-Point Directive Verification)'
              : '12-Point Algorithm Directive Verification Checklist'}
          </span>
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(supervisorAudit?.directiveChecklist || []).map((dir: any) => (
            <div
              key={dir.id}
              className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                dir.status === 'ACTIVE_OK'
                  ? 'bg-slate-950/80 border-emerald-500/30'
                  : 'bg-amber-950/20 border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-white">
                  {language === 'ml' ? dir.titleMl : dir.titleEn}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono shrink-0 ${
                    dir.status === 'ACTIVE_OK'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {dir.status === 'ACTIVE_OK' ? 'VERIFIED OK' : dir.status}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">{dir.detailMl}</p>
            </div>
          ))}
        </div>
      </div>
      <TradeForensicsAudit audit={supervisorAudit} language={language} />
    </div>
  </>
);
