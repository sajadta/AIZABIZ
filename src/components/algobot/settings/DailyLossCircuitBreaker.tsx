// Daily max-loss circuit breaker with presets and a custom limit input.
import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { BotConfig, Language } from '../../../types';

interface DailyLossCircuitBreakerProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  language: Language;
}

export const DailyLossCircuitBreaker: React.FC<DailyLossCircuitBreakerProps> = ({
  botConfig,
  onUpdateBotConfig,
  language,
}) => (
  <>
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
            onClick={() => onUpdateBotConfig({ dailyMaxLossLimit: amount, dailyLossLocked: false })}
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
  </>
);
