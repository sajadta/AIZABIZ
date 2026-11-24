import React from 'react';
import type { BotLog, Language } from '../../types';

interface AppIpWhitelistNoticeProps {
  botLogs: BotLog[];
  dismissedIpWarning: boolean;
  ipCopiedNotice: boolean;
  language: Language;
  setDismissedIpWarning: (v: boolean) => void;
  setIpCopiedNotice: (v: boolean) => void;
  setIsApiModalOpen: (v: boolean) => void;
  serverSecondaryIp?: string;
}

export const AppIpWhitelistNotice: React.FC<AppIpWhitelistNoticeProps> = ({
  botLogs,
  dismissedIpWarning,
  ipCopiedNotice,
  language,
  setDismissedIpWarning,
  setIpCopiedNotice,
  setIsApiModalOpen,
  serverSecondaryIp,
}) => {
  const ipListStr = Array.from(
    new Set(['34.180.11.27', '34.34.254.178', ...(serverSecondaryIp ? [serverSecondaryIp] : [])]),
  ).join(', ');
  return (
  <>
    {/* Upstox Static IP Whitelist Notice (Only if an old IP rejection log is present) */}
    {!dismissedIpWarning &&
      botLogs.some(
        (l) =>
          l.message &&
          (l.message.includes('static IP restrictions') || l.message.includes('static IP restriction')) &&
          Date.now() - Number(l.id || 0) < 15 * 60 * 1000,
      ) && (
        <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/50 px-3.5 py-2 flex items-center justify-between gap-3 text-xs flex-wrap shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-amber-400 font-black text-sm shrink-0">🛡️</span>
            <div className="flex flex-col">
              <span className="text-amber-300 font-extrabold text-[12px]">
                {language === 'ml'
                  ? 'Upstox SEBI Static IP വെരിഫിക്കേഷൻ'
                  : 'Upstox SEBI Static IP Whitelist Required'}
              </span>
              <span className="text-slate-300 text-[11px]">
                {language === 'ml'
                  ? `Upstox Developer Console-ൽ ${ipListStr} എന്നീ IP-കൾ Whitelist ചെയ്യുക.`
                  : `Please ensure IPs (${ipListStr}) are saved in Upstox Developer Console.`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(ipListStr);
                setIpCopiedNotice(true);
                setTimeout(() => setIpCopiedNotice(false), 3000);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3 py-1 rounded text-[11px] transition shadow flex items-center gap-1 active:scale-95"
            >
              📋{' '}
              {ipCopiedNotice
                ? language === 'ml'
                  ? '✓ IP-കൾ കോപ്പി ചെയ്തു!'
                  : '✓ All IPs Copied!'
                : language === 'ml'
                  ? 'IP-കൾ കോപ്പി ചെയ്യുക'
                  : 'Copy All IPs'}
            </button>
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1 rounded text-[11px] border border-slate-700 transition flex items-center gap-1 active:scale-95"
            >
              ⚙️ {language === 'ml' ? 'സെറ്റിംഗ്സ്' : 'Settings'}
            </button>
            <button
              type="button"
              onClick={() => setDismissedIpWarning(true)}
              className="px-2 py-1 rounded bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white text-[11px] font-bold border border-white/20 transition active:scale-95"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
  </>
  );
};
