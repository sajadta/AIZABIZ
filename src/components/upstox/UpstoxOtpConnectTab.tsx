import React from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Settings, ShieldCheck, Zap } from 'lucide-react';
import { translations } from '../../translations';

import { useUpstoxApiModal } from './useUpstoxApiModal';
type Hook = ReturnType<typeof useUpstoxApiModal>;

interface UpstoxOtpConnectTabProps {
  apiKey: Hook['apiKey'];
  setApiKey: Hook['setApiKey'];
  apiSecret: Hook['apiSecret'];
  setApiSecret: Hook['setApiSecret'];
  savedMobile: Hook['savedMobile'];
  setSavedMobile: Hook['setSavedMobile'];
  otpInput: Hook['otpInput'];
  setOtpInput: Hook['setOtpInput'];
  otpRequested: Hook['otpRequested'];
  showKeySettings: Hook['showKeySettings'];
  setShowKeySettings: Hook['setShowKeySettings'];
  loading: Hook['loading'];
  handleForceSendSmsOtp: Hook['handleForceSendSmsOtp'];
  handleOtpOrAutoConnect: Hook['handleOtpOrAutoConnect'];
  onClose: Hook['onClose'];
  language: Hook['language'];
}

export const UpstoxOtpConnectTab: React.FC<UpstoxOtpConnectTabProps> = ({
  apiKey,
  setApiKey,
  apiSecret,
  setApiSecret,
  savedMobile,
  setSavedMobile,
  otpInput,
  setOtpInput,
  otpRequested,
  showKeySettings,
  setShowKeySettings,
  loading,
  handleForceSendSmsOtp,
  handleOtpOrAutoConnect,
  onClose,
  language,
}) => {
  const t = translations[language];
  return (
    <>
      <form onSubmit={handleOtpOrAutoConnect} className="space-y-4">
        {/* Single Clean OTP Input Box */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/30 to-slate-950 border border-emerald-500/40 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <label className="text-xs sm:text-sm font-extrabold text-emerald-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>
                {savedMobile.length === 10
                  ? language === 'ml'
                    ? '6-അക്ക SMS OTP ഇവിടെ നൽകുക'
                    : 'Enter 6-Digit SMS OTP Here'
                  : language === 'ml'
                    ? '10-അക്ക മൊബൈൽ നമ്പർ (ഒരിക്കൽ മാത്രം) അല്ലെങ്കിൽ 6-അക്ക OTP നൽകുക'
                    : 'Enter 10-Digit Mobile (Once) or 6-Digit OTP'}
              </span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {savedMobile.length === 10 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  📱 {savedMobile.slice(0, 2)}******{savedMobile.slice(-2)} Auto
                </span>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                PIN: Auto
              </span>
              {savedMobile.length === 10 && (
                <button
                  type="button"
                  onClick={handleForceSendSmsOtp}
                  disabled={loading}
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 transition flex items-center gap-1 active:scale-95"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>{language === 'ml' ? '📲 പുതിയ OTP അയക്കുക' : '📲 Send OTP'}</span>
                </button>
              )}
            </div>
          </div>

          <input
            type="tel"
            inputMode="numeric"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value)}
            placeholder={
              savedMobile.length === 10
                ? language === 'ml'
                  ? '6-അക്ക SMS OTP കോഡ് ഇവിടെ നൽകുക (e.g. 123456)'
                  : 'Enter 6-digit SMS OTP code here (e.g. 123456)'
                : language === 'ml'
                  ? 'ആദ്യ തവണ നിങ്ങളുടെ 10-അക്ക മൊബൈൽ നമ്പർ ഇവിടെ നൽകുക'
                  : 'First time only: enter your 10-digit Upstox mobile number'
            }
            className="w-full bg-slate-900/90 border-2 border-emerald-500/40 focus:border-emerald-400 rounded-xl px-4 py-3.5 text-center text-base sm:text-lg text-white font-mono font-black tracking-widest placeholder-slate-500 focus:outline-none transition shadow-inner"
          />

          <p className="text-[11px] text-slate-300 text-center leading-relaxed">
            {savedMobile.length === 10
              ? otpRequested
                ? language === 'ml'
                  ? '📲 ഫോണിൽ വന്ന 6-അക്ക SMS OTP മുകളിലെ ബോക്സിൽ നൽകി താഴെയുള്ള പച്ച ബട്ടൺ അമർത്തുക. PIN നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!'
                  : '📲 Enter the 6-digit SMS OTP received on your phone and tap the green button below. PIN and token generation are 100% automatic!'
                : language === 'ml'
                  ? '1️⃣ ആദ്യം മുകളിലെ ബോക്സ് ഒഴിച്ചിട്ട് താഴെയുള്ള പച്ച ബട്ടൺ അമർത്തുമ്പോൾ ഫോണിലേക്ക് SMS OTP വരും. 2️⃣ ആ 6-അക്ക OTP മുകളിൽ നൽകി വീണ്ടും ബട്ടൺ അമർത്തിയാൽ PIN തനിയെ എടുത്ത് കണക്റ്റ് ആകും!'
                  : '1️⃣ Tap the green button below with the box empty to receive SMS OTP. 2️⃣ Enter the 6-digit OTP and tap again — PIN and token connection happen automatically!'
              : language === 'ml'
                ? 'നിങ്ങളുടെ API Key, Secret, PIN എന്നിവ സേവ് ചെയ്തിട്ടുണ്ട്. ആദ്യ തവണ മാത്രം നിങ്ങളുടെ 10-അക്ക Upstox മൊബൈൽ നമ്പർ മുകളിൽ നൽകി പച്ച ബട്ടൺ അമർത്തുക — നമ്പർ സ്ഥിരമായി സേവ് ആവുകയും ഫോണിലേക്ക് ഉടൻ SMS OTP വരികയും ചെയ്യും!'
                : 'Your API Key, Secret & PIN are pre-saved. Enter your 10-digit Upstox mobile number once and tap the green button — it will save permanently and send your SMS OTP immediately!'}
          </p>
        </div>

        {/* Collapsible API Key / Secret / Mobile Settings (Hidden by default so screen stays clean) */}
        <div className="border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowKeySettings(!showKeySettings)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-200 transition"
          >
            <span className="flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {language === 'ml'
                  ? 'സേവ് ചെയ്ത വിവരങ്ങൾ (Mobile, PIN, API Key & Secret)'
                  : 'Saved Credentials (Mobile, PIN, API Key & Secret)'}
              </span>
            </span>
            {showKeySettings ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showKeySettings && (
            <div className="p-3.5 border-t border-slate-800/80 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {language === 'ml'
                    ? 'രജിസ്റ്റർ ചെയ്ത 10-അക്ക മൊബൈൽ നമ്പർ (Auto SMS OTP)'
                    : 'Registered 10-Digit Mobile Number'}
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={savedMobile}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D+/g, '').slice(0, 10);
                    setSavedMobile(val);
                    try {
                      localStorage.setItem('upstox_saved_mobile', val);
                    } catch {
                      /* ignored */
                    }
                  }}
                  placeholder="10-digit Upstox mobile number"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-emerald-300 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {t.apiKey} (Client ID)
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {t.apiSecret}
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Upstox API Secret"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-extrabold border border-emerald-500 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 active:scale-95"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>
              {otpInput.replace(/\D+/g, '').length === 6
                ? language === 'ml'
                  ? 'OTP വെരിഫൈ ചെയ്ത് കണക്റ്റ് ചെയ്യുക'
                  : 'Verify OTP & Auto Connect'
                : savedMobile.length === 10
                  ? language === 'ml'
                    ? 'ഫോണിലേക്ക് SMS OTP അയക്കുക (Auto)'
                    : 'Send SMS OTP & Connect'
                  : t.saveAndConnect}
            </span>
          </button>
        </div>
      </form>
    </>
  );
};
