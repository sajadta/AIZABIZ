import React from 'react';
import type { Language, TradingSignal } from '../../../types';

interface InstitutionalQuantMatrixProps {
  analysis: NonNullable<TradingSignal['institutionalQuantAnalysis']>;
  language: Language;
}

/** Seven-layer institutional quant matrix: chart structure, S/R runway, heavyweights, macro, OI. */
export const InstitutionalQuantMatrix: React.FC<InstitutionalQuantMatrixProps> = ({
  analysis: q,
  language,
}) => (
  <div className="mt-2.5 p-3 rounded-2xl bg-slate-950/60 backdrop-blur-sm border border-indigo-500/25 space-y-2 text-[11px]">
    <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-indigo-500/20">
      <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
        {language === 'ml'
          ? '🏛️ 7-തല ഇൻസ്റ്റിറ്റ്യൂഷണൽ & ചാർട്ട് ഹിസ്റ്ററി അനാലിസിസ്'
          : '🏛️ 7-Layer Institutional & Chart History Quant Matrix'}
      </span>
      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold">
        {language === 'ml' ? 'പ്രതീക്ഷിക്കുന്ന സമയം:' : 'Est. Target Time:'}{' '}
        {q.estimatedMinutesToTarget} | {q.estimatedNetProfitRange}
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] font-mono pt-0.5">
      <div className="bg-slate-900/40 px-2.5 py-1.5 rounded-xl border border-slate-800/50 flex items-center justify-between">
        <span className="text-slate-400">
          {language === 'ml' ? 'ചാർട്ട് സ്ട്രക്ചർ:' : 'Chart Structure:'}
        </span>
        <span className="text-cyan-300 font-bold truncate max-w-[190px]">
          {language === 'ml' ? q.chartStructurePatternMl : q.chartStructurePattern}
        </span>
      </div>
      <div className="bg-slate-900/40 px-2.5 py-1.5 rounded-xl border border-slate-800/50 flex items-center justify-between">
        <span className="text-slate-400">
          {language === 'ml' ? 'സപ്പോർട്ട് / റെസിസ്റ്റൻസ് റൺവേ:' : 'S/R Clear Runway:'}
        </span>
        <span className="text-emerald-300 font-bold">
          S: ₹{q.nearestSupport} | R: ₹{q.nearestResistance} (+
          {q.clearRunwayPoints} pts)
        </span>
      </div>
      <div className="bg-slate-900/40 px-2.5 py-1.5 rounded-xl border border-slate-800/50 flex items-center justify-between">
        <span className="text-slate-400">
          {language === 'ml' ? 'കോർപ്പറേറ്റ് ഹെവിവെയ്റ്റ്സ്:' : 'Corporate Heavyweights:'}
        </span>
        <span
          className={`font-bold truncate max-w-[190px] ${
            q.corporateHeavyweightScore >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {q.corporateHeavyweightSummary}
        </span>
      </div>
      <div className="bg-slate-900/40 px-2.5 py-1.5 rounded-xl border border-slate-800/50 flex items-center justify-between">
        <span className="text-slate-400">
          {language === 'ml' ? 'ആഗോള മാക്രോ & OI ഫ്ലോ:' : 'Global Macro & OI Flow:'}
        </span>
        <span className="text-amber-300 font-bold truncate max-w-[190px]">
          {q.globalMacroAlignment} | {q.oiBuildupType}
        </span>
      </div>
      {q.fiveYearRegimeSummary && (
        <div className="sm:col-span-2 bg-indigo-950/25 px-2.5 py-1.5 rounded-xl border border-indigo-500/25 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-indigo-300 font-bold">
            {language === 'ml'
              ? '📅 5-വർഷ ചാർട്ട് & 200D EMA ഹിസ്റ്ററി:'
              : '📅 5-Year Daily Chart & 200D EMA Regime:'}
          </span>
          <span className="text-emerald-300 font-bold">
            {language === 'ml'
              ? q.fiveYearRegimeSummaryMl || q.fiveYearRegimeSummary
              : q.fiveYearRegimeSummary}
          </span>
        </div>
      )}
      {q.multiLegDetails && (
        <div className="sm:col-span-2 bg-cyan-950/25 px-2.5 py-1.5 rounded-xl border border-cyan-500/25 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-cyan-300 font-bold">
            {language === 'ml'
              ? `⚖️ ${q.multiLegDetails.strategyType === 'SHORT_STRANGLE' ? 'Short Strangle (സൈഡ്‌വേയ്‌സ് മൾട്ടി-ലെഗ്)' : 'Short Straddle / Option Selling'}:`
              : `⚖️ ${q.multiLegDetails.strategyType}:`}
          </span>
          <span className="text-amber-300 font-bold">
            SELL {q.multiLegDetails.callStrike} CE @ ₹{q.multiLegDetails.callLtp} + SELL{' '}
            {q.multiLegDetails.putStrike} PE @ ₹{q.multiLegDetails.putLtp} | Theta: +₹
            {q.multiLegDetails.thetaDecayPerDayRupees}/day
          </span>
        </div>
      )}
    </div>
  </div>
);
