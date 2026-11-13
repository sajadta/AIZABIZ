import React from 'react';
import { Send, BellRing, Check, AlertTriangle, Info } from 'lucide-react';
import type { BotConfig, Language } from '../../types';
interface TelegramTabProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  language: Language;
  handleSendTestTelegramAlert: () => Promise<void>;
  testAlertSending: boolean;
  testAlertResult: { success: boolean; message: string } | null;
}
export const TelegramTab: React.FC<TelegramTabProps> = ({
  botConfig,
  onUpdateBotConfig,
  language,
  handleSendTestTelegramAlert,
  testAlertSending,
  testAlertResult,
}) => (
  <>
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-gradient-to-br from-sky-950/30 to-slate-900 border border-sky-800/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-white">
                {language === 'ml'
                  ? 'ടെലിഗ്രാം ഇൻസ്റ്റന്റ് ട്രേഡ് അലേർട്ടുകൾ'
                  : 'Telegram Instant Trade Alerts'}
              </h4>
              <p className="text-[10px] text-slate-200">
                {language === 'ml'
                  ? 'സിഗ്നലുകളും ഓർഡറുകളും ഉടൻ നിങ്ങളുടെ ഫോണിലേക്ക് ലഭിക്കും'
                  : 'Get instant trade signals, entries, and SL/TP alerts on Telegram'}
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={botConfig.telegramAlertsEnabled}
            onChange={(e) => onUpdateBotConfig({ telegramAlertsEnabled: e.target.checked })}
            className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
          />
        </div>
        {/* Bot Token input */}
        <div>
          <label className="text-xs font-bold text-slate-200 block mb-1">
            {language === 'ml' ? 'ടെലിഗ്രാം ബോട്ട് ടോക്കൺ (Bot Token):' : 'Telegram Bot Token:'}
          </label>
          <input
            type="text"
            placeholder="e.g. 7123456789:AAFlxyz..."
            value={botConfig.telegramBotToken || ''}
            onChange={(e) => onUpdateBotConfig({ telegramBotToken: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-sky-500 outline-none"
          />
        </div>
        {/* Chat ID input */}
        <div>
          <label className="text-xs font-bold text-slate-200 block mb-1">
            {language === 'ml' ? 'ടെലിഗ്രാം ചാറ്റ് ഐഡി (Chat ID):' : 'Telegram Chat ID:'}
          </label>
          <input
            type="text"
            placeholder="e.g. 987654321 or @your_channel"
            value={botConfig.telegramChatId || ''}
            onChange={(e) => onUpdateBotConfig({ telegramChatId: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-sky-500 outline-none"
          />
        </div>
        {/* Send Test Message Button */}
        <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={handleSendTestTelegramAlert}
            disabled={testAlertSending}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {testAlertSending
                ? language === 'ml'
                  ? 'അയക്കുന്നു...'
                  : 'Sending...'
                : language === 'ml'
                  ? 'ടെസ്റ്റ് അലേർട്ട് അയക്കുക'
                  : 'Send Test Alert'}
            </span>
          </button>
          {testAlertResult && (
            <div
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                testAlertResult.success
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
              }`}
            >
              {testAlertResult.success ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              <span>{testAlertResult.message}</span>
            </div>
          )}
        </div>
      </div>
      {/* Quick Setup Instructions Card */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
        <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <span>
            {language === 'ml'
              ? 'ടെലിഗ്രാം ബോട്ട് എങ്ങനെ സെറ്റപ്പ് ചെയ്യാം?'
              : 'How to set up Telegram Bot in 1 minute:'}
          </span>
        </h5>
        <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
          <li>
            {language === 'ml'
              ? 'ടെലിഗ്രാമിൽ @BotFather തുറന്ന് /newbot എന്ന് നൽകി നിങ്ങളുടെ ബോട്ട് ടോക്കൺ എടുക്കുക.'
              : 'Open @BotFather on Telegram, type /newbot, and copy your HTTP API Token.'}
          </li>
          <li>
            {language === 'ml'
              ? 'നിങ്ങളുടെ ചാറ്റ് ഐഡി അറിയാൻ @userinfobot-ൽ മെസ്സേജ് അയക്കുക.'
              : 'Message @userinfobot to get your personal Chat ID.'}
          </li>
          <li>
            {language === 'ml'
              ? 'നിങ്ങൾ ഉണ്ടാക്കിയ ബോട്ടിന് ഒരു തവണ /start അയക്കുക.'
              : 'Send /start once to your newly created bot to activate notifications.'}
          </li>
        </ol>
      </div>
    </div>
  </>
);
