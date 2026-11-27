// Read-only summary of the autonomous multi-index and concurrency engine.
import React from 'react';
import { Zap } from 'lucide-react';
import type { Language } from '../../../types';

interface AutoEnginePanelProps {
  language: Language;
}

export const AutoEnginePanel: React.FC<AutoEnginePanelProps> = ({ language }) => (
  <>
    {/* 100% Automated Multi-Index & Dynamic Fund Engine (No Manual Selectors) */}
    <div className="pt-3 border-t border-slate-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black text-white">
            {language === 'ml'
              ? 'സൂചികകളും കൺകറൻസിയും (100% ഓട്ടോമാറ്റിക്)'
              : 'Autonomous Multi-Index & Concurrency'}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          FULL AUTO ENGINE
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-slate-400 text-[10px] block font-sans">
            {language === 'ml' ? '📊 ഇൻഡക്സ് സ്കാനിംഗ്' : 'Index Scanner'}
          </span>
          <span className="text-emerald-300 font-extrabold text-[11px] block mt-0.5">
            {language === 'ml'
              ? 'എല്ലാ 6 സൂചികകളും സ്വയം സ്കാൻ ചെയ്യുന്നു (Nifty, BankNifty, Sensex, FinNifty, Midcap, Bankex)'
              : 'Full Auto (Nifty, BankNifty, Sensex, FinNifty, Midcap, Bankex)'}
          </span>
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            {language === 'ml'
              ? 'ഏറ്റവും മികച്ച റിസ്ക്-റിവാർഡ് ലഭിക്കുന്ന ഇൻഡക്സ് അൽഗോരിതം സ്വയം കണ്ടെത്തുന്നു.'
              : 'Autonomous tick scanning picks whichever index has the highest breakout alpha.'}
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-slate-400 text-[10px] block font-sans">
            {language === 'ml' ? '⚡ ഒരേസമയം പരമാവധി ട്രേഡുകൾ' : 'Max Concurrent Trades'}
          </span>
          <span className="text-cyan-300 font-extrabold text-[11px] block mt-0.5">
            {language === 'ml'
              ? 'ഡൈനാമിക് ഫണ്ട് അലോക്കേഷൻ (Auto 1–5 Trades)'
              : 'Dynamic Fund Allocation (1–5)'}
          </span>
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            {language === 'ml'
              ? 'അക്കൗണ്ടിലെ ബാലൻസ് തുകയ്ക്ക് അനുസരിച്ച് സുരക്ഷിതമായി അൽഗോരിതം ട്രേഡുകൾ എടുക്കുന്നു.'
              : 'Automatically scales concurrent positions with available account cash balance.'}
          </p>
        </div>
      </div>
    </div>
  </>
);
