// Header quick-action cluster: Upstox token status, alerts, sound, install and
// language toggles.
import React from 'react';
import { BellRing, Smartphone, Volume2, VolumeX, Globe, ShieldCheck, Key } from 'lucide-react';
import type { Language, UpstoxApiConfig } from '../types';
import type { translations } from '../translations';

interface HeaderQuickActionsProps {
  apiConfig: UpstoxApiConfig;
  language: Language;
  setLanguage: (lang: Language) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onOpenApiSettings: () => void;
  onOpenAlerts: () => void;
  onOpenAndroidModal: () => void;
  t: (typeof translations)['en'];
}

export const HeaderQuickActions: React.FC<HeaderQuickActionsProps> = ({
  apiConfig,
  language,
  setLanguage,
  soundEnabled,
  setSoundEnabled,
  onOpenApiSettings,
  onOpenAlerts,
  onOpenAndroidModal,
  t,
}) => (
  <>
    {/* Right Controls - Mobile & Desktop Responsive Adaptive Bar */}
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      {/* Upstox Daily Token Status & Setup Button */}
      <button
        id="btn-api-settings"
        onClick={onOpenApiSettings}
        className={`h-8 sm:min-h-[44px] px-2 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition active:scale-95 touch-manipulation shrink-0 ${
          apiConfig.isConnected
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 animate-pulse'
        }`}
        title={apiConfig.isConnected ? 'Upstox Daily Token Active' : "Enter Today's Upstox Token"}
      >
        {apiConfig.isConnected ? (
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
        ) : (
          <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
        )}
        <span className="font-bold hidden sm:inline">
          {apiConfig.isConnected
            ? language === 'ml'
              ? 'ടോക്കൺ സജീവം'
              : 'Token Active'
            : language === 'ml'
              ? '☀️ ഡെയിലി ടോക്കൺ'
              : '☀️ Daily Token'}
        </span>
      </button>

      {/* Alerts Toggle */}
      <button
        id="btn-alerts-toggle"
        onClick={onOpenAlerts}
        className="w-8 h-8 sm:w-11 sm:h-11 min-w-[32px] sm:min-w-[44px] shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
        title={language === 'ml' ? 'അലർട്ടുകൾ' : 'Price Alerts'}
      >
        <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* Sound Toggle */}
      <button
        id="btn-sound-toggle"
        onClick={() => setSoundEnabled(!soundEnabled)}
        className={`w-8 h-8 sm:w-11 sm:h-11 min-w-[32px] sm:min-w-[44px] shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl border transition active:scale-95 touch-manipulation ${
          soundEnabled
            ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800'
            : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800'
        }`}
        title={soundEnabled ? t.soundOn : t.soundOff}
      >
        {soundEnabled ? (
          <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        ) : (
          <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        )}
      </button>

      {/* Android Mobile App / Desktop PWA install button */}
      <button
        id="btn-android-modal"
        onClick={onOpenAndroidModal}
        className="w-8 h-8 sm:w-11 sm:h-11 min-w-[32px] sm:min-w-[40px] shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-800 bg-slate-900 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
        title={language === 'ml' ? 'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക' : 'Install App'}
      >
        <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* Language Toggle */}
      <button
        id="btn-language-toggle"
        onClick={() => setLanguage(language === 'en' ? 'ml' : 'en')}
        className="h-8 sm:min-h-[44px] px-2 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] sm:text-xs font-bold text-slate-200 flex items-center justify-center gap-1 active:scale-95 transition shrink-0 touch-manipulation"
        title="Switch Language / ഭാഷ മാറ്റുക"
      >
        <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
        <span>{language === 'en' ? 'മല' : 'EN'}</span>
      </button>
    </div>
  </>
);
