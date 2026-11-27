import React from 'react';
import { ShieldCheck, TrendingUp, Lock } from 'lucide-react';
import type { Language } from '../../../types';

interface CorporateQuantShieldProps {
  language: Language;
}

export const CorporateQuantShield: React.FC<CorporateQuantShieldProps> = ({ language }) => (
  <div className="p-4 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800/40 shadow-sm text-xs relative overflow-hidden group transition-all duration-500 hover:border-cyan-500/20">
    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800/20">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-cyan-500/5 text-cyan-400">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <span className="font-bold text-slate-200 tracking-tight text-[11px] uppercase">
          {language === 'ml' ? '🏛️ കോർപ്പറേറ്റ് ക്വാണ്ട് ഷീൽഡ്' : '🏛️ Corporate Quant Shield'}
        </span>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        {language === 'ml' ? 'സജീവം' : 'Active'}
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-[10px]">
      <div className="flex items-start gap-2.5">
        <TrendingUp className="w-3.5 h-3.5 text-indigo-400/70 mt-0.5 shrink-0" />
        <div>
          <span className="text-slate-500 block font-bold uppercase tracking-wider mb-0.5">
            {language === 'ml' ? 'ട്രെൻഡ് വേറ്റോ:' : 'Trend Veto:'}
          </span>
          <span className="text-slate-400 leading-relaxed">
            {language === 'ml'
              ? 'വിപരീത ദിശയിലുള്ള ട്രേഡുകൾ തടയുന്നു'
              : 'Blocking counter-trend entries'}
          </span>
        </div>
      </div>
      <div className="flex items-start gap-2.5">
        <Lock className="w-3.5 h-3.5 text-amber-400/70 mt-0.5 shrink-0" />
        <div>
          <span className="text-slate-500 block font-bold uppercase tracking-wider mb-0.5">
            {language === 'ml' ? 'ബ്രോക്കറേജ് ഷീൽഡ്:' : 'Brokerage Shield:'}
          </span>
          <span className="text-slate-400 leading-relaxed">
            {language === 'ml'
              ? 'ചെറിയ ലാഭങ്ങളിൽ വിൽക്കാതെ സംരക്ഷിക്കുന്നു'
              : 'Protecting from low-profit exits'}
          </span>
        </div>
      </div>
    </div>
  </div>
);
