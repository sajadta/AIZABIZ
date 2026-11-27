import React from 'react';
import { Smartphone, Sparkles, Download } from 'lucide-react';
import type { Language } from '../../types';

interface PwaInstallTabProps {
  language: Language;
  manualNote: string | null;
  onInstallClick: () => void;
}

export const PwaInstallTab: React.FC<PwaInstallTabProps> = ({
  language,
  manualNote,
  onInstallClick,
}) => (
  <>
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
            onClick={onInstallClick}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-950 transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Smartphone className="w-4 h-4" />
            <span>
              {language === 'ml'
                ? '⚡ നേരിട്ട് ഇൻസ്റ്റാൾ ചെയ്യുക (1-Click Install)'
                : '⚡ Direct 1-Click Install'}
            </span>
          </button>

          <a
            href="/api/download/launcher"
            download="AIZABIZ-Trading-Terminal.html"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-blue-950 transition active:scale-95 flex items-center justify-center gap-2 block text-center"
          >
            <Download className="w-4 h-4 inline" />
            <span>
              {language === 'ml'
                ? '📥 ആപ്പ് ലോഞ്ചർ ഡൗൺലോഡ് ചെയ്യുക (Instant Launcher File)'
                : '📥 Download Instant App Launcher'}
            </span>
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
          <span>
            {language === 'ml'
              ? 'മൊബൈലിൽ ചെയ്യേണ്ട 3 ലളിതമായ വഴികൾ:'
              : '3 Simple Mobile Installation Options:'}
          </span>
        </span>
        <div className="space-y-2 text-[11px] text-slate-200">
          <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">
              1
            </span>
            <div>
              <span className="font-bold text-emerald-400">
                {language === 'ml'
                  ? 'വഴി 1: ആപ്പ് ലോഞ്ചർ ഡൗൺലോഡ് ചെയ്യുക'
                  : 'Option 1: Download Instant Launcher'}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {language === 'ml'
                  ? 'മുകളിലെ നീല ബട്ടൺ ക്ലിക്ക് ചെയ്താൽ ഫയൽ തനിയെ ഡൗൺലോഡ് ആകും. അത് തുറന്നാൽ ഫുൾസ്ക്രീനിൽ ട്രേഡിംഗ് ആപ്പ് വരും!'
                  : 'Tap the blue button above to download launcher file and open full-screen directly!'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">
              2
            </span>
            <div>
              <span className="font-bold text-blue-400">
                {language === 'ml'
                  ? 'വഴി 2: Create Shortcut ക്ലിക്ക് ചെയ്യുക'
                  : 'Option 2: Tap Create Shortcut'}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {language === 'ml'
                  ? 'ക്രോമിലെ 3 കുത്തുകളിൽ (⋮) ക്ലിക്ക് ചെയ്ത് "Create shortcut" കൊടുത്ത് "Add" അടിക്കുക.'
                  : 'Tap Chrome 3-dots > "Create shortcut" > "Add" to add icon to home screen.'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-[#070a12] p-2.5 rounded-lg border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">
              3
            </span>
            <div>
              <span className="font-bold text-indigo-400">
                {language === 'ml' ? 'വഴി 3: APK ഫയൽ ഡൗൺലോഡ് ചെയ്യുക' : 'Option 3: Standalone APK'}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {language === 'ml'
                  ? 'മുകളിലെ ".APK ഫയൽ" ടാബിൽ ക്ലിക്ക് ചെയ്ത് നേരിട്ട് ആൻഡ്രോയിഡ് APK ഡൗൺലോഡ് ചെയ്യാം.'
                  : 'Switch to the .APK tab above to generate and download signed Android APK.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
