import React from 'react';
import { Coins } from 'lucide-react';
import type { Language } from '../../types';
import type { PerformanceMetrics } from './metrics';

interface LowCapitalRoiCardProps {
  language: Language;
  allTimeMetrics: PerformanceMetrics;
}

export const LowCapitalRoiCard: React.FC<LowCapitalRoiCardProps> = ({
  language,
  allTimeMetrics,
}) => (
  <>
    {/* Low Capital & High ROI Strategy Analytics Card */}
    <div className="p-4 rounded-xl border border-cyan-900/40 bg-gradient-to-r from-cyan-950/20 via-slate-900 to-indigo-950/20 flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-black text-white text-xs sm:text-sm">
            {language === 'ml'
              ? 'കുറഞ്ഞ മുതൽമുടക്കിൽ പരമാവധി ലാഭം ഉറപ്പാക്കുന്ന അൽഗോരിതം മുൻഗണന'
              : 'Low Capital Investment & High ROI Mandate Execution'}
          </h4>
          <p className="text-[11px] text-slate-400">
            {language === 'ml'
              ? '₹2,500 - ₹8,500 കുറഞ്ഞ മുതൽമുടക്കുള്ള സ്ട്രൈക്കുകൾക്ക് അൽഗോരിതം മുൻഗണന നൽകുന്നു; 20% - 40% വരെ ഉയർന്ന റിട്ടേൺ (ROI) നൽകുന്ന ട്രേഡുകൾ മാത്രം തിരഞ്ഞെടുക്കുന്നു.'
              : 'Strikes requiring ₹2,500 - ₹8,500 are prioritized, maximizing % ROI while keeping max stop-loss risk strictly capped under ₹400.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800 text-center">
          <span className="text-[9px] text-slate-400 uppercase font-bold block">
            {language === 'ml' ? 'ശരാശരി റിട്ടേൺ (ROI)' : 'Avg Return (ROI)'}
          </span>
          <span className="text-xs font-mono font-black text-emerald-400">
            {allTimeMetrics.roiPercent > 0
              ? `+${allTimeMetrics.roiPercent.toFixed(1)}%`
              : `${allTimeMetrics.roiPercent.toFixed(1)}%`}
          </span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800 text-center">
          <span className="text-[9px] text-slate-400 uppercase font-bold block">
            {language === 'ml' ? 'റിസ്ക്-റിവാർഡ്' : 'Risk : Reward'}
          </span>
          <span className="text-xs font-mono font-black text-cyan-300">
            {allTimeMetrics.avgLoss > 0
              ? `1 : ${(allTimeMetrics.avgWin / allTimeMetrics.avgLoss).toFixed(1)}`
              : '1 : 2.8+'}
          </span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800 text-center">
          <span className="text-[9px] text-slate-400 uppercase font-bold block">
            {language === 'ml' ? 'മാക്സ് റിസ്ക് ക്യാപ്പ്' : 'Max Risk Cap'}
          </span>
          <span className="text-xs font-mono font-black text-rose-400">-₹400 / 2.5%</span>
        </div>
      </div>
    </div>
  </>
);
