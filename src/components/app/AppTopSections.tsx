import React from 'react';
import type { Language, UpstoxApiConfig } from '../../types';
import type { LightingAlertBannerState, MarketSessionStatus } from '../../utils/soundAlerts';
import { triggerAlertEvent } from '../../utils/soundAlerts';

interface AppTopSectionsProps {
  apiConfig: UpstoxApiConfig;
  language: Language;
  lightingBanner: LightingAlertBannerState | null;
  setLightingBanner: (v: LightingAlertBannerState | null) => void;
  triggerAlertEvent: typeof triggerAlertEvent;
  marketSession: MarketSessionStatus;
}

export const AppTopSections: React.FC<AppTopSectionsProps> = ({
  apiConfig,
  language,
  lightingBanner,
  setLightingBanner,
  triggerAlertEvent,
  marketSession,
}) => (
  <>
    {/* 1.1 UNIFIED LIVE TERMINAL RIBBON (Market Timing, Feed Status & Alert Controls - Desktop Only) */}
    <div className="hidden sm:flex w-full px-2 sm:px-4 py-1 text-[11px] font-mono items-center justify-between gap-2 border-b shrink-0 bg-[#070b14]/95 border-slate-800/80 text-slate-300 overflow-x-auto no-scrollbar shadow-inner">
      {/* Left: Feed Status & IST Clock */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px]">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-slate-200 font-sans">
            {apiConfig.isConnected
              ? language === 'ml'
                ? 'UPSTOX ലൈവ്'
                : 'UPSTOX LIVE'
              : language === 'ml'
                ? 'NSE/BSE ലൈവ്'
                : 'NSE/BSE LIVE'}
          </span>
        </div>

        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
          <span className="text-slate-500 font-sans">IST:</span>
          <strong className="text-cyan-300 font-bold">{marketSession.istTimeFormatted}</strong>
        </span>
      </div>

      {/* Center: Market Phase & Countdown Pill with Neon Border */}
      <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold">
        <span
          className={`px-2 py-0.5 rounded-lg border font-mono transition-all ${
            marketSession.isMarketOpen
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
          }`}
        >
          {language === 'ml' ? marketSession.labelMl : marketSession.labelEn}
        </span>
        <span className="hidden sm:inline-flex px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-mono">
          ⏳ {marketSession.countdownLabelMl}
        </span>
      </div>

      {/* Right: Lighting & Sound Test Alert Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            const banner = triggerAlertEvent(
              'FIFTY_PERCENT_JACKPOT',
              'SOUND & LIGHTING TEST',
              '⚡ ലൈറ്റിംഗ് & സൗണ്ട് അലേർട്ട് ടെസ്റ്റ് വിജയകരം!',
              'ട്രേഡ് എൻട്രി, നഷ്ടം, ലാഭം, ഹോൾഡിങ്ങ് ലാഭം, +50% ജാക്ക്പോട്ട് അലേർട്ടുകൾ സജ്ജമാണ്!',
              false,
            );
            if (banner) setLightingBanner(banner);
          }}
          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition flex items-center gap-1 shadow-sm active:scale-95"
          title="Test Sound & Lighting Alert"
        >
          <span>🔔</span>
          <span className="hidden xs:inline">
            {language === 'ml' ? 'അലേർട്ട് ടെസ്റ്റ്' : 'Test Alert'}
          </span>
        </button>
      </div>
    </div>

    {/* Multi-Tier Visual Lighting Alert Banner (Trade Entry / Loss / Profit / +50% Jackpot / Holdings) */}
    {lightingBanner && lightingBanner.active && (
      <div
        className={`w-full px-4 py-2 border-b flex items-center justify-between gap-3 shrink-0 transition-all duration-300 ${
          lightingBanner.colorTheme === 'GOLD_JACKPOT'
            ? 'bg-gradient-to-r from-amber-600/35 via-yellow-500/25 to-emerald-600/35 border-amber-400 text-amber-100 shadow-[0_0_30px_rgba(251,191,36,0.45)] animate-pulse'
            : lightingBanner.colorTheme === 'EMERALD_HIGH'
              ? 'bg-gradient-to-r from-emerald-600/35 via-teal-500/25 to-cyan-600/35 border-emerald-400 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
              : lightingBanner.colorTheme === 'ROSE_LOSS'
                ? 'bg-gradient-to-r from-rose-600/35 via-red-600/25 to-orange-600/35 border-rose-400 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                : 'bg-gradient-to-r from-cyan-600/30 via-indigo-600/25 to-emerald-600/30 border-cyan-400 text-cyan-100'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-3 h-3 rounded-full bg-white animate-ping shrink-0" />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-black tracking-wide truncate">
              {lightingBanner.titleMl}
            </div>
            <div className="text-[11px] font-medium opacity-95 truncate">
              {lightingBanner.subtitleMl}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLightingBanner(null)}
          className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white text-[10px] font-bold border border-white/20 shrink-0"
        >
          ✕ Dismiss
        </button>
      </div>
    )}
  </>
);
