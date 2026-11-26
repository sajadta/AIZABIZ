// The install prompt event is not in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Language } from '../types';
import { PwaInstallTab } from './install/PwaInstallTab';
import { ApkBuildTab } from './install/ApkBuildTab';
import { GithubExportTab } from './install/GithubExportTab';
import { FixedIpFaqTab } from './install/FixedIpFaqTab';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'PWA' | 'APK' | 'GITHUB' | 'IP_FAQ'>('PWA');
  const [manualNote, setManualNote] = useState<string | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setManualNote(
        language === 'ml'
          ? 'നിങ്ങളുടെ മൊബൈൽ Chrome ബ്രൗസറിലെ മുകളിലെ 3 ഡോട്ടുകൾ (⋮) ക്ലിക്ക് ചെയ്ത് "Add to Home Screen / Install app" തിരഞ്ഞെടുക്കുക.'
          : 'Open Chrome menu (3 dots) on your phone and tap "Install app" or "Add to Home screen".',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#090d16] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>
                  {language === 'ml'
                    ? 'ആൻഡ്രോയിഡ് ആപ്പ് & ഗിറ്റ്ഹബ്ബ് ഹബ്ബ്'
                    : 'Android App & GitHub Hub'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  APK / PWA
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ml'
                  ? 'മൊബൈൽ ഇൻസ്റ്റാളേഷൻ, APK ഡൗൺലോഡ്, ഗിറ്റ്ഹബ്ബ് മാനേജ്‌മെന്റ്'
                  : 'Mobile Installation, Standalone APK and Deployment Guide'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition active:scale-95 touch-manipulation"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-4 bg-[#070a12] border-b border-slate-800 p-1.5 text-[11px] font-bold gap-1">
          <button
            onClick={() => setActiveTab('PWA')}
            className={`py-2 px-1 rounded-xl transition text-center ${
              activeTab === 'PWA'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            📱 {language === 'ml' ? 'മൊബൈൽ ആപ്പ്' : 'Mobile App'}
          </button>

          <button
            onClick={() => setActiveTab('APK')}
            className={`py-2 px-1 rounded-xl transition text-center ${
              activeTab === 'APK'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            📦 {language === 'ml' ? '.APK ഫയൽ' : '.APK Export'}
          </button>

          <button
            onClick={() => setActiveTab('GITHUB')}
            className={`py-2 px-1 rounded-xl transition text-center ${
              activeTab === 'GITHUB'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            🐙 {language === 'ml' ? 'GitHub ഗൈഡ്' : 'GitHub Setup'}
          </button>

          <button
            onClick={() => setActiveTab('IP_FAQ')}
            className={`py-2 px-1 rounded-xl transition text-center ${
              activeTab === 'IP_FAQ'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            🔒 {language === 'ml' ? 'IP സുരക്ഷ' : 'IP & Safety'}
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* TAB 1: INSTANT MOBILE PWA INSTALL */}
          {activeTab === 'PWA' && (
            <PwaInstallTab
              language={language}
              manualNote={manualNote}
              onInstallClick={handleInstallClick}
            />
          )}

          {/* TAB 2: STANDALONE .APK FILE CREATION */}
          {activeTab === 'APK' && <ApkBuildTab language={language} />}
          {activeTab === 'GITHUB' && <GithubExportTab language={language} />}

          {/* TAB 4: FIXED IP & SAFETY FAQ */}
          {activeTab === 'IP_FAQ' && <FixedIpFaqTab language={language} />}

          {/* Bottom Close Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition"
            >
              {language === 'ml' ? 'അടയ്ക്കുക (Close)' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
