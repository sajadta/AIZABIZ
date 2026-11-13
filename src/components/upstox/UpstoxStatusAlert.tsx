import React from 'react';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

import { useUpstoxApiModal } from './useUpstoxApiModal';
type Hook = ReturnType<typeof useUpstoxApiModal>;

interface UpstoxStatusAlertProps {
  apiKey: Hook['apiKey'];
  redirectUri: Hook['redirectUri'];
  statusMsg: Hook['statusMsg'];
  getFallbackRedirectUri: Hook['getFallbackRedirectUri'];
  DEFAULT_API_KEY: Hook['DEFAULT_API_KEY'];
  language: Hook['language'];
}

export const UpstoxStatusAlert: React.FC<UpstoxStatusAlertProps> = ({
  apiKey,
  redirectUri,
  statusMsg,
  getFallbackRedirectUri,
  DEFAULT_API_KEY,
  language,
}) => {
  return (
    <>
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border flex flex-col gap-2 text-xs font-semibold animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : statusMsg.type === 'error'
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-blue-950/40 border-blue-500/40 text-blue-300'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{statusMsg.text}</span>
          </div>
          {statusMsg.type === 'error' && (
            <div className="pt-1 flex items-center justify-end">
              <a
                href={`https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(
                  (apiKey || DEFAULT_API_KEY).trim(),
                )}&redirect_uri=${encodeURIComponent((redirectUri || getFallbackRedirectUri()).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold transition shadow"
              >
                {language === 'ml'
                  ? '🔗 നേരിട്ട് Upstox ലോഗിൻ തുറക്കുക (100% ഉറപ്പായ വഴി)'
                  : '🔗 Open Direct Upstox Login (Guaranteed)'}
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
};
