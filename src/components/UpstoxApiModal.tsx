import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wifi, 
  ShieldCheck, 
  Key, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Calendar, 
  Clock, 
  Copy, 
  Trash2, 
  Sparkles,
  ArrowRight,
  UserCheck,
  Zap
} from 'lucide-react';
import { UpstoxApiConfig, Language } from '../types';
import { translations } from '../translations';

interface UpstoxApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UpstoxApiConfig;
  onSaveConfig: (cfg: Partial<UpstoxApiConfig>) => Promise<void>;
  language: Language;
}

export const UpstoxApiModal: React.FC<UpstoxApiModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  language,
}) => {
  const t = translations[language];

  // Active Tab: 'DAILY_TOKEN' or 'API_KEYS'
  const [activeTab, setActiveTab] = useState<'DAILY_TOKEN' | 'API_KEYS'>('DAILY_TOKEN');

  const [apiKey, setApiKey] = useState(config.apiKey);
  const [apiSecret, setApiSecret] = useState(config.apiSecret);
  const [accessToken, setAccessToken] = useState(config.accessToken || '');
  const [redirectUri, setRedirectUri] = useState(config.redirectUri || `${window.location.origin}/api/upstox/callback`);
  
  // Auth Code for OAuth exchange
  const [authCode, setAuthCode] = useState('');
  const [exchangingCode, setExchangingCode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    setApiKey(config.apiKey);
    setApiSecret(config.apiSecret);
    setAccessToken(config.accessToken || '');
    if (config.redirectUri) setRedirectUri(config.redirectUri);
  }, [config, isOpen]);

  if (!isOpen) return null;

  // 1. Direct Daily Token Save & Verify
  const handleDailyTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken?.trim()) {
      setStatusMsg({
        type: 'error',
        text: language === 'ml' 
          ? 'ദയവായി ഇന്ന് ജനറേറ്റ് ചെയ്ത Upstox Access Token നൽകുക.' 
          : 'Please enter today\'s Upstox Access Token.',
      });
      return;
    }

    setValidating(true);
    setStatusMsg(null);

    try {
      // Validate and activate daily token via backend
      const res = await fetch('/api/upstox/daily-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken?.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        // Save to parent config state
        await onSaveConfig({
          accessToken: accessToken?.trim(),
          isConnected: true,
          userName: data.profile?.userName || 'Upstox Trader',
          userClientCode: data.profile?.userClientCode || 'UP_LIVE',
          tokenGeneratedAt: data.profile?.tokenGeneratedAt || new Date().toLocaleTimeString('en-IN'),
          tokenExpiresAt: data.profile?.tokenExpiresAt || 'Tomorrow 03:30 AM',
          todayTokenValid: true,
        });

        // Store in localStorage with today's date
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          localStorage.setItem('upstox_daily_token', accessToken?.trim());
          localStorage.setItem('upstox_token_date', todayStr);
        } catch (e) {}

        setStatusMsg({
          type: 'success',
          text: language === 'ml' 
            ? `✅ ടോക്കൺ പരിശോധിച്ചു! ${data.profile?.userName || 'ലൈവ് ട്രേഡർ'} അക്കൗണ്ട് വിജയകരമായി കണക്റ്റായി.` 
            : `✅ Token Verified! Connected live to ${data.profile?.userName || 'Upstox Account'}.`,
        });
      } else {
        throw new Error(data.error || 'Failed to verify token');
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Invalid or expired token. Please check and retry.',
      });
    } finally {
      setValidating(false);
    }
  };

  // 2. Full API Configuration Save
  const handleSaveAllConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      await onSaveConfig({
        apiKey,
        apiSecret,
        accessToken,
        redirectUri,
        isConnected: Boolean(accessToken),
      });
      setStatusMsg({
        type: 'success',
        text: language === 'ml' 
          ? 'Upstox ക്രമീകരണങ്ങൾ സേവ് ചെയ്തു!' 
          : 'Upstox API settings saved successfully!',
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to save Upstox configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. One-Click OAuth Exchange (Code -> Token)
  const handleExchangeCode = async () => {
    if (!authCode?.trim()) {
      setStatusMsg({
        type: 'error',
        text: language === 'ml' ? 'റീഡയറക്റ്റ് URL-ൽ നിന്നുള്ള Auth Code നൽകുക.' : 'Please enter the authorization code from redirected URL.',
      });
      return;
    }

    setExchangingCode(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/upstox/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: authCode?.trim(),
          apiKey,
          apiSecret,
          redirectUri,
        }),
      });

      const data = await res.json();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        await onSaveConfig({
          accessToken: data.accessToken,
          apiKey,
          apiSecret,
          redirectUri,
          isConnected: true,
          userName: data.user_name || 'Upstox Trader',
        });
        setAuthCode('');
        setStatusMsg({
          type: 'success',
          text: language === 'ml'
            ? '🎉 പുതിയ Access Token വിജയകരമായി ജനറേറ്റ് ചെയ്തു സേവ് ചെയ്തു!'
            : '🎉 Daily Access Token successfully generated and activated!',
        });
        setActiveTab('DAILY_TOKEN');
      } else {
        throw new Error(data.error || 'Failed to exchange authorization code');
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Token generation failed',
      });
    } finally {
      setExchangingCode(false);
    }
  };

  // 4. Open OAuth Login Dialog
  const handleOAuthLogin = () => {
    if (!apiKey) {
      setStatusMsg({
        type: 'error',
        text: language === 'ml' ? 'ആദ്യം Upstox API Key നൽകുക.' : 'Please enter your Upstox API Key first.',
      });
      return;
    }
    const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.open(loginUrl, '_blank');
  };

  // 5. Clear Daily Token
  const handleClearToken = async () => {
    try {
      await fetch('/api/upstox/clear-token', { method: 'POST' });
      setAccessToken('');
      localStorage.removeItem('upstox_daily_token');
      localStorage.removeItem('upstox_token_date');
      await onSaveConfig({ accessToken: '', isConnected: false });
      setStatusMsg({
        type: 'info',
        text: language === 'ml' 
          ? 'ഇന്നത്തെ ടോക്കൺ നീക്കം ചെയ്തു. പേപ്പർ ട്രേഡിംഗ് മോഡിലേക്ക് മാറി.' 
          : 'Daily token cleared. Switched to Paper Trading Mode.',
      });
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#090d16] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>{language === 'ml' ? 'പ്രതിദിന Upstox ടോക്കൺ മാനേജർ' : 'Upstox Daily Token Manager'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  v2 / v3
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ml' 
                  ? 'ദിവസേനയുള്ള Access Token നൽകി ലൈവ് ട്രേഡിംഗ് നടത്തുക' 
                  : 'Manual Daily Access Token Setup & Real-time Upstox Execution'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-2 bg-[#0a0f1b] border-b border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('DAILY_TOKEN')}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'DAILY_TOKEN'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-300" />
            <span>{language === 'ml' ? '☀️ ഡെയിലി ടോക്കൺ പേസ്റ്റ്' : '☀️ Daily Manual Token'}</span>
          </button>

          <button
            onClick={() => setActiveTab('API_KEYS')}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'API_KEYS'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-blue-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
            }`}
          >
            <Key className="w-4 h-4 text-indigo-300" />
            <span>{language === 'ml' ? '🔑 API Keys & Generator' : '🔑 API Keys & Generator'}</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Status Alert */}
          {statusMsg && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : statusMsg.type === 'error'
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-blue-950/40 border-blue-500/40 text-blue-300'
            }`}>
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : statusMsg.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span className="leading-snug">{statusMsg.text}</span>
            </div>
          )}

          {/* Connection & Today Validity Status Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${config.isConnected ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse' : 'bg-slate-600'}`} />
              <div>
                <span className="text-xs font-bold text-white block">
                  {config.isConnected 
                    ? (language === 'ml' ? 'Upstox ലൈവ് കണക്റ്റഡ്' : 'Upstox Live Connected')
                    : (language === 'ml' ? 'ടോക്കൺ നൽകിയിട്ടില്ല (പേപ്പർ മോഡ് സജീവം)' : 'No Token Set (Paper Trading Active)')}
                </span>
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>{config.userName || 'Paper Account'}</span>
                  {config.userClientCode && (
                    <span className="text-slate-500">({config.userClientCode})</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {config.isConnected && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>{language === 'ml' ? 'ഇന്ന് സാധുതയുണ്ട്' : 'Valid Today'}</span>
                </span>
              )}
              {config.isConnected && (
                <button
                  type="button"
                  onClick={handleClearToken}
                  title="Clear Token"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-900/30 text-slate-400 hover:text-rose-300 border border-slate-800 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: DAILY MANUAL TOKEN INPUT */}
          {activeTab === 'DAILY_TOKEN' && (
            <form onSubmit={handleDailyTokenSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>{language === 'ml' ? 'ഇന്നത്തെ Access Token (JWT)' : 'Today\'s Upstox Access Token'}</span>
                    <span className="text-[10px] text-amber-400 font-normal">*(Required Daily)*</span>
                  </label>
                  {accessToken && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {accessToken.length} chars
                    </span>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={language === 'ml' 
                    ? 'ദിവസവും രാവിലെ ജനറേറ്റ് ചെയ്ത Upstox Access Token ഇവിടെ പേസ്റ്റ് ചെയ്യുക (e.g. eyJhbGciOi...)' 
                    : 'Paste the generated daily JWT access token here (e.g. eyJhbGciOi...)'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition leading-relaxed resize-none"
                />

                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>
                    {language === 'ml' 
                      ? '💡 Upstox ടോക്കൺ 24 മണിക്കൂർ (അടുത്ത ദിവസം പുലർച്ചെ 03:30) വരെ സാധുവായിരിക്കും.' 
                      : '💡 Upstox tokens remain valid for 24 hours (until 03:30 AM next day).'}
                  </span>
                </p>
              </div>

              {/* Step by step manual generation guide for traders */}
              <div className="p-3.5 rounded-xl bg-[#080d1a] border border-slate-800 text-[11px] text-slate-200 space-y-2 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>{language === 'ml' ? 'ടോക്കൺ എങ്ങനെ മാനുവൽ ആയി നിർമ്മിക്കാം?' : 'How to generate Daily Token manually?'}</span>
                </div>
                <div className="space-y-1 text-slate-400 text-[11px]">
                  <p>
                    <b className="text-slate-200">രീതി 1:</b> മുകളിലെ <b>"API Keys & Generator"</b> ടാബിൽ പോയി 1-ക്ലിക്ക് വഴി ജനറേറ്റ് ചെയ്യാം.
                  </p>
                  <p>
                    <b className="text-slate-200">രീതി 2:</b> Python / Postman അല്ലെങ്കിൽ Upstox API v2 വഴി ഉണ്ടാക്കിയ <code className="text-emerald-300 font-mono">access_token</code> ഇവിടെ നേരിട്ട് പേസ്റ്റ് ചെയ്യാം.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
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
                  <span>
                    {language === 'ml' 
                      ? 'ടോക്കൺ പരിശോധിച്ച് ആക്റ്റീവ് ആക്കുക' 
                      : 'Verify & Activate for Today'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: API KEYS & 1-CLICK OAUTH CODE GENERATOR */}
          {activeTab === 'API_KEYS' && (
            <div className="space-y-4">
              
              {/* Upstox API Key */}
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  {t.apiKey} (Client ID)
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. 5xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Upstox API Secret */}
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  {t.apiSecret}
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Redirect URI */}
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  {t.redirectUri}
                </label>
                <input
                  type="text"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Automated 1-Click Code-to-Token Flow */}
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300 text-xs">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span>{language === 'ml' ? '1-ക്ലിക്ക് ടോക്കൺ ജനറേറ്റർ' : '1-Click Token Exchange'}</span>
                </div>

                {/* Step 1: Open Login Dialog */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-200">
                    {language === 'ml' ? '1. Upstox ലോഗിൻ വിൻഡോ തുറക്കുക:' : '1. Open Login Window:'}
                  </span>
                  <button
                    type="button"
                    onClick={handleOAuthLogin}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{language === 'ml' ? 'ലോഗിൻ ചെയ്യുക' : 'Open Login'}</span>
                  </button>
                </div>

                {/* Step 2: Paste Code */}
                <div>
                  <label className="text-[11px] text-slate-200 block mb-1">
                    {language === 'ml' ? '2. ബ്രൗസർ URL-ൽ നിന്നുള്ള "code=" ഇവിടെ പേസ്റ്റ് ചെയ്യുക:' : '2. Paste auth "code=" parameter from redirected URL:'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      placeholder="e.g. 9bxxx..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleExchangeCode}
                      disabled={exchangingCode || !authCode?.trim()}
                      className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                    >
                      {exchangingCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>{language === 'ml' ? 'ടോക്കൺ ആക്കുക' : 'Convert'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Save API Keys Button */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllConfig}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{t.saveAndConnect}</span>
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

