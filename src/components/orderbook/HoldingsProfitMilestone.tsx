// Progress tracker towards the +50% buy-price profit milestone.
import React from 'react';
import type { Language } from '../../types';

export interface ProfitMilestoneTarget {
  targetPrice: number;
  targetTotalValue: number;
  targetProfitAmount: number;
  priceNeeded: number;
  profitRemaining: number;
  progressPct: number;
  isReached: boolean;
}

interface HoldingsProfitMilestoneProps {
  language: Language;
  target50: ProfitMilestoneTarget;
}

export const HoldingsProfitMilestone: React.FC<HoldingsProfitMilestoneProps> = ({
  language,
  target50,
}) => (
  <>
    {/* +50% Profitable Value Milestone Calculation Box */}
    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-amber-300 flex items-center gap-1">
          🎯{' '}
          {language === 'ml'
            ? 'വാങ്ങിയ വിലയുടെ +50% ലാഭ കണക്കുകൂട്ടൽ:'
            : '+50% Buy-Price Profit Milestone:'}
        </span>
        <span className="font-mono text-[10px] font-black text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/40">
          {target50.isReached ? '⚡ +50% ലക്ഷ്യം കൈവരിച്ചു!' : `${target50.progressPct}% Complete`}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono pt-1 border-t border-amber-500/20">
        <div>
          <span className="text-slate-400 block">
            {language === 'ml' ? '+50% ടാർഗറ്റ് വില:' : '+50% Target LTP:'}
          </span>
          <strong className="text-amber-300">₹{target50.targetPrice.toFixed(2)}</strong>
        </div>
        <div>
          <span className="text-slate-400 block">
            {language === 'ml' ? '+50% ആകുമ്പോൾ ലാഭം:' : 'Profit at +50%:'}
          </span>
          <strong className="text-emerald-300">+₹{target50.targetProfitAmount.toFixed(2)}</strong>
        </div>
        <div>
          <span className="text-slate-400 block">
            {language === 'ml' ? 'ഇനി വേണ്ട വില കയറ്റം:' : 'LTP Rise Needed:'}
          </span>
          <strong className="text-cyan-300">
            {target50.isReached ? '₹0.00 (Hit!)' : `+₹${target50.priceNeeded.toFixed(2)}/sh`}
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block">
            {language === 'ml' ? '+50% മൂല്യം (Total):' : 'Value at +50%:'}
          </span>
          <strong className="text-white">₹{target50.targetTotalValue.toFixed(2)}</strong>
        </div>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${target50.progressPct}%` }}
        />
      </div>
    </div>
  </>
);
