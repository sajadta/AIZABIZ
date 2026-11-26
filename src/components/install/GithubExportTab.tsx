import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { Language } from '../../types';

interface GithubExportTabProps {
  language: Language;
}

export const GithubExportTab: React.FC<GithubExportTabProps> = ({ language }) => (
  <>
    <div className="space-y-3.5 text-xs text-slate-200">
      <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-1.5">
        <span className="font-extrabold text-purple-300 flex items-center gap-2 text-sm">
          <HelpCircle className="w-4 h-4 text-purple-400" />
          <span>
            {language === 'ml'
              ? 'ഈ പ്രോജക്ട് GitHub-ലേക്ക് ചേർക്കേണ്ടതുണ്ടോ?'
              : 'Should you push this project to GitHub?'}
          </span>
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
          {language === 'ml'
            ? '📌 GitHub-ലേക്ക് എക്സ്പോർട്ട് ചെയ്യുന്ന ലളിതമായ വഴി:'
            : '📌 Quick Export Steps:'}
        </span>
        <div className="space-y-2 text-[11px] text-slate-200">
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              1
            </span>
            <span>
              {language === 'ml'
                ? 'മുകളിൽ വലതുവശത്തുള്ള AI Studio **"Settings / Export"** മെനുവിൽ ക്ലിക്ക് ചെയ്ത് **"Export to GitHub"** അല്ലെങ്കിൽ **"Download ZIP"** നൽകുക.'
                : 'Use the AI Studio Settings menu to click "Export to GitHub" or "Download ZIP".'}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              2
            </span>
            <span>
              {language === 'ml'
                ? 'നിങ്ങളുടെ GitHub അക്കൗണ്ട് സെലക്ട് ചെയ്യുക. എല്ലാ കോഡുകളും നിമിഷങ്ങൾക്കകം GitHub Repo ആയി മാറും.'
                : 'Select your GitHub account to instantly push all files.'}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              3
            </span>
            <span>
              {language === 'ml'
                ? 'ശേഷം കമ്പ്യൂട്ടറിൽ `npm install` ചെയ്ത് `npm run dev` റൺ ചെയ്താൽ സ്വന്തമായി പ്രവർത്തിപ്പിക്കാം.'
                : 'Run `npm install` and `npm run dev` to host and trade anytime.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  </>
);
