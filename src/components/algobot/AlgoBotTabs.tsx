import React from 'react';
import { Sliders, Zap, Terminal, Sparkles, BellRing, BarChart3, Brain } from 'lucide-react';
import type { BotConfig, TradingSignal, Language } from '../../types';
import type { SupervisorAudit, TabKey, Translations } from './types';
interface AlgoBotTabsProps {
  t: Translations;
  activeTab: TabKey;
  setActiveTab: (v: TabKey) => void;
  supervisorAudit: SupervisorAudit | null;
  botConfig: BotConfig;
  signals: TradingSignal[];
  language: Language;
}
export const AlgoBotTabs: React.FC<AlgoBotTabsProps> = ({
  t,
  activeTab,
  setActiveTab,
  supervisorAudit,
  botConfig,
  signals,
  language,
}) => (
  <>
    {/* Tabs */}
    <div className="flex border-b border-slate-800 bg-black/30 px-1 pt-2.5 gap-2 text-xs font-black overflow-x-auto scrollbar-none">
      <button
        onClick={() => setActiveTab('SIGNALS')}
        className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
          activeTab === 'SIGNALS'
            ? 'border-emerald-400 text-emerald-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
        <span>
          {t.liveSignals} ({signals.length})
        </span>
      </button>
      <button
        onClick={() => setActiveTab('AI_SUPERVISOR')}
        className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
          activeTab === 'AI_SUPERVISOR'
            ? 'border-fuchsia-400 text-fuchsia-300'
            : 'border-transparent text-fuchsia-300/80 hover:text-fuchsia-200'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 animate-pulse" />
        <span>{language === 'ml' ? 'AI സൂപ്പർവൈസർ എഞ്ചിൻ' : 'AI Supervisor Engine'}</span>
        {supervisorAudit && (
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            {supervisorAudit.complianceScore}%
          </span>
        )}
      </button>
      <button
        onClick={() => setActiveTab('INSTITUTIONAL')}
        className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
          activeTab === 'INSTITUTIONAL'
            ? 'border-emerald-400 text-emerald-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        <Brain className="w-3.5 h-3.5 text-cyan-400" />
        <span>{language === 'ml' ? 'ഇൻസ്റ്റിറ്റ്യൂഷണൽ & OI' : 'Institutional & OI'}</span>
      </button>
      <button
        onClick={() => setActiveTab('SETTINGS')}
        className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
          activeTab === 'SETTINGS'
            ? 'border-emerald-400 text-emerald-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        <Sliders className="w-3.5 h-3.5" />
        <span>{language === 'ml' ? 'തന്ത്രങ്ങളും റിസ്കും' : 'Strategy & Risk'}</span>
      </button>
      <button
        onClick={() => setActiveTab('BACKTEST')}
        className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
          activeTab === 'BACKTEST'
            ? 'border-emerald-400 text-emerald-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
        <span>{language === 'ml' ? 'പെർഫോമൻസ് ഓഡിറ്റ്' : 'Performance Audit'}</span>
      </button>
      <button
        onClick={() => setActiveTab('TELEGRAM')}
        className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
          activeTab === 'TELEGRAM'
            ? 'border-emerald-400 text-emerald-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        <BellRing className="w-3.5 h-3.5 text-sky-400" />
        <span>{language === 'ml' ? 'ടെലിഗ്രാം അലേർട്ടുകൾ' : 'Telegram Alerts'}</span>
        {botConfig.telegramAlertsEnabled && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        )}
      </button>
      <button
        onClick={() => setActiveTab('LOGS')}
        className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
          activeTab === 'LOGS'
            ? 'border-emerald-400 text-emerald-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        <Terminal className="w-3.5 h-3.5" />
        <span>{language === 'ml' ? 'ലോഗ്' : 'Bot Logs'}</span>
      </button>
    </div>
  </>
);
