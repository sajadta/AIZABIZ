// The six autonomous engine pillars shown inside the quant cockpit grid.
import React from 'react';
import { Brain, Zap, Flame, Target, Gauge, ShieldCheck, Layers } from 'lucide-react';
import type { Language } from '../../../types';

interface QuantPillarsProps {
  language: Language;
}

export const QuantPillars: React.FC<QuantPillarsProps> = ({ language }) => (
  <>
    {/* 6 Core Autonomous Pillars (All 100% Handled by Algo - No Manual Guesswork) */}
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
          <Brain className="w-4 h-4 text-cyan-400" />
          <span>
            {language === 'ml'
              ? '6-തല ഓട്ടോണമസ് പ്രോസസ്സിംഗ് (100% സ്വയംപ്രവർത്തിതം)'
              : '6-Pillar Autonomous Engine (100% Handled by Algo)'}
          </span>
        </h4>
        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          ZERO MANUAL EFFORT
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
        {/* Pillar 1: Auto Regime (Buying in Breakout, Selling in Range) */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white text-[11px] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'ml' ? '1. എക്സിക്യൂഷൻ റെജീം' : '1. Execution Regime'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {language === 'ml' ? 'ഓട്ടോ ഹൈബ്രിഡ്' : 'AUTO HYBRID'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 mt-1 leading-snug">
            {language === 'ml'
              ? 'ബ്രേക്ക്ഔട്ടിൽ CE/PE വാങ്ങലും (Option Buying), സൈഡ്‌വേയ്‌സ് റേഞ്ചിൽ പ്രീമിയം കൊയ്ത്തും (Theta Selling) അൽഗോരിതം സ്വയം തിരഞ്ഞെടുക്കുന്നു.'
              : 'Autonomous switching between Option Buying (breakouts) and Theta Selling (sideways market).'}
          </p>
        </div>
        {/* Pillar 2: Multi-Index Alpha Scanner */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white text-[11px] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>{language === 'ml' ? '2. മൾട്ടി-സൂചിക സ്കാനർ' : '2. Multi-Index Scanner'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {language === 'ml' ? 'എല്ലാ സൂചികകളും' : 'ALL 6 INDICES'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 mt-1 leading-snug">
            {language === 'ml'
              ? 'Nifty, BankNifty, Sensex, FinNifty, Midcap എന്നിവയെല്ലാം ഒരേസമയം സ്കാൻ ചെയ്ത് ഏറ്റവും ഉയർന്ന ലാഭം തരുന്നതിൽ മാത്രം ട്രേഡ് ചെയ്യുന്നു.'
              : 'Scans Nifty, BankNifty, Sensex, FinNifty simultaneously; executes only where alpha is highest.'}
          </p>
        </div>
        {/* Pillar 3: Direction & Strike Picker */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white text-[11px] flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'ml' ? '3. ഡയറക്ഷൻ & സ്ട്രൈക്ക്' : '3. Direction & Strike'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {language === 'ml' ? 'ഓട്ടോ CE / PE' : 'AUTO CE / PE'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 mt-1 leading-snug">
            {language === 'ml'
              ? 'SuperTrend, VWAP, ബാങ്ക് പണയൊഴുക്ക് എന്നിവ നോക്കി CE വേണമോ PE വേണമോ എന്ന് അൽഗോരിതം സ്വയം കണ്ടെത്തുന്നു.'
              : 'Auto-determines CE vs PE and picks optimum liquid ATM/ITM strike via real-time Greeks.'}
          </p>
        </div>
        {/* Pillar 4: Dynamic Fund Allocation */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white text-[11px] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              <span>{language === 'ml' ? '4. ഫണ്ട് മാനേജ്‌മെന്റ്' : '4. Fund Management'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {language === 'ml' ? 'ഡൈനാമിക് ഓട്ടോ' : 'DYNAMIC FUNDS'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 mt-1 leading-snug">
            {language === 'ml'
              ? 'അക്കൗണ്ടിലുള്ള യഥാർത്ഥ കാഷ് അനുസരിച്ച് സുരക്ഷിതമായി പരമാവധി എത്ര ട്രേഡുകൾ എടുക്കാമെന്ന് അൽഗോരിതം സ്വയം നിശ്ചയിക്കുന്നു.'
              : 'Dynamically sizes positions (1 to 5 trades) strictly based on available account cash balance.'}
          </p>
        </div>
        {/* Pillar 5: Net Profit & Brokerage Guard */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {language === 'ml' ? '5. ബ്രോക്കറേജ് & പ്രോഫിറ്റ്' : '5. Profit & Brokerage'}
              </span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {language === 'ml' ? 'നെറ്റ് പ്രോഫിറ്റ് ഗാർഡ്' : 'NET PROFIT GUARD'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 mt-1 leading-snug">
            {language === 'ml'
              ? 'എല്ലാ നികുതികളും ബ്രോക്കറേജും കഴിച്ചും കയ്യിൽ ഉറപ്പായും ലാഭം കിട്ടുന്ന ഉയർന്ന ഡെൽറ്റ സ്ട്രൈക്കുകൾ മാത്രം എടുക്കുന്നു.'
              : 'Enforces that expected return strictly exceeds all round-trip brokerage & government taxes.'}
          </p>
        </div>
        {/* Pillar 6: Zero Slippage Order Routing */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>{language === 'ml' ? '6. സീറോ സ്ലിപ്പേജ് ഓർഡർ' : '6. Zero Slippage'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {language === 'ml' ? 'സ്മാർട്ട് ലിമിറ്റ്' : 'SMART LIMIT'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 mt-1 leading-snug">
            {language === 'ml'
              ? 'മാർക്കറ്റ് ഓർഡർ വഴി വില നഷ്ടപ്പെടാതിരിക്കാൻ കൃത്യമായ ട്രിഗർ വിലയിൽ സ്മാർട്ട് ലിമിറ്റ് ഓർഡർ നൽകുന്നു.'
              : 'Smart Limit order routing guarantees execution strictly at trigger price with zero slippage.'}
          </p>
        </div>
      </div>
    </div>
  </>
);
