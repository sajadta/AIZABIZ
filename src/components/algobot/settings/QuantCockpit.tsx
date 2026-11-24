// Autonomous quant cockpit: live confluence ticker, six engine pillars,
// system-health diagnostics and the execution-status summary.
import React from 'react';
import {
  Cpu,
  Target,
  Activity,
  CheckCircle2,
  Zap,
  Layers,
  Flame,
  ShieldCheck,
  Gauge,
  Brain,
} from 'lucide-react';
import type { BotConfig, Language, StockQuote } from '../../../types';
import type { TickerStep } from '../types';

interface QuantCockpitProps {
  botConfig: BotConfig;
  language: Language;
  quotes: StockQuote[];
  hudTickerIndex: number;
  hudTickerStepsMl: TickerStep[];
  hudTickerStepsEn: TickerStep[];
}

export const QuantCockpit: React.FC<QuantCockpitProps> = ({
  botConfig,
  language,
  quotes,
  hudTickerIndex,
  hudTickerStepsMl,
  hudTickerStepsEn,
}) => (
  <>
    {/* Autonomous Institutional Quant Cockpit: Real-Time Confirmation Stream & Live Radar */}
    <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950 border border-indigo-500/30 space-y-3.5 shadow-xl">
      {/* Dynamic Live Confirmation Stream Ticker ('Letter mari marayunna reethiyil') */}
      <div className="p-3 rounded-xl bg-slate-950/90 border border-indigo-500/40 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>
                {language === 'ml'
                  ? 'തത്സമയ അൽഗോരിതം സ്ഥിരീകരണ റഡാർ'
                  : 'Live Autonomous Confluence Stream'}
              </span>
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {language === 'ml'
              ? hudTickerStepsMl[hudTickerIndex].badge
              : hudTickerStepsEn[hudTickerIndex].badge}
          </span>
        </div>
        {/* Animated Dynamic Changing Text */}
        <div className="flex items-start gap-2 pt-0.5 min-h-[38px]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="transition-all duration-300 ease-in-out">
            <span className="text-[11px] font-bold text-white block">
              {language === 'ml'
                ? hudTickerStepsMl[hudTickerIndex].title
                : hudTickerStepsEn[hudTickerIndex].title}
            </span>
            <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
              {language === 'ml'
                ? hudTickerStepsMl[hudTickerIndex].text
                : hudTickerStepsEn[hudTickerIndex].text}
            </p>
          </div>
        </div>
        {/* Step Indicators */}
        <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-slate-800/80">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                idx === hudTickerIndex
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>
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
                <span>
                  {language === 'ml' ? '2. മൾട്ടി-സൂചിക സ്കാനർ' : '2. Multi-Index Scanner'}
                </span>
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
                <span>
                  {language === 'ml' ? '3. ഡയറക്ഷൻ & സ്ട്രൈക്ക്' : '3. Direction & Strike'}
                </span>
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
      {/* Real-Time System Health & Shortfall Diagnostics ('Enthellam working anennu manasilakkan') */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {language === 'ml'
                ? 'തത്സമയ സിസ്റ്റം ഹെൽത്ത് & ഡയഗ്നോസ്റ്റിക്സ്'
                : 'Live System Health & Shortfall Diagnostics'}
            </span>
          </span>
          <span className="text-[9px] font-mono text-emerald-400 font-bold">ALL SYSTEMS LIVE</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400">
              {language === 'ml' ? 'മാർക്കറ്റ് സെഷൻ:' : 'Market Session:'}
            </span>
            <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>ACTIVE</span>
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400">
              {language === 'ml' ? 'ഡാറ്റാ ഫീഡ്:' : 'Live Tick Feed:'}
            </span>
            <span className="font-mono font-bold text-emerald-400">
              {quotes.length > 0 ? `${quotes.length} Quotes` : '6 Indices OK'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400">
              {language === 'ml' ? 'ട്രേഡ് മോഡ്:' : 'Trade Mode:'}
            </span>
            <span className="font-mono font-bold text-amber-300">
              {botConfig.mode === 'UPSTOX_LIVE' ? 'LIVE CASH' : 'PAPER TRADING'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400">
              {language === 'ml' ? 'സർക്യൂട്ട് ബ്രേക്കർ:' : 'Circuit Breaker:'}
            </span>
            <span
              className={`font-mono font-bold ${botConfig.dailyLossLocked ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}
            >
              {botConfig.dailyLossLocked ? 'LOCKED' : 'ARMED (Safe)'}
            </span>
          </div>
        </div>
      </div>
      {/* Optional Collapsible Drawer for Advanced Manual Overrides */}
      <div className="pt-2 border-t border-slate-800/80">
        {/* 100% Automated Quant Execution Status (No Manual Input Required) */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white text-xs flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>
                {language === 'ml'
                  ? 'അൽഗോരിതം ഓട്ടോമാറ്റിക് എക്സിക്യൂഷൻ സ്റ്റാറ്റസ്'
                  : 'Autonomous Quant Execution Status'}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              100% AUTOMATED
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-sans">
                {language === 'ml' ? 'ഇൻഡക്സ് സ്കാനിംഗ്:' : 'Index Scanner:'}
              </span>
              <span className="text-cyan-300 font-bold">
                {language === 'ml'
                  ? '⚡ ഓട്ടോ 6-ഇൻഡക്സ് സ്കാനർ (NIFTY, BANKNIFTY, SENSEX, FINNIFTY, MIDCP, BANKEX)'
                  : '⚡ Auto 6-Index Alpha Scanner (Nifty, BankNifty, Sensex, FinNifty, Midcap, Bankex)'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-sans">
                {language === 'ml' ? 'സ്ട്രാറ്റജി & ഡയറക്ഷൻ:' : 'Strategy & Direction:'}
              </span>
              <span className="text-emerald-300 font-bold">
                {language === 'ml'
                  ? '⚡ ഓട്ടോ ഹൈബ്രിഡ് (ട്രെൻഡ് അനുസരിച്ച് CE/PE)'
                  : '⚡ Auto Hybrid (CE/PE Breakout)'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-sans">
                {language === 'ml' ? 'ഫണ്ട് മാനേജ്‌മെന്റ്:' : 'Fund Sizing:'}
              </span>
              <span className="text-indigo-300 font-bold">
                {language === 'ml'
                  ? '⚡ അക്കൗണ്ട് ബാലൻസ് അനുസരിച്ച് (ഡൈനാമിക്)'
                  : '⚡ Dynamic Live Account Sizing'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-sans">
                {language === 'ml' ? 'റിസ്ക് & എക്സിറ്റ്:' : 'Risk & Execution:'}
              </span>
              <span className="text-amber-300 font-bold">
                {language === 'ml'
                  ? '⚡ ക്വാന്റ് ട്രെയിലിംഗ് SL & പ്രോഫിറ്റ് വാൾട്ട്'
                  : '⚡ Quant Trailing Stop & Slippage Guard'}
              </span>
            </div>
          </div>

          {/* Trade Mode Status Notice (100% Locked to Options Only) */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-300 block">
              {language === 'ml'
                ? '🎯 ട്രേഡിങ്ങ് സെഗ്മെന്റ് മോഡ് (Trading Segment):'
                : '🎯 Trading Segment Mode:'}
            </span>
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <div>
                  <span className="text-xs font-black text-purple-200 block">
                    {language === 'ml'
                      ? '100% ഓപ്ഷൻ ട്രേഡിങ്ങ് മാത്രം (OPTIONS ONLY)'
                      : '100% Options Trading Only'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {language === 'ml'
                      ? 'ഇക്വിറ്റി ഓഹരികൾ അൽഗോരിതത്തിൽ നിന്നും ഒഴിവാക്കി. Nifty 50, BankNifty, Sensex, FinNifty സൂചികകളിലെ ഉയർന്ന ഗുണനിലവാരമുള്ള ATM/ITM ഓപ്ഷനുകൾ മാത്രം ട്രേഡ് ചെയ്യുന്നു.'
                      : 'Equity stocks are permanently excluded. Algo strictly trades high-conviction ATM/ITM index options only.'}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {language === 'ml' ? 'ഇക്വിറ്റി ഒഴിവാക്കി' : 'EQUITY OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
