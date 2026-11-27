import React from 'react';
import { Clock } from 'lucide-react';
import type { UpstoxApiConfig, Language } from '../../types';

interface LiveAccountSummaryProps {
  config: UpstoxApiConfig;
  language: Language;
  liveHoldingsCount: number | null;
}

export const LiveAccountSummary: React.FC<LiveAccountSummaryProps> = ({
  config,
  language,
  liveHoldingsCount,
}) =>
  config.isConnected ? (
    <div className="space-y-2 pt-2 border-t border-emerald-500/20 text-[11px] font-mono">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {language === 'ml' ? 'ലഭ്യമായ ഫണ്ട്' : 'Available Margin'}
          </span>
          <span className="text-emerald-400 font-bold">
            ₹
            {Number(config.availableMargin || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {Number(config.usedMargin || 0) < 0
              ? language === 'ml'
                ? 'ഹോൾഡിങ് വിറ്റ ക്രെഡിറ്റ്'
                : 'Holding Sell Credit'
              : language === 'ml'
                ? 'ഉപയോഗിച്ച മാർജിൻ'
                : 'Used Margin'}
          </span>
          <span
            className={`${Number(config.usedMargin || 0) < 0 ? 'text-cyan-300' : 'text-amber-400'} font-bold`}
          >
            ₹
            {Math.abs(Number(config.usedMargin || 0)).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {language === 'ml' ? 'ഹോൾഡിങ്‌സ്' : 'Holdings'}
          </span>
          <span className="text-cyan-400 font-bold">
            {liveHoldingsCount !== null ? `${liveHoldingsCount} Stocks` : 'Synced'}
          </span>
        </div>
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {language === 'ml' ? 'ടോക്കൺ സമയം' : 'Token Time'}
          </span>
          <span className="text-amber-300 font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{config.tokenGeneratedAt || 'ഇന്ന് തത്സമയം'}</span>
          </span>
        </div>
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {language === 'ml' ? 'ആകെ അക്കൗണ്ട് ബാലൻസ്' : 'Total Account Value'}
          </span>
          <span className="text-cyan-400 font-bold">
            ₹
            {Number(config.totalBalance || config.availableMargin || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {language === 'ml' ? 'ഇന്ന് ചേർത്ത തുക' : 'Payin (Today)'}
          </span>
          <span className="text-emerald-400 font-bold">
            ₹
            {Number(config.payin || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {language === 'ml' ? 'പിൻവലിച്ചത്' : 'Payout (Today)'}
          </span>
          <span className="text-rose-400 font-bold">
            ₹
            {Number(config.payout || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[9px] text-slate-400 block font-sans">
            {language === 'ml' ? 'മാർക്കറ്റ് സമയം' : 'Market Hours'}
          </span>
          <span className="text-emerald-300 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>09:15 - 15:30</span>
          </span>
        </div>
      </div>
    </div>
  ) : null;
