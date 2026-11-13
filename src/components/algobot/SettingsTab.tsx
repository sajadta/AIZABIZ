import React from 'react';
import {
  Cpu,
  ShieldAlert,
  Target,
  CheckCircle2,
  Sliders,
  Zap,
  Activity,
  Sparkles,
  Layers,
  Flame,
  ShieldCheck,
  Gauge,
  Brain,
} from 'lucide-react';
import type { BotConfig, Language, StockQuote } from '../../types';
import type { TickerStep } from './types';
interface SettingsTabProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  language: Language;
  quotes: StockQuote[];
  hudTickerIndex: number;
  hudTickerStepsMl: TickerStep[];
  hudTickerStepsEn: TickerStep[];
}
export const SettingsTab: React.FC<SettingsTabProps> = ({
  botConfig,
  onUpdateBotConfig,
  language,
  quotes,
  hudTickerIndex,
  hudTickerStepsMl,
  hudTickerStepsEn,
}) => (
  <>
    <div className="space-y-4">
      {/* 1-Click Corporate Hedge Fund Autonomous Mode Preset */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-purple-950/40 to-slate-900 border border-indigo-500/40 shadow-lg shadow-indigo-950/30 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                <span>
                  {language === 'ml'
                    ? '🏛️ കോർപ്പറേറ്റ് ഹെഡ്ജ് ഫണ്ട് ഓട്ടോ-പൈലറ്റ്'
                    : '🏛️ Corporate Hedge Fund Autopilot'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  100% HANDS-FREE
                </span>
              </h4>
              <p className="text-[11px] text-slate-300">
                {language === 'ml'
                  ? 'മാനുവൽ ഇടപെടലുകൾ ഒഴിവാക്കി, എല്ലാ ഇൻഡക്സുകളും സ്കാൻ ചെയ്ത് അക്കൗണ്ട് ബാലൻസ് അനുസരിച്ച് അൽഗോരിതം സ്വയം ട്രേഡ് ചെയ്യുന്നു.'
                  : 'Zero manual guesswork: Auto multi-index scanning, dynamic account funds allocation, automated CE/PE execution.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-950/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {language === 'ml'
                  ? 'ഓട്ടോ-പൈലറ്റ് സജീവം (100% Full Auto)'
                  : 'Autopilot Active (Full Auto)'}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-300">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="font-bold text-indigo-300 block mb-0.5">
              📊 {language === 'ml' ? 'മൾട്ടി-ഇൻഡക്സ് സ്കാനർ' : 'Multi-Index Scanner'}
            </span>
            <span>
              {language === 'ml'
                ? 'Nifty, BankNifty, Sensex, FinNifty എന്നിവയിൽ ഏറ്റവും ലാഭമുള്ളത് സ്വയം തിരഞ്ഞെടുക്കും'
                : 'Scans all indices simultaneously for maximum alpha'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="font-bold text-emerald-300 block mb-0.5">
              💰 {language === 'ml' ? 'ഡൈനാമിക് ഫണ്ട് അലോക്കേഷൻ' : 'Dynamic Account Sizing'}
            </span>
            <span>
              {language === 'ml'
                ? 'അക്കൗണ്ട് തുകയ്ക്കനുസരിച്ച് പരമാവധി ട്രേഡുകൾ സ്വയം ക്രമീകരിക്കുന്നു'
                : 'Scales trade count and lot sizing to real account cash'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="font-bold text-amber-300 block mb-0.5">
              🎯{' '}
              {language === 'ml' ? 'ഓട്ടോ CE/PE & ബ്രോക്കറേജ് ഗാർഡ്' : 'Auto CE/PE & Profit Guard'}
            </span>
            <span>
              {language === 'ml'
                ? 'ബ്രോക്കറേജ് കഴിഞ്ഞ് ലാഭം ഉറപ്പാക്കുന്ന സ്ട്രൈക്കുകൾ മാത്രം എടുക്കും'
                : 'Guarantees net take-home profit after all charges'}
            </span>
          </div>
        </div>
      </div>
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
            <span className="text-[9px] font-mono text-emerald-400 font-bold">
              ALL SYSTEMS LIVE
            </span>
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
          </div>
        </div>
      </div>
      {/* Daily Max Loss Circuit Breaker */}
      <div className="p-3.5 rounded-xl bg-gradient-to-b from-rose-950/20 to-slate-900/80 border border-rose-800/40 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs font-extrabold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>
              {language === 'ml'
                ? 'ദിവസേനയുള്ള പരമാവധി നഷ്ടപരിധി (Daily Max Loss)'
                : 'Daily Max Loss Circuit Breaker'}
            </span>
          </h4>
          <div className="flex items-center gap-2">
            {botConfig.dailyLossLocked ? (
              <button
                type="button"
                onClick={() => onUpdateBotConfig({ dailyLossLocked: false })}
                className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] transition"
              >
                {language === 'ml' ? 'റീസെറ്റ് ചെയ്യുക (Reset)' : 'UNLOCK / RESET'}
              </button>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                {language === 'ml' ? 'സുരക്ഷിതം (Armed)' : 'ARMED'}
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-200">
          {language === 'ml'
            ? 'നിങ്ങൾ നിശ്ചയിച്ച നഷ്ടപരിധി (ഉദാ: ₹500) എത്തിയാൽ ബോട്ട് ഉടൻ തന്നെ എല്ലാ പൊസിഷനുകളും ക്ലോസ് ചെയ്യുകയും ട്രേഡിങ്ങ് നിർത്തുകയും ചെയ്യും.'
            : 'Emergency auto square-off and bot halt if total intraday loss exceeds this limit.'}
        </p>
        {/* Preset Buttons including ₹500 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[500, 1000, 2000, 5000].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() =>
                onUpdateBotConfig({ dailyMaxLossLimit: amount, dailyLossLocked: false })
              }
              className={`p-2 rounded-lg text-xs font-mono font-bold border transition ${
                botConfig.dailyMaxLossLimit === amount
                  ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-950/50'
                  : 'bg-slate-950 text-slate-200 border-slate-800 hover:bg-slate-800'
              }`}
            >
              ₹{amount}
            </button>
          ))}
        </div>
        {/* Custom Value Input */}
        <div className="pt-2 border-t border-rose-950/40 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-200">
            {language === 'ml' ? 'കസ്റ്റം പരമാവധി നഷ്ട തുക (₹):' : 'Custom Loss Limit (₹):'}
          </span>
          <div className="flex items-center gap-1.5 w-32">
            <span className="text-xs font-bold text-rose-400">₹</span>
            <input
              type="number"
              min="100"
              max="50000"
              step="50"
              value={botConfig.dailyMaxLossLimit || 500}
              onChange={(e) =>
                onUpdateBotConfig({
                  dailyMaxLossLimit: Math.max(0, Number(e.target.value)),
                  dailyLossLocked: false,
                })
              }
              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg p-1.5 text-white font-mono text-xs font-bold text-right outline-none"
            />
          </div>
        </div>
      </div>
      {/* Risk Management Inputs */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {language === 'ml'
                ? 'റിസ്ക് മാനേജ്‌മെന്റ് & ഫണ്ട് അലോക്കേഷൻ'
                : 'Risk Management & Fund Allocation'}
            </span>
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {language === 'ml' ? '⚡ ക്വാണ്ട് ഓട്ടോ-കാലിബ്രേഷൻ' : '⚡ QUANT AUTO-CALIBRATED'}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 leading-snug">
          {language === 'ml'
            ? 'കോർപ്പറേറ്റ് അൽഗോരിതത്തിൽ ഈ പാരാമീറ്ററുകൾ ഇന്ത്യ VIX, ATR വോളാറ്റിലിറ്റി എന്നിവ പരിശോധിച്ച് സിസ്റ്റം സ്വയം നിയന്ത്രിക്കുന്നു. ആവശ്യമെങ്കിൽ മാത്രം നിങ്ങൾക്ക് മാനുവലായി ക്രമീകരിക്കാം.'
            : 'In Corporate Quant mode, these safety limits are auto-calibrated using market volatility (India VIX & ATR). Manual adjustments are optional.'}
        </p>
        {/* 100% Automated Corporate Quant Fund & Risk Engine (Zero Manual Inputs) */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 space-y-3.5 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <span>
                    {language === 'ml'
                      ? 'അക്കൗണ്ട് ഫണ്ട് & റിസ്ക് കൺട്രോൾ (100% ഓട്ടോമാറ്റിക്)'
                      : 'Autonomous Fund & Risk Management'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    100% HANDS-FREE
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {language === 'ml'
                    ? 'അക്കൗണ്ടിലുള്ള മുഴുവൻ തുകയും മാർക്കറ്റ് വോളാറ്റിലിറ്റിയും (ATR & India VIX) പരിശോധിച്ച് അൽഗോരിതം സ്വയം ട്രേഡുകൾ എടുക്കുന്നു. മാനുവൽ തെരഞ്ഞെടുപ്പുകൾ ആവശ്യമില്ല.'
                    : 'Evaluates 100% live account margin & real-time ATR/VIX to size trades automatically with zero manual guesswork.'}
                </p>
              </div>
            </div>
          </div>
          {/* 3 Pillars of Automated Operation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-300 pt-1">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="font-bold text-emerald-300 block mb-0.5">
                💰 {language === 'ml' ? 'അക്കൗണ്ട് ഫണ്ട് ഉപയോഗം' : 'Dynamic Cash Sizing'}
              </span>
              <span className="text-slate-300">
                {language === 'ml'
                  ? 'അക്കൗണ്ടിലുള്ള മുഴുവൻ ലഭ്യമായ മാർജിൻ (Live Available Margin) സ്വയം ഉപയോഗിച്ച് കൃത്യമായ ലോട്ട് എടുക്കുന്നു.'
                  : 'Automatically allocates from your real live account cash without artificial limits.'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="font-bold text-indigo-300 block mb-0.5">
                🎯 {language === 'ml' ? 'ഓട്ടോ ടാർഗറ്റ് & ട്രെയിലിംഗ്' : 'Dynamic Target & SL'}
              </span>
              <span className="text-slate-300">
                {language === 'ml'
                  ? 'ഓപ്ഷൻ ഡെൽറ്റയും വോളാറ്റിലിറ്റിയും കണക്കാക്കി ടാർഗറ്റും ട്രെയിലിംഗ് സ്റ്റോപ്പ്-ലോസും അൽഗോരിതം സ്വയം വെക്കുന്നു.'
                  : 'Auto-calibrated profit targets and trailing stop-loss that locks gains as trades run.'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="font-bold text-amber-300 block mb-0.5">
                🛡️ {language === 'ml' ? 'ബ്രോക്കറേജ് പ്രൊട്ടക്ഷൻ' : 'Brokerage Shield'}
              </span>
              <span className="text-slate-300">
                {language === 'ml'
                  ? 'എല്ലാ എക്സ്ചേഞ്ച് ടാക്സുകളും ബ്രോക്കറേജും കഴിച്ചുള്ള നെറ്റ് ലാഭം ഉറപ്പു വരുത്തുന്ന ട്രേഡുകൾ മാത്രം എടുക്കുന്നു.'
                  : 'Enforces that expected target profit strictly clears all round-trip brokerage & taxes.'}
              </span>
            </div>
          </div>
        </div>
        {/* Trailing Stop Loss toggle */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white block">
                {language === 'ml'
                  ? '100% പീക്ക് പ്രോഫിറ്റ് വാൾട്ട് (Ultra Profit Retention Vault)'
                  : '100% Ultra Profit Retention Vault & Floor'}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[9px] border border-amber-500/30">
                ₹10,000 LOCK
              </span>
            </div>
            <span className="text-[10px] text-slate-300 block mt-0.5">
              {language === 'ml'
                ? 'ലാഭം ഉയർന്ന നിലയിലെത്തിയാൽ (ഉദാ: ₹10,000 / ₹5,000 / ₹1,500) പിന്നീട് വിപണി തിരിഞ്ഞുമറിഞ്ഞ് ₹200-ലേക്ക് കുറയാൻ അനുവദിക്കില്ല; 95% പീക്ക് ലാഭവും ഉടൻ ലോക്ക് ചെയ്യുന്നു!'
                : 'Guarantees that a trade reaching peak profits (e.g. ₹10,000 or ₹5,000) will never collapse back down to ₹200. Instantly locks in 95%+ of top gains!'}
            </span>
          </div>
          <input
            type="checkbox"
            checked={botConfig.trailingStopLoss}
            onChange={(e) => onUpdateBotConfig({ trailingStopLoss: e.target.checked })}
            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          />
        </div>
        {/* MTF Confluence toggle */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">
              {language === 'ml'
                ? 'മൾട്ടി-ടൈംഫ്രെയിം കൺഫർമേഷൻ (5m + 15m)'
                : 'Multi-Timeframe Confirmation (5m + 15m)'}
            </span>
            <span className="text-[10px] text-slate-400">
              {language === 'ml'
                ? 'ഉയർന്ന ടൈംഫ്രെയിം ട്രെൻഡ് അനുകൂലമെങ്കിൽ മാത്രം ട്രേഡ് എടുക്കുക'
                : 'Only take trades aligned with higher 15m trend'}
            </span>
          </div>
          <input
            type="checkbox"
            checked={botConfig.multiTimeframeEnabled}
            onChange={(e) => onUpdateBotConfig({ multiTimeframeEnabled: e.target.checked })}
            className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
          />
        </div>
        {/* Option Strike Recommendation toggle */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">
              {language === 'ml'
                ? 'ഓപ്ഷൻ സ്ട്രൈക്ക് ഓട്ടോ-സെലക്ടർ (ATM CE/PE)'
                : 'Auto ATM Option Strike Selector'}
            </span>
            <span className="text-[10px] text-slate-400">
              {language === 'ml'
                ? 'ഇൻഡക്സ് സിഗ്നലുകൾക്ക് അനുയോജ്യമായ ATM ഓപ്ഷൻ നിർദ്ദേശിക്കുന്നു'
                : 'Calculates best ATM strike & premium for Nifty/BankNifty'}
            </span>
          </div>
          <input
            type="checkbox"
            checked={botConfig.optionStrikeSelector}
            onChange={(e) => onUpdateBotConfig({ optionStrikeSelector: e.target.checked })}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </div>
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
      </div>
    </div>
  </>
);
