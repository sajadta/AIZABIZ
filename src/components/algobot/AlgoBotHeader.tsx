import React from 'react';
import { Cpu, Play, Square } from 'lucide-react';
import type { BotConfig, Language } from '../../types';
import type { Translations } from './types';
interface AlgoBotHeaderProps {
  t: Translations;
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  language: Language;
}
export const AlgoBotHeader: React.FC<AlgoBotHeaderProps> = ({
  t,
  botConfig,
  onUpdateBotConfig,
  language,
}) => (
  <>
    {/* Bot Master Header */}
    <div className="pb-2 sm:pb-3 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2">
        <div
          className={`p-1.5 sm:p-2 rounded-xl border transition-all ${
            botConfig.enabled
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 live-pulse shadow-md shadow-emerald-950/50'
              : 'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}
        >
          <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight">{t.algoBot}</h3>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-bold uppercase border shadow-sm ${
                botConfig.enabled
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {botConfig.enabled
                ? language === 'ml'
                  ? 'ഓൺ (ON)'
                  : 'ON'
                : language === 'ml'
                  ? 'ഓഫ് (OFF)'
                  : 'OFF'}
            </span>
            {botConfig.dailyLossLocked && (
              <span className="px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-black bg-rose-500 text-white animate-pulse">
                {language === 'ml' ? 'സർക്യൂട്ട് ലോക്ക്' : 'LOCKED'}
              </span>
            )}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
            {botConfig.mode === 'UPSTOX_LIVE' ? 'Live Upstox API' : 'Paper Trading Simulator'}
          </p>
        </div>
      </div>
      {/* Cloud Always-On Engine Indicator, Desktop Mode Switcher & Emergency Pause */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:flex bg-slate-950 rounded-xl p-0.5 border border-slate-800 text-[10px] font-black">
          <button
            type="button"
            onClick={() => onUpdateBotConfig({ mode: 'PAPER_TRADING' })}
            className={`px-2.5 py-1 rounded-lg transition ${
              botConfig.mode === 'PAPER_TRADING'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'ml' ? 'പേപ്പർ' : 'PAPER'}
          </button>
          <button
            type="button"
            onClick={() => onUpdateBotConfig({ mode: 'UPSTOX_LIVE' })}
            className={`px-2.5 py-1 rounded-lg transition ${
              botConfig.mode === 'UPSTOX_LIVE'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'ml' ? 'ലൈവ്' : 'LIVE'}
          </button>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>24x7 Cloud Active</span>
        </div>
        <button
          id="btn-bot-toggle"
          onClick={() => onUpdateBotConfig({ enabled: !botConfig.enabled, dailyLossLocked: false })}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 shadow transition active:scale-95 border ${
            botConfig.enabled
              ? 'bg-slate-800/90 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border-slate-700'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30'
          }`}
        >
          {botConfig.enabled ? (
            <>
              <Square className="w-3 h-3 text-rose-400" />
              <span>{language === 'ml' ? 'നിർത്തുക' : 'Pause'}</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-white" />
              <span>{language === 'ml' ? 'തുടങ്ങുക' : 'Resume'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  </>
);
