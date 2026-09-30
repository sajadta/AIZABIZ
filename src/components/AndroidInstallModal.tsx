import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  CheckCircle2, 
  ArrowRight, 
  Share2, 
  Sparkles, 
  ShieldCheck,
  Globe,
  Terminal,
  
  Server,
  Key,
  HelpCircle,
  Zap,
  Cpu
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';

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
  const t = translations[language];
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'PWA' | 'APK' | 'GITHUB' | 'IP_FAQ'>('PWA');
  const [manualNote, setManualNote] = useState<string | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
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
      setManualNote(language === 'ml' 
        ? 'നിങ്ങളുടെ മൊബൈൽ Chrome ബ്രൗസറിലെ മുകളിലെ 3 ഡോട്ടുകൾ (⋮) ക്ലിക്ക് ചെയ്ത് "Add to Home Screen / Install app" തിരഞ്ഞെടുക്കുക.' 
        : 'Open Chrome menu (3 dots) on your phone and tap "Install app" or "Add to Home screen".');
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
                <span>{language === 'ml' ? 'ആൻഡ്രോയിഡ് ആപ്പ് & ഗിറ്റ്ഹബ്ബ് ഹബ്ബ്' : 'Android App & GitHub Hub'}</span>
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
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 text-center space-y-3 shadow-lg">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950">
                  <Smartphone className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    Upstox Live Algo Terminal (Android WebAPK)
                  </h4>
                  <p className="text-xs text-slate-200 mt-1 max-w-md mx-auto leading-relaxed">
                    {language === 'ml' 
                      ? 'നിങ്ങളുടെ മൊബൈൽ ഫോണിൽ യാതൊരു തടസ്സവുമില്ലാതെ ഫുൾ-സ്ക്രീൻ നേറ്റീവ് ആപ്പ് ആയി പ്രവർത്തിക്കാൻ ഇത് ഇൻസ്റ്റാൾ ചെയ്യാം.' 
                      : 'Install as a full-screen standalone application on your Android phone with zero lag, instant notifications, and live charts.'}
                  </p>
                </div>

                <button
                  id="btn-trigger-pwa-install"
                  onClick={handleInstallClick}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-950 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === 'ml' ? 'ഫോണിൽ ഇൻസ്റ്റാൾ ചെയ്യുക (Install App)' : t.installPwaBtn}</span>
                </button>

                {manualNote && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-left animate-in fade-in">
                    {manualNote}
                  </div>
                )}
              </div>

              {/* Step by step guide */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs text-slate-200">
                <span className="font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{language === 'ml' ? 'മൊബൈലിൽ ചെയ്യേണ്ട ഘട്ടങ്ങൾ:' : 'Mobile Installation Steps:'}</span>
                </span>
                <div className="space-y-2 text-[11px] text-slate-200">
                  <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                    <span>{language === 'ml' ? 'മൊബൈലിലെ Google Chrome-ൽ ഈ ആപ്പ് തുറക്കുക.' : 'Open this app in Google Chrome on your Android mobile.'}</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                    <span>{language === 'ml' ? 'മുകളിൽ വലതുവശത്തെ 3 കുത്തുകൾ (Chrome Menu ⋮) അമർത്തുക.' : 'Tap the three-dots menu (⋮) in the top-right corner.'}</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                    <span>{language === 'ml' ? '"Install app" അല്ലെങ്കിൽ "Add to Home screen" ക്ലിക്ക് ചെയ്യുക.' : 'Select "Install app" or "Add to Home screen".'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STANDALONE .APK FILE CREATION */}
          {activeTab === 'APK' && (
            <div className="space-y-4 text-xs text-slate-200">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <p className="font-bold text-emerald-400 mb-1">
                  {language === 'ml' ? 'ഒരു .APK ഫയൽ ഉണ്ടാക്കാനുള്ള എളുപ്പവഴി:' : 'How to create a standalone .APK file:'}
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0">1</span>
                    <p className="text-[11px] leading-relaxed">
                      {language === 'ml' 
                        ? 'ആദ്യം മുകളിലുള്ള "Settings" അല്ലെങ്കിൽ "Share" വഴി ഈ ആപ്പ് നിങ്ങളുടെ കമ്പ്യൂട്ടറിലേക്ക് ഡൗൺലോഡ് ചെയ്യുക (അല്ലെങ്കിൽ GitHub ലേക്ക് മാറ്റുക).'
                        : 'First, export or download this app to your computer using the Settings or Share menu.'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0">2</span>
                    <p className="text-[11px] leading-relaxed">
                      {language === 'ml' 
                        ? 'PWABuilder വെബ്സൈറ്റ് (www.pwabuilder.com) തുറക്കുക.'
                        : 'Open the free PWABuilder tool (www.pwabuilder.com).'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0">3</span>
                    <p className="text-[11px] leading-relaxed">
                      {language === 'ml' 
                        ? 'നിങ്ങളുടെ ആപ്പിന്റെ URL അതിൽ നൽകി "Generate APK" ക്ലിക്ക് ചെയ്താൽ നിമിഷങ്ങൾക്കകം Android/Playstore ആപ്പ് ഡൗൺലോഡ് ചെയ്യാം.'
                        : 'Paste this app\'s hosted URL there, and click "Generate" to instantly download a ready-to-install Android APK file.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[10px] text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  {language === 'ml' 
                    ? 'AI Studio-ക്കകത്ത് വെച്ച് നേരിട്ട് APK ഫയൽ നിർമ്മിക്കാൻ സാങ്കേതികമായി സാധ്യമല്ല. അതിനാൽ മുകളിലെ മാർഗ്ഗം ഉപയോഗിക്കുക.'
                    : 'Note: AI Studio cannot generate raw .APK binary files directly in the browser environment. Use the simple wrapper method above.'}
                </span>
              </div>
            </div>
          )}
          {activeTab === 'GITHUB' && (
            <div className="space-y-3.5 text-xs text-slate-200">
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-1.5">
                <span className="font-extrabold text-purple-300 flex items-center gap-2 text-sm">
                  <HelpCircle className="w-4 h-4 text-purple-400" />
                  <span>{language === 'ml' ? 'ഈ പ്രോജക്ട് GitHub-ലേക്ക് ചേർക്കേണ്ടതുണ്ടോ?' : 'Should you push this project to GitHub?'}</span>
                </span>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  {language === 'ml'
                    ? 'തീർച്ചയായും! GitHub-ലേക്ക് ചേർക്കുന്നത് നിങ്ങളുടെ കോഡ് സുരക്ഷിതമായി സൂക്ഷിക്കാനും, സ്വന്തം സെർവറിലോ (Render, Vercel, VPS) നിങ്ങളുടെ കമ്പ്യൂട്ടറിലോ റൺ ചെയ്യാനും സഹായിക്കും.'
                    : 'Yes, exporting to GitHub preserves your entire codebase, allows continuous deployment (CI/CD), and lets you run it 24/7 on your own server or VPS.'}
                </p>
              </div>

              {/* Export Steps */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                <span className="font-bold text-white block">
                  {language === 'ml' ? '📌 GitHub-ലേക്ക് എക്സ്പോർട്ട് ചെയ്യുന്ന ലളിതമായ വഴി:' : '📌 Quick Export Steps:'}
                </span>
                <div className="space-y-2 text-[11px] text-slate-200">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <span>
                      {language === 'ml'
                        ? 'മുകളിൽ വലതുവശത്തുള്ള AI Studio **"Settings / Export"** മെനുവിൽ ക്ലിക്ക് ചെയ്ത് **"Export to GitHub"** അല്ലെങ്കിൽ **"Download ZIP"** നൽകുക.'
                        : 'Use the AI Studio Settings menu to click "Export to GitHub" or "Download ZIP".'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <span>
                      {language === 'ml'
                        ? 'നിങ്ങളുടെ GitHub അക്കൗണ്ട് സെലക്ട് ചെയ്യുക. എല്ലാ കോഡുകളും നിമിഷങ്ങൾക്കകം GitHub Repo ആയി മാറും.'
                        : 'Select your GitHub account to instantly push all files.'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <span>
                      {language === 'ml'
                        ? 'ശേഷം കമ്പ്യൂട്ടറിൽ `npm install` ചെയ്ത് `npm run dev` റൺ ചെയ്താൽ സ്വന്തമായി പ്രവർത്തിപ്പിക്കാം.'
                        : 'Run `npm install` and `npm run dev` to host and trade anytime.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FIXED IP & SAFETY FAQ */}
          {activeTab === 'IP_FAQ' && (
            <div className="space-y-3 text-xs text-slate-200">
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                <span className="font-extrabold text-amber-300 flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>{language === 'ml' ? 'Fixed IP ഇല്ലാത്തത് Upstox ഓർഡറുകളെ ബാധിക്കുമോ?' : 'Does lack of Static IP affect Upstox Orders?'}</span>
                </span>
                <p className="text-[11px] text-slate-200 leading-relaxed font-semibold">
                  {language === 'ml'
                    ? '❌ ഇല്ല! ഒരിക്കലും കുഴപ്പമില്ല. Upstox ഓർഡറുകൾ ബ്ലോക്ക് ചെയ്യില്ല.'
                    : '❌ No! There is zero risk. Upstox will NOT block your orders.'}
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-200 leading-relaxed">
                  <p>
                    • <b>OAuth 2.0 Token Authentication:</b> Upstox API v2 പ്രവർത്തിക്കുന്നത് IP Whitelist അടിസ്ഥാനമാക്കിയല്ല, മറിച്ച് ദിവസവും 2-Factor ലോഗിൻ വഴി ഉണ്ടാക്കുന്ന JWT Token അടിസ്ഥാനമാക്കിയാണ്.
                  </p>
                  <p>
                    • <b>മൊബൈൽ നെറ്റ്‌വർക്കുകൾ:</b> ലക്ഷക്കണക്കിന് ട്രേഡർമാർ മൊബൈൽ ഇന്റർനെറ്റ് (Jio/Airtel) വഴിയാണ് ട്രേഡ് ചെയ്യുന്നത്. അതിൽ ഓരോ മിനിറ്റിലും IP മാറിക്കൊണ്ടിരിക്കും. ഇത് സാധാരണവും നിയമപരവുമാണ്.
                  </p>
                  <p>
                    • <b>Rate Limit സുരക്ഷ:</b> ഈ ആപ്പിൽ സെക്കൻഡിൽ അനുവദിച്ചിട്ടുള്ള 3-5 റിക്വസ്റ്റുകൾ മാത്രമേ അയക്കൂ എന്നതിനാൽ API Throttling അല്ലെങ്കിൽ സ്പാം പ്രശ്നങ്ങൾ ഉണ്ടാകില്ല.
                  </p>
                </div>
              </div>
            </div>
          )}

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

