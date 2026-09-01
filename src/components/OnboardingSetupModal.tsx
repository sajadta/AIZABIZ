import React, { useState, useEffect } from 'react';
import { Shield, Send, CheckCircle2, Server, Save } from 'lucide-react';

export const OnboardingSetupModal = ({ isOpen, onClose, onSave, defaultBotConfig, defaultApiConfig, language }: any) => {
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [upstoxApiKey, setUpstoxApiKey] = useState('');
  const [upstoxApiSecret, setUpstoxApiSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTelegramBotToken(defaultBotConfig?.telegramBotToken || localStorage.getItem('algo_tg_token') || '');
      setTelegramChatId(defaultBotConfig?.telegramChatId || localStorage.getItem('algo_tg_chat') || '');
      setUpstoxApiKey(defaultApiConfig?.apiKey || localStorage.getItem('algo_upstox_key') || '');
      setUpstoxApiSecret(defaultApiConfig?.apiSecret || localStorage.getItem('algo_upstox_secret') || '');
      setRedirectUri(defaultApiConfig?.redirectUri || localStorage.getItem('algo_upstox_redirect') || 'https://127.0.0.1:3000');
    }
  }, [isOpen, defaultBotConfig, defaultApiConfig]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('app_setup_complete', 'true');
    localStorage.setItem('algo_tg_token', telegramBotToken);
    localStorage.setItem('algo_tg_chat', telegramChatId);
    localStorage.setItem('algo_upstox_key', upstoxApiKey);
    localStorage.setItem('algo_upstox_secret', upstoxApiSecret);
    localStorage.setItem('algo_upstox_redirect', redirectUri);
    
    onSave({
      botConfig: { telegramBotToken, telegramChatId },
      apiConfig: { apiKey: upstoxApiKey, apiSecret: upstoxApiSecret, redirectUri }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800/60 bg-gradient-to-r from-indigo-900/40 to-slate-900 text-center">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {language === 'ml' ? 'ആദ്യത്തെ സജ്ജീകരണം' : 'Initial Setup'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {language === 'ml' 
              ? 'ഈ ആപ്പ് നിങ്ങളുടെ മൊബൈലിൽ സുരക്ഷിതമായി പ്രവർത്തിക്കാൻ ആവശ്യമായ അടിസ്ഥാന വിവരങ്ങൾ നൽകുക. ഇത് നിങ്ങളുടെ ബ്രൗസറിൽ മാത്രമേ സേവ് ചെയ്യപ്പെടുകയുള്ളൂ.'
              : 'Provide the basic configuration required for this private app. This is saved locally in your browser.'}
          </p>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Telegram Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-200">{language === 'ml' ? 'ടെലഗ്രാം അലർട്ടുകൾ' : 'Telegram Alerts'}</h3>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Bot Token</label>
              <input
                type="text"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="e.g. 123456789:ABCdefGhI..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Chat ID</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="e.g. 12345678"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Upstox Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Server className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-200">{language === 'ml' ? 'Upstox API വിവരങ്ങൾ (Optional)' : 'Upstox API Keys (Optional)'}</h3>
            </div>
            <p className="text-[10px] text-amber-500/80 -mt-2">
              {language === 'ml' ? '* നിങ്ങൾ Daily Access Token മാത്രമാണ് ഉപയോഗിക്കുന്നതെങ്കിൽ ഇത് നിർബന്ധമില്ല.' : '* Not required if using Daily Access Token manual login.'}
            </p>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">API Key (Client ID)</label>
              <input
                type="text"
                value={upstoxApiKey}
                onChange={(e) => setUpstoxApiKey(e.target.value)}
                placeholder="e.g. 5xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">API Secret</label>
              <input
                type="password"
                value={upstoxApiSecret}
                onChange={(e) => setUpstoxApiSecret(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800/60 bg-slate-900/50">
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-black shadow-lg shadow-indigo-950 transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{language === 'ml' ? 'സേവ് ചെയ്യുക & തുടങ്ങുക' : 'Save & Continue'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
