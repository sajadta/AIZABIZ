import React, { useEffect, useState } from 'react';
import { Shield, Send, Server, Save, X } from 'lucide-react';
import type { BotConfig, Language, UpstoxApiConfig } from '../types';
import { safeStorage } from '../utils/storage';

interface OnboardingSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: {
    botConfig: Pick<BotConfig, 'telegramBotToken' | 'telegramChatId'>;
    apiConfig: Pick<UpstoxApiConfig, 'apiKey' | 'apiSecret' | 'redirectUri'>;
  }) => void;
  defaultBotConfig: BotConfig;
  defaultApiConfig: UpstoxApiConfig;
  language: Language;
}

export const OnboardingSetupModal: React.FC<OnboardingSetupModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultBotConfig,
  defaultApiConfig,
  language,
}) => {
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [upstoxApiKey, setUpstoxApiKey] = useState('');
  const [upstoxApiSecret, setUpstoxApiSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setTelegramBotToken(defaultBotConfig?.telegramBotToken || safeStorage.getItem('algo_tg_token') || '');
    setTelegramChatId(defaultBotConfig?.telegramChatId || safeStorage.getItem('algo_tg_chat') || '');
    setUpstoxApiKey(defaultApiConfig?.apiKey || safeStorage.getItem('algo_upstox_key') || '');
    setUpstoxApiSecret(defaultApiConfig?.apiSecret || '');
    setRedirectUri(
      defaultApiConfig?.redirectUri || safeStorage.getItem('algo_upstox_redirect') ||
      (typeof window !== 'undefined' ? window.location.origin : ''),
    );
  }, [isOpen, defaultBotConfig, defaultApiConfig]);

  if (!isOpen) return null;

  const handleSave = () => {
    safeStorage.setItem('app_setup_complete', 'true');
    safeStorage.setItem('algo_tg_token', telegramBotToken);
    safeStorage.setItem('algo_tg_chat', telegramChatId);
    safeStorage.setItem('algo_upstox_key', upstoxApiKey);
    safeStorage.removeItem('algo_upstox_secret');
    safeStorage.setItem('algo_upstox_redirect', redirectUri);

    onSave({
      botConfig: { telegramBotToken, telegramChatId },
      apiConfig: { apiKey: upstoxApiKey, apiSecret: upstoxApiSecret, redirectUri },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] my-auto relative"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95 touch-manipulation z-10" aria-label="Close setup modal">
          <X className="w-5 h-5" />
        </button>
        <div className="p-5 border-b border-slate-800/60 bg-gradient-to-r from-indigo-900/40 to-slate-900 text-center">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-3"><Shield className="w-6 h-6 text-indigo-400" /></div>
          <h2 className="text-xl font-black text-white tracking-tight">{language === 'ml' ? 'ആദ്യത്തെ സജ്ജീകരണം' : 'Initial Setup'}</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {language === 'ml' ? 'ആവശ്യമായ ക്രമീകരണങ്ങൾ നൽകുക. API രഹസ്യം ബ്രൗസറിൽ സൂക്ഷിക്കില്ല.' : 'Provide basic settings. API secrets are not persisted in browser storage.'}
          </p>
        </div>
        <div className="p-5 overflow-y-auto space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2"><Send className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-bold text-slate-200">{language === 'ml' ? 'ടെലഗ്രാം അലർട്ടുകൾ' : 'Telegram Alerts'}</h3></div>
            <label className="block text-[11px] font-bold text-slate-400">Bot Token<input type="password" autoComplete="off" value={telegramBotToken} onChange={(event) => setTelegramBotToken(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none" /></label>
            <label className="block text-[11px] font-bold text-slate-400">Chat ID<input type="text" autoComplete="off" value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none" /></label>
          </section>
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2"><Server className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-bold text-slate-200">{language === 'ml' ? 'Upstox API വിവരങ്ങൾ (ഐച്ഛികം)' : 'Upstox API Keys (Optional)'}</h3></div>
            <label className="block text-[11px] font-bold text-slate-400">API Key (Client ID)<input type="text" autoComplete="off" value={upstoxApiKey} onChange={(event) => setUpstoxApiKey(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" /></label>
            <label className="block text-[11px] font-bold text-slate-400">API Secret<input type="password" autoComplete="new-password" value={upstoxApiSecret} onChange={(event) => setUpstoxApiSecret(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" /></label>
            <label className="block text-[11px] font-bold text-slate-400">Redirect URI<input type="url" autoComplete="url" value={redirectUri} onChange={(event) => setRedirectUri(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" /></label>
          </section>
        </div>
        <div className="p-4 border-t border-slate-800/60 bg-slate-900/50 space-y-2">
          <button type="button" onClick={handleSave} className="w-full py-3.5 min-h-[44px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-black shadow-lg flex items-center justify-center gap-2"><Save className="w-4 h-4" /><span>{language === 'ml' ? 'സേവ് ചെയ്യുക & തുടങ്ങുക' : 'Save & Continue'}</span></button>
          <button type="button" onClick={onClose} className="w-full py-2.5 min-h-[44px] rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition">{language === 'ml' ? 'ഇപ്പോഴത്തേക്ക് ഒഴിവാക്കുക' : 'Skip for now'}</button>
        </div>
      </div>
    </div>
  );
};
