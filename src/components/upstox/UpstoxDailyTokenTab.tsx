import React from 'react';
import { ExternalLink, RefreshCw, ShieldCheck, Sparkles, Smartphone } from 'lucide-react';
import { translations } from '../../translations';

import { useUpstoxApiModal } from './useUpstoxApiModal';
type Hook = ReturnType<typeof useUpstoxApiModal>;

interface UpstoxDailyTokenTabProps {
  apiKey: Hook['apiKey'];
  accessToken: Hook['accessToken'];
  setAccessToken: Hook['setAccessToken'];
  redirectUri: Hook['redirectUri'];
  setRedirectUri: Hook['setRedirectUri'];
  validating: Hook['validating'];
  v3Loading: Hook['v3Loading'];
  handleDailyTokenSubmit: Hook['handleDailyTokenSubmit'];
  handleRequestTokenV3: Hook['handleRequestTokenV3'];
  handleSaveRedirectUri: Hook['handleSaveRedirectUri'];
  getFallbackRedirectUri: Hook['getFallbackRedirectUri'];
  DEFAULT_API_KEY: Hook['DEFAULT_API_KEY'];
  onClose: Hook['onClose'];
  language: Hook['language'];
}

export const UpstoxDailyTokenTab: React.FC<UpstoxDailyTokenTabProps> = ({
  apiKey,
  accessToken,
  setAccessToken,
  redirectUri,
  setRedirectUri,
  validating,
  v3Loading,
  handleDailyTokenSubmit,
  handleRequestTokenV3,
  handleSaveRedirectUri,
  getFallbackRedirectUri,
  DEFAULT_API_KEY,
  onClose,
  language,
}) => {
  const t = translations[language];
  const effectiveRedirectUri = (redirectUri || getFallbackRedirectUri()).trim();
  return (
    <>
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/40 space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-black text-indigo-300">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              {language === 'ml'
                ? '1-ക്ലിക്ക് ഓട്ടോമാറ്റിക് Upstox ലോഗിൻ (ഏറ്റവും എളുപ്പവഴി)'
                : '1-Click Automatic Upstox Login'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            {language === 'ml'
              ? 'OTP കാത്തുനിൽക്കേണ്ടതില്ല! താഴെയുള്ള ബട്ടൺ അമർത്തി Upstox ഫിംഗർപ്രിന്റ്/ആപ്പ് വഴി ഒരൊറ്റ ക്ലിക്കിൽ ലൈവ് ആവുക:'
              : 'No need to wait for SMS OTP! Connect instantly via Upstox fingerprint or App:'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href={`https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(
                (apiKey || DEFAULT_API_KEY).trim(),
              )}&redirect_uri=${encodeURIComponent(effectiveRedirectUri)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs font-black transition shadow-lg flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>{language === 'ml' ? '1-ക്ലിക്ക് OAuth ലോഗിൻ' : '1-Click OAuth Login'}</span>
            </a>

            <button
              type="button"
              onClick={handleRequestTokenV3}
              disabled={v3Loading}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-black transition shadow-lg flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation disabled:opacity-60"
            >
              {v3Loading ? (
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Smartphone className="w-4 h-4 shrink-0" />
              )}
              <span>{language === 'ml' ? 'V3 ആപ്പ് Approve' : 'Upstox V3 Approve'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-indigo-500/20 text-left space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">
              {language === 'ml'
                ? 'Redirect URI (Upstox Developer Console-ൽ ഇതുതന്നെ നൽകുക):'
                : 'Redirect URI (Must match Upstox Developer Console):'}
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] font-mono text-cyan-300 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(effectiveRedirectUri)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 shrink-0"
              >
                {language === 'ml' ? 'കോപ്പി' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleSaveRedirectUri}
                className="px-2 py-1 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white text-[10px] font-bold shrink-0"
              >
                {language === 'ml' ? 'സേവ്' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleDailyTokenSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-200">
                {language === 'ml' ? 'ഇന്നത്തെ Access Token (JWT)' : "Today's Upstox Access Token"}
              </label>
              {accessToken && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  {accessToken.length} chars
                </span>
              )}
            </div>

            <textarea
              rows={4}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={
                language === 'ml'
                  ? 'Upstox Access Token (e.g. eyJhbGciOi...) ഇവിടെ പേസ്റ്റ് ചെയ്യുക'
                  : 'Paste daily JWT access token here (e.g. eyJhbGciOi...)'
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition leading-relaxed resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition"
            >
              {t.cancel}
            </button>

            <button
              type="submit"
              disabled={validating || !accessToken?.trim()}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-950 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {validating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{language === 'ml' ? 'ടോക്കൺ ആക്റ്റീവ് ആക്കുക' : 'Verify & Activate'}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
