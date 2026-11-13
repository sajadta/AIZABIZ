import React from 'react';
import { Clock, RefreshCw, Settings, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { translations } from '../../translations';

import { useUpstoxApiModal } from './useUpstoxApiModal';
type Hook = ReturnType<typeof useUpstoxApiModal>;

interface UpstoxConnectionCardProps {
  checkingStatus: Hook['checkingStatus'];
  proxyUrlInput: Hook['proxyUrlInput'];
  setProxyUrlInput: Hook['setProxyUrlInput'];
  isFixedProxyActive: Hook['isFixedProxyActive'];
  isTestingProxy: Hook['isTestingProxy'];
  showProxyConfig: Hook['showProxyConfig'];
  setShowProxyConfig: Hook['setShowProxyConfig'];
  liveHoldingsCount: Hook['liveHoldingsCount'];
  setStatusMsg: Hook['setStatusMsg'];
  handleSaveProxy: Hook['handleSaveProxy'];
  handleCheckLiveConnection: Hook['handleCheckLiveConnection'];
  handleClearToken: Hook['handleClearToken'];
  config: Hook['config'];
  language: Hook['language'];
}

export const UpstoxConnectionCard: React.FC<UpstoxConnectionCardProps> = ({
  checkingStatus,
  proxyUrlInput,
  setProxyUrlInput,
  isFixedProxyActive,
  isTestingProxy,
  showProxyConfig,
  setShowProxyConfig,
  liveHoldingsCount,
  setStatusMsg,
  handleSaveProxy,
  handleCheckLiveConnection,
  handleClearToken,
  config,
  language,
}) => {
  const t = translations[language];
  return (
    <>
      <div
        className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
          config.isConnected
            ? 'bg-emerald-950/20 border-emerald-500/40'
            : 'bg-slate-950 border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                config.isConnected
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <div>
              <span
                className={`text-xs font-extrabold block ${
                  config.isConnected ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {config.isConnected
                  ? language === 'ml'
                    ? '🟢 Upstox ലൈവ് കണക്റ്റഡ് (ടോക്കൺ സജീവമാണ്)'
                    : '🟢 Upstox Live Connected (Token Active)'
                  : language === 'ml'
                    ? '🔴 ടോക്കൺ ആക്റ്റീവ് അല്ല (പേപ്പർ മോഡ് സജീവം)'
                    : '🔴 No Active Token (Paper Mode Active)'}
              </span>
              <span className="text-[11px] font-mono text-slate-300 flex items-center gap-1.5 mt-0.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{config.userName || ''}</span>
                <span className="text-slate-400">({config.userClientCode || ''})</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCheckLiveConnection}
              disabled={checkingStatus}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span>{language === 'ml' ? 'കണക്ഷൻ പരിശോധിക്കുക' : 'Test Status'}</span>
            </button>

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

        {/* Live Account Summary Row when connected */}
        {config.isConnected && (
          <div className="space-y-2 pt-2 border-t border-emerald-500/20 text-[11px] font-mono">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'ലഭ്യമായ ഫണ്ട്' : 'Available Margin'}
                </span>
                <span className="text-emerald-400 font-bold">
                  ₹
                  {Number(config.availableMargin || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'ഉപയോഗിച്ച മാർജിൻ' : 'Used Margin'}
                </span>
                <span className="text-amber-400 font-bold">
                  ₹
                  {Number(config.usedMargin || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'ഹോൾഡിങ്‌സ്' : 'Holdings'}
                </span>
                <span className="text-cyan-400 font-bold">
                  {liveHoldingsCount !== null ? `${liveHoldingsCount} Stocks` : 'Synced'}
                </span>
              </div>
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'ടോക്കൺ സമയം' : 'Token Time'}
                </span>
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{config.tokenGeneratedAt || 'ഇന്ന് തത്സമയം'}</span>
                </span>
              </div>
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'ആകെ അക്കൗണ്ട് ബാലൻസ്' : 'Total Account Value'}
                </span>
                <span className="text-cyan-400 font-bold">
                  ₹
                  {Number(config.totalBalance || config.availableMargin || 0).toLocaleString(
                    'en-IN',
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                  )}
                </span>
              </div>
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'ഇന്ന് ചേർത്ത തുക' : 'Payin (Today)'}
                </span>
                <span className="text-emerald-400 font-bold">
                  ₹
                  {Number(config.payin || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'പിൻവലിച്ചത്' : 'Payout (Today)'}
                </span>
                <span className="text-rose-400 font-bold">
                  ₹
                  {Number(config.payout || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block font-sans">
                  {language === 'ml' ? 'മാർക്കറ്റ് സമയം' : 'Market Hours'}
                </span>
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>09:15 - 15:30</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Upstox SEBI Static IP Whitelist Card — Always Visible (Both Connected & Disconnected) */}
        <div className="bg-slate-950/90 p-3 rounded-xl border border-emerald-500/40 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div>
                <span className="text-xs text-emerald-300 font-extrabold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{isFixedProxyActive ? t.proxyActive : t.whitelistNotice}</span>
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  {language === 'ml'
                    ? 'Upstox Developer Console-ൽ ഈ IP-കൾ നൽകുക:'
                    : 'Configure these IPs in Upstox Developer Dashboard:'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const allThree = '8.234.113.241, 34.34.254.178, 34.34.244.48';
                  navigator.clipboard?.writeText(allThree);
                  setStatusMsg({
                    type: 'success',
                    text:
                      language === 'ml'
                        ? `📋 3 IP-കളും കോപ്പി ചെയ്തു (${allThree})! Upstox Developer Console-ൽ നൽകുക.`
                        : `📋 Copied All 3 IPs (${allThree})! Set in Upstox Developer Console.`,
                  });
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
              >
                <span>📋</span>
                <span>{language === 'ml' ? '3 IP-കളും കോപ്പി ചെയ്യുക' : 'Copy All 3 IPs'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowProxyConfig((prev) => !prev)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition"
              >
                {showProxyConfig ? '✕ Close' : '⚙️ Custom Proxy'}
              </button>
            </div>
          </div>

          {/* Primary, Secondary & Container IP 3-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                isFixedProxyActive
                  ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-400 block font-bold tracking-wider">
                    1. PRIMARY STATIC IP
                  </span>
                  {isFixedProxyActive ? (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      🟢 LIVE ROUTE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      🟡 TIMEOUT
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-black text-emerald-400">8.234.113.241</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('8.234.113.241');
                  setStatusMsg({
                    type: 'success',
                    text:
                      language === 'ml'
                        ? `📋 Primary IP (8.234.113.241) കോപ്പി ചെയ്തു!`
                        : `📋 Copied Primary IP (8.234.113.241)!`,
                  });
                }}
                className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/50 text-[10px] font-bold transition active:scale-95"
              >
                {language === 'ml' ? 'കോപ്പി' : 'Copy'}
              </button>
            </div>

            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                !isFixedProxyActive
                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-amber-400 block font-bold tracking-wider">
                    2. CONTAINER IP (AI STUDIO)
                  </span>
                  {!isFixedProxyActive ? (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                      🟢 LIVE ROUTE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      ⚪ BACKUP
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-black text-amber-300">34.34.244.48</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('34.34.244.48');
                  setStatusMsg({
                    type: 'success',
                    text:
                      language === 'ml'
                        ? `📋 Current IP (34.34.244.48) കോപ്പി ചെയ്തു! ഇത് Upstox-ൽ Whitelist ചെയ്യുക.`
                        : `📋 Copied Current IP (34.34.244.48)! Whitelist this in Upstox if not using a proxy.`,
                  });
                }}
                className="px-2 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/50 text-[10px] font-bold transition active:scale-95"
              >
                {language === 'ml' ? 'കോപ്പി' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Troubleshooting hint when proxy VM is timed out */}
          {!isFixedProxyActive && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5 text-[10px] space-y-1.5">
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <span>💡 പ്രോക്സി വി.എം കണക്റ്റ് ചെയ്യാൻ ഈ കമാൻഡ് VM-ൽ റൺ ചെയ്യുക:</span>
                <button
                  type="button"
                  onClick={() => {
                    const cmd =
                      "sudo sed -i 's/^Listen /#Listen /' /etc/tinyproxy/tinyproxy.conf && sudo sed -i 's/^Allow /#Allow /' /etc/tinyproxy/tinyproxy.conf && sudo systemctl restart tinyproxy";
                    navigator.clipboard?.writeText(cmd);
                    setStatusMsg({
                      type: 'success',
                      text: '📋 കമാൻഡ് കോപ്പി ചെയ്തു! ഗൂഗിൾ ക്ലൗഡ് SSH ടർമിനലിൽ പേസ്റ്റ് ചെയ്യുക.',
                    });
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[9px] font-bold"
                >
                  കോപ്പി കമാൻഡ്
                </button>
              </div>
              <p className="text-slate-400 font-mono text-[9px] break-all bg-black/40 p-1.5 rounded border border-slate-800">
                sudo sed -i &apos;s/^Listen /#Listen /&apos; /etc/tinyproxy/tinyproxy.conf
                &amp;&amp; sudo sed -i &apos;s/^Allow /#Allow /&apos; /etc/tinyproxy/tinyproxy.conf
                &amp;&amp; sudo systemctl restart tinyproxy
              </p>
              <p className="text-slate-400 text-[9px]">
                (നിലവിൽ തടസ്സമില്ലാതെ ട്രേഡിങ് നടക്കാൻ കണ്ടെയ്‌നർ IP: <b>34.34.244.48</b> തനിയെ
                സജീവമാക്കിയിട്ടുണ്ട്).
              </p>
            </div>
          )}

          {/* Manual IP / Proxy Override Input (User Request) */}
          <div className="pt-2 border-t border-slate-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight flex items-center gap-1.5">
                <Settings className="w-3 h-3 text-slate-400" />
                {language === 'ml'
                  ? 'മാനുവൽ IP / പ്രോക്സി ക്രമീകരണം'
                  : 'Manual IP / Proxy Override'}
              </span>
              {isFixedProxyActive && (
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={proxyUrlInput}
                  onChange={(e) => setProxyUrlInput(e.target.value)}
                  placeholder="http://user:pass@host:port (Optional)"
                  className="w-full bg-black/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:border-emerald-500 outline-none transition"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSaveProxy()}
                disabled={isTestingProxy}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 shadow-lg shadow-emerald-950/20 disabled:opacity-50"
              >
                {isTestingProxy ? 'Testing...' : language === 'ml' ? 'സേവ്' : 'Save'}
              </button>
              {proxyUrlInput && (
                <button
                  type="button"
                  onClick={() => handleSaveProxy(true)}
                  className="p-2 rounded-lg bg-rose-900/20 text-rose-400 hover:bg-rose-900/40 border border-rose-800/30 transition"
                  title="Remove Proxy"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-500 italic leading-relaxed">
              {language === 'ml'
                ? 'ശ്രദ്ധിക്കുക: നിങ്ങൾ പുതിയ IP നൽകുകയാണെങ്കിൽ അത് Upstox ഡാഷ്ബോർഡിലും വൈറ്റ്ലിസ്റ്റ് ചെയ്യേണ്ടതുണ്ട്.'
                : 'Note: If you override the IP, ensure the new outbound IP is whitelisted in Upstox Developer Console.'}
            </p>
          </div>

          {/* Optional Custom Dedicated Proxy Drawer */}
          {showProxyConfig && (
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2.5 animate-in fade-in duration-150">
              <div className="text-[11px] text-slate-300 leading-relaxed font-sans bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 block">
                  {language === 'ml'
                    ? '📌 IP ഒരിക്കലും മാറാതിരിക്കാനുള്ള സ്ഥിരമായ പരിഹാരം:'
                    : '📌 Permanent Fixed IP Solution:'}
                </span>
                <span className="block text-slate-400 text-[10px]">
                  {language === 'ml'
                    ? '1. webshare.io എന്ന സൈറ്റിൽ സൗജന്യമായി സൈൻ-അപ്പ് ചെയ്യുക (ക്രെഡിറ്റ് കാർഡ് ആവശ്യമില്ല). അവർ നൽകുന്ന 10 സൗജന്യ ഫിക്സഡ് പ്രോക്സികളിൽ ഒരെണ്ണം (http://username:password@ip:port) ഇവിടെ നൽകി കണക്റ്റ് ചെയ്യുക.'
                    : '1. Sign up for free at webshare.io (no card needed). They give 10 free permanent static proxies. Paste the proxy URL (http://username:password@ip:port) here and click Connect.'}
                </span>
                <span className="block text-slate-400 text-[10px]">
                  {language === 'ml'
                    ? '2. ആ പ്രോക്സിയിലെ IP ഒരിക്കലും മാറില്ല! ആ ഒരൊറ്റ IP നേരെ Upstox Developer Console-ൽ നൽകിയാൽ 100% സ്ഥിരമായി നിലനിൽക്കും.'
                    : '2. That proxy IP never changes. Put that exact IP in Upstox Developer Console for a permanent 100% static setup.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={proxyUrlInput}
                  onChange={(e) => setProxyUrlInput(e.target.value)}
                  placeholder="http://username:password@proxy-ip:port"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={isTestingProxy}
                  onClick={() => handleSaveProxy(false)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold font-sans transition shrink-0"
                >
                  {isTestingProxy ? 'Testing...' : language === 'ml' ? 'കണക്റ്റ്' : 'Connect'}
                </button>
                {proxyUrlInput && (
                  <button
                    type="button"
                    disabled={isTestingProxy}
                    onClick={() => handleSaveProxy(true)}
                    className="px-2 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg text-[10px] font-bold border border-rose-800/40 transition shrink-0"
                    title="Remove Proxy"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
