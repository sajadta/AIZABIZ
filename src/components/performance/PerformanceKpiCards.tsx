import React from 'react';
import { CheckCircle2, Clock, Scale, XCircle } from 'lucide-react';
import type { Language } from '../../types';
import { formatDurationString } from './metrics';
import type { PerformanceMetrics } from './metrics';

interface PerformanceKpiCardsProps {
  language: Language;
  activeMetrics: PerformanceMetrics;
}

export const PerformanceKpiCards: React.FC<PerformanceKpiCardsProps> = ({
  language,
  activeMetrics,
}) => (
  <>
    {/* 2 Efficiency KPI Cards (Win/Loss Ratio & Duration) without repeating Net P&L */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <div className="p-4 rounded-xl border border-slate-800 bg-gradient-to-br from-indigo-950/20 via-slate-900 to-slate-900 flex flex-col justify-between shadow-md">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'ml' ? 'വിൻ / ലോസ് അനുപാതം' : 'Win / Loss Ratio'}
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Scale className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              {activeMetrics.winLossRatio}
            </span>
          </div>
        </div>

        {/* Ratio bar & Counts */}
        <div className="pt-3 mt-2 border-t border-slate-800/80 space-y-1.5">
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${activeMetrics.winRatePercent}%` }}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{ width: `${100 - activeMetrics.winRatePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {activeMetrics.winningTrades} {language === 'ml' ? 'വിജയം' : 'Wins'}
            </span>
            <span className="text-rose-400 font-mono font-bold flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              {activeMetrics.losingTrades} {language === 'ml' ? 'നഷ്ടം' : 'Losses'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI 3: Average Duration */}
      <div className="p-4 rounded-xl border border-slate-800 bg-gradient-to-br from-cyan-950/20 via-slate-900 to-slate-900 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'ml' ? 'ശരാശരി ട്രേഡ് സമയം' : 'Avg Trade Duration'}
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 tracking-tight">
              {activeMetrics.validDurationCount > 0
                ? formatDurationString(activeMetrics.avgDurationMs, language)
                : 'Intraday'}
            </span>
          </div>
        </div>

        <div className="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>
            {language === 'ml' ? 'കുറഞ്ഞ സമയം' : 'Min'}:{' '}
            <strong className="text-slate-200">
              {activeMetrics.minDurationMs > 0
                ? formatDurationString(activeMetrics.minDurationMs, language)
                : '< 1m'}
            </strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            {language === 'ml' ? 'കൂടിയ സമയം' : 'Max'}:{' '}
            <strong className="text-slate-200">
              {activeMetrics.maxDurationMs > 0
                ? formatDurationString(activeMetrics.maxDurationMs, language)
                : 'EOD'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  </>
);
