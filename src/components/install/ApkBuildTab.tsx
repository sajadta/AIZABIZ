import React from 'react';
import { Download, ArrowRight } from 'lucide-react';
import type { Language } from '../../types';

interface ApkBuildTabProps {
  language: Language;
}

export const ApkBuildTab: React.FC<ApkBuildTabProps> = ({ language }) => (
  <>
    <div className="space-y-4 text-xs text-slate-200">
      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 space-y-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Download className="w-5 h-5" />
          </span>
          <div>
            <p className="font-black text-white text-sm">
              {language === 'ml'
                ? 'യഥാർത്ഥ ആൻഡ്രോയിഡ് .APK ഡൗൺലോഡ്'
                : 'Direct Android .APK Generator'}
            </p>
            <p className="text-[11px] text-indigo-200">
              {language === 'ml'
                ? 'മൈക്രോസോഫ്റ്റ് PWABuilder വഴി ഒരൊറ്റ ക്ലിക്കിൽ APK ഉണ്ടാക്കുക'
                : 'Official PWABuilder 1-click APK download generator'}
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
          <span>
            {language === 'ml'
              ? '📦 ഒരൊറ്റ ക്ലിക്കിൽ APK ഡൗൺലോഡ് ചെയ്യുക (Open APK Generator)'
              : '📦 Generate & Download .APK File'}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>

        <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
          <p className="font-bold text-emerald-400">
            {language === 'ml' ? 'APK ഡൗൺലോഡ് ചെയ്യുന്ന വിധം:' : 'How to download the APK:'}
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-slate-300">
            <li>
              {language === 'ml'
                ? 'മുകളിലെ പർപ്പിൾ ബട്ടണിൽ ക്ലിക്ക് ചെയ്യുക (PWABuilder പേജ് തുറക്കും).'
                : 'Click the purple button above to open PWABuilder.'}
            </li>
            <li>
              {language === 'ml'
                ? 'അവിടെ കാണുന്ന "Android" ബോക്സിൽ "Package For Store / APK" ക്ലിക്ക് ചെയ്യുക.'
                : 'Select the Android option.'}
            </li>
            <li>
              {language === 'ml'
                ? 'നിമിഷങ്ങൾക്കുള്ളിൽ നിങ്ങളുടെ ഫോണിലേക്ക് ഇൻസ്റ്റാൾ ചെയ്യാവുന്ന ഒറിജിനൽ .apk ഫയൽ ലഭിക്കും!'
                : 'Instantly download your ready-to-install Android APK file!'}
            </li>
          </ol>
        </div>
      </div>
    </div>
  </>
);
