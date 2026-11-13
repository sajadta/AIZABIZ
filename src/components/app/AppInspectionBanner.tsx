import React from 'react';
import type { BotLog, Language } from '../../types';

interface AppInspectionBannerProps {
  botLogs: BotLog[];
  language: Language;
}

export const AppInspectionBanner: React.FC<AppInspectionBannerProps> = ({ botLogs, language }) => (
  <>
    {/* 2.1 LIVE ALGO INSPECTION BANNER (Texting/Inspection Status - Desktop Only to save vertical mobile space) */}
    <div className="hidden md:flex bg-slate-950/90 border-b border-slate-800/80 px-3 py-1 items-center justify-between gap-2 overflow-hidden text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-2 w-2 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-black uppercase text-emerald-400 font-mono tracking-wider shrink-0">
          {language === 'ml' ? 'അൽഗോരിതം പരിശോധന:' : 'ALGO ENGINE:'}
        </span>
        <span className="text-slate-300 text-[11px] font-semibold truncate animate-fade-in">
          {botLogs.length > 0 && botLogs[0]?.message
            ? botLogs[0].message
            : language === 'ml'
              ? 'ഇൻസ്റ്റിറ്റ്യൂഷണൽ ഡാറ്റയും ഓപ്ഷൻ ഗ്രീക്സും തത്സമയം നിരീക്ഷിച്ച് കൊണ്ടിരിക്കുന്നു...'
              : 'Continuously scanning institutional order flow, Option Greeks, and FVG levels...'}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-slate-400">
        <span className="text-emerald-400 font-bold">24x7 Cloud Active</span>
        <span>•</span>
        <span>Zero Net Cut Drift</span>
      </div>
    </div>
  </>
);
