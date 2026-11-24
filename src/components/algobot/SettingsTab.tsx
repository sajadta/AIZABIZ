import React from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import type { BotConfig, Language, StockQuote } from '../../types';
import type { TickerStep } from './types';
import { QuantCockpit } from './settings/QuantCockpit';
import { DailyLossCircuitBreaker } from './settings/DailyLossCircuitBreaker';
import { RiskControlsPanel } from './settings/RiskControlsPanel';
import { AutoEnginePanel } from './settings/AutoEnginePanel';
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
      <QuantCockpit
        botConfig={botConfig}
        language={language}
        quotes={quotes}
        hudTickerIndex={hudTickerIndex}
        hudTickerStepsMl={hudTickerStepsMl}
        hudTickerStepsEn={hudTickerStepsEn}
      />
      <DailyLossCircuitBreaker
        botConfig={botConfig}
        onUpdateBotConfig={onUpdateBotConfig}
        language={language}
      />
      <RiskControlsPanel
        botConfig={botConfig}
        onUpdateBotConfig={onUpdateBotConfig}
        language={language}
      />
      <AutoEnginePanel language={language} />
    </div>
  </>
);
