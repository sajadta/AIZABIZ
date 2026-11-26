import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Language } from '../../types';

interface FixedIpFaqTabProps {
  language: Language;
}

export const FixedIpFaqTab: React.FC<FixedIpFaqTabProps> = ({ language }) => (
  <>
    <div className="space-y-3 text-xs text-slate-200">
      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
        <span className="font-extrabold text-amber-300 flex items-center gap-2 text-sm">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>
            {language === 'ml'
              ? 'Fixed IP ഇല്ലാത്തത് Upstox ഓർഡറുകളെ ബാധിക്കുമോ?'
              : 'Does lack of Static IP affect Upstox Orders?'}
          </span>
        </span>
        <p className="text-[11px] text-slate-200 leading-relaxed font-semibold">
          {language === 'ml'
            ? '❌ ഇല്ല! ഒരിക്കലും കുഴപ്പമില്ല. Upstox ഓർഡറുകൾ ബ്ലോക്ക് ചെയ്യില്ല.'
            : '❌ No! There is zero risk. Upstox will NOT block your orders.'}
        </p>
        <div className="space-y-1.5 text-[11px] text-slate-200 leading-relaxed">
          <p>
            • <b>OAuth 2.0 Token Authentication:</b> Upstox API v2 പ്രവർത്തിക്കുന്നത് IP Whitelist
            അടിസ്ഥാനമാക്കിയല്ല, മറിച്ച് ദിവസവും 2-Factor ലോഗിൻ വഴി ഉണ്ടാക്കുന്ന JWT Token
            അടിസ്ഥാനമാക്കിയാണ്.
          </p>
          <p>
            • <b>മൊബൈൽ നെറ്റ്‌വർക്കുകൾ:</b> ലക്ഷക്കണക്കിന് ട്രേഡർമാർ മൊബൈൽ ഇന്റർനെറ്റ് (Jio/Airtel)
            വഴിയാണ് ട്രേഡ് ചെയ്യുന്നത്. അതിൽ ഓരോ മിനിറ്റിലും IP മാറിക്കൊണ്ടിരിക്കും. ഇത് സാധാരണവും
            നിയമപരവുമാണ്.
          </p>
          <p>
            • <b>Rate Limit സുരക്ഷ:</b> ഈ ആപ്പിൽ സെക്കൻഡിൽ അനുവദിച്ചിട്ടുള്ള 3-5 റിക്വസ്റ്റുകൾ
            മാത്രമേ അയക്കൂ എന്നതിനാൽ API Throttling അല്ലെങ്കിൽ സ്പാം പ്രശ്നങ്ങൾ ഉണ്ടാകില്ല.
          </p>
        </div>
      </div>
    </div>
  </>
);
