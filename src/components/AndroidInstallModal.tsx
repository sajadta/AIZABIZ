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

                <div className="space-y-2 pt-1">
                  <button
                    id="btn-trigger-pwa-install"
                    onClick={handleInstallClick}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-950 transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>{language === 'ml' ? '⚡ നേരിട്ട് ഇൻസ്റ്റാൾ ചെയ്യുക (1-Click Install)' : '⚡ Direct 1-Click Install'}</span>
                  </button>

                  <a
                    href="/api/download/launcher"
                    download="AIZABIZ-Trading-Terminal.html"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-blue-950 transition active:scale-95 flex items-center justify-center gap-2 block text-center"
                  >
                    <Download className="w-4 h-4 inline" />
                    <span>{language === 'ml' ? '📥 ആപ്പ് ലോഞ്ചർ ഡൗൺലോഡ് ചെയ്യുക (Instant Launcher File)' : '📥 Download Instant App Launcher'}</span>
                  </a>
                </div>

                {manualNote && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-left animate-in fade-in space-y-1.5">
                    <p className="font-bold">⚠️ {manualNote}</p>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      {language === 'ml' 
                        ? 'Realme / Oppo ഫോണുകളിൽ: Settings ➔ Apps ➔ Chrome ➔ Permissions ➔ "Home screen shortcuts" എന്നത് Allow ചെയ്യുക.' 
                        : 'On Realme/Oppo phones: Enable Settings > Apps > Chrome > Permissions > "Home screen shortcuts".'}
                    </p>
                  </div>
                )}
              </div>

              {/* Step by step guide */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs text-slate-200">
                <span className="font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{language === 'ml' ? 'മൊബൈലിൽ ചെയ്യേണ്ട 3 ലളിതമായ വഴികൾ:' : '3 Simple Mobile Installation Options:'}</span>
                </span>
                <div className="space-y-2 text-[11px] text-slate-200">
                  <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                    <div>
                      <span className="font-bold text-emerald-400">{language === 'ml' ? 'വഴി 1: ആപ്പ് ലോഞ്ചർ ഡൗൺലോഡ് ചെയ്യുക' : 'Option 1: Download Instant Launcher'}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ml' ? 'മുകളിലെ നീല ബട്ടൺ ക്ലിക്ക് ചെയ്താൽ ഫയൽ തനിയെ ഡൗൺലോഡ് ആകും. അത് തുറന്നാൽ ഫുൾസ്ക്രീനിൽ ട്രേഡിംഗ് ആപ്പ് വരും!' : 'Tap the blue button above to download launcher file and open full-screen directly!'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                    <div>
                      <span className="font-bold text-blue-400">{language === 'ml' ? 'വഴി 2: Create Shortcut ക്ലിക്ക് ചെയ്യുക' : 'Option 2: Tap Create Shortcut'}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ml' ? 'ക്രോമിലെ 3 കുത്തുകളിൽ (⋮) ക്ലിക്ക് ചെയ്ത് "Create shortcut" കൊടുത്ത് "Add" അടിക്കുക.' : 'Tap Chrome 3-dots > "Create shortcut" > "Add" to add icon to home screen.'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                    <div>
                      <span className="font-bold text-indigo-400">{language === 'ml' ? 'വഴി 3: APK ഫയൽ ഡൗൺലോഡ് ചെയ്യുക' : 'Option 3: Standalone APK'}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ml' ? 'മുകളിലെ ".APK ഫയൽ" ടാബിൽ ക്ലിക്ക് ചെയ്ത് നേരിട്ട് ആൻഡ്രോയിഡ് APK ഡൗൺലോഡ് ചെയ്യാം.' : 'Switch to the .APK tab above to generate and download signed Android APK.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STANDALONE .APK FILE CREATION */}
          {activeTab === 'APK' && (
            <div className="space-y-4 text-xs text-slate-200">
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Download className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-black text-white text-sm">
                      {language === 'ml' ? 'യഥാർത്ഥ ആൻഡ്രോയിഡ് .APK ഡൗൺലോഡ്' : 'Direct Android .APK Generator'}
                    </p>
                    <p className="text-[11px] text-indigo-200">
                      {language === 'ml' ? 'മൈക്രോസോഫ്റ്റ് PWABuilder വഴി ഒരൊറ്റ ക്ലിക്കിൽ APK ഉണ്ടാക്കുക' : 'Official PWABuilder 1-click APK download generator'}
                    </p>
                  </div>
                </div>

                <a
                  href={`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-950 transition active:scale-95 flex items-center justify-center gap-2 text-center"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === 'ml' ? '📦 ഒരൊറ്റ ക്ലിക്കിൽ APK ഡൗൺലോഡ് ചെയ്യുക (Open APK Generator)' : '📦 Generate & Download .APK File'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>

                <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                  <p className="font-bold text-emerald-400">
                    {language === 'ml' ? 'APK ഡൗൺലോഡ് ചെയ്യുന്ന വിധം:' : 'How to download the APK:'}
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                    <li>{language === 'ml' ? 'മുകളിലെ പർപ്പിൾ ബട്ടണിൽ ക്ലിക്ക് ചെയ്യുക (PWABuilder പേജ് തുറക്കും).' : 'Click the purple button above to open PWABuilder.'}</li>
                    <li>{language === 'ml' ? 'അവിടെ കാണുന്ന "Android" ബോക്സിൽ "Package For Store / APK" ക്ലിക്ക് ചെയ്യുക.' : 'Select the Android option.'}</li>
                    <li>{language === 'ml' ? 'നിമിഷങ്ങൾക്കുള്ളിൽ നിങ്ങളുടെ ഫോണിലേക്ക് ഇൻസ്റ്റാൾ ചെയ്യാവുന്ന ഒറിജിനൽ .apk ഫയൽ ലഭിക്കും!' : 'Instantly download your ready-to-install Android APK file!'}</li>
                  </ol>
                </div>
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

