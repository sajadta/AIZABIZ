// Risk management, autonomous fund engine and strategy toggles.
import React from 'react';
import { ShieldCheck, Sliders } from 'lucide-react';
import type { BotConfig, Language } from '../../../types';

interface RiskControlsPanelProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  language: Language;
}

export const RiskControlsPanel: React.FC<RiskControlsPanelProps> = ({
  botConfig,
  onUpdateBotConfig,
  language,
}) => (
  <>
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
    </div>
  </>
);
