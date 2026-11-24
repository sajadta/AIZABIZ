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
  containerIp: Hook['containerIp'];
  proxyError: Hook['proxyError'];
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
  containerIp,
  proxyError,
  liveHoldingsCount,
  setStatusMsg,
  handleSaveProxy,
  handleCheckLiveConnection,
  handleClearToken,
  config,
  language,
}) => {
  const t = translations[language];
  const liveContainerIp =
    (containerIp && containerIp !== 'Detecting...' && containerIp !== '34.180.11.27' ? containerIp : '') ||
    (config.serverSecondaryIp && config.serverSecondaryIp !== '34.180.11.27' ? config.serverSecondaryIp : '') ||
    'Detecting...';
  const copyIpList = Array.from(
    new Set([
      '34.180.11.27',
      '34.34.254.178',
      ...(liveContainerIp && liveContainerIp !== 'Detecting...' ? [liveContainerIp] : []),
    ]),
  ).join(', ');
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
                  {Number(config.usedMargin || 0) < 0
                    ? language === 'ml'
                      ? 'ഹോൾഡിങ് വിറ്റ ക്രെഡിറ്റ്'
                      : 'Holding Sell Credit'
                    : language === 'ml'
                      ? 'ഉപയോഗിച്ച മാർജിൻ'
                      : 'Used Margin'}
                </span>
                <span className={`${Number(config.usedMargin || 0) < 0 ? 'text-cyan-300' : 'text-amber-400'} font-bold`}>
                  ₹
                  {Math.abs(Number(config.usedMargin || 0)).toLocaleString('en-IN', {
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
                  navigator.clipboard?.writeText(copyIpList);
                  setStatusMsg({
                    type: 'success',
                    text:
                      language === 'ml'
                        ? `📋 IP-കൾ കോപ്പി ചെയ്തു (${copyIpList})! Upstox Developer Console-ൽ നൽകുക.`
                        : `📋 Copied All IPs (${copyIpList})! Set in Upstox Developer Console.`,
                  });
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
              >
                <span>📋</span>
                <span>{language === 'ml' ? 'IP-കൾ കോപ്പി ചെയ്യുക' : 'Copy All IPs'}</span>
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
                    1. SOCKS5 STATIC IP
                  </span>
                  {isFixedProxyActive ? (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      🟢 LIVE ROUTE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      {language === 'ml' ? '⚪ സ്റ്റാൻഡ്‌ബൈ' : '⚪ STANDBY'}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-black text-emerald-400">34.180.11.27</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('34.180.11.27');
                  setStatusMsg({
                    type: 'success',
                    text:
                      language === 'ml'
                        ? `📋 SOCKS5 IP (34.180.11.27) കോപ്പി ചെയ്തു!`
                        : `📋 Copied SOCKS5 IP (34.180.11.27)!`,
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
                  <span className="text-[9px] text-emerald-400 block font-bold tracking-wider">
                    2. DIRECT APP ROUTE (AI STUDIO)
                  </span>
                  {!isFixedProxyActive ? (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      {language === 'ml' ? '🟢 സജീവം (LIVE)' : '🟢 LIVE ROUTE'}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      ⚪ BACKUP
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-black text-amber-300">{liveContainerIp}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(liveContainerIp);
                  setStatusMsg({
                    type: 'success',
                    text:
                      language === 'ml'
                        ? `📋 Current IP (${liveContainerIp}) കോപ്പി ചെയ്തു! ഇത് Upstox-ൽ Whitelist ചെയ്യുക.`
                        : `📋 Copied Current IP (${liveContainerIp})! Whitelist this in Upstox if not using a proxy.`,
                  });
                }}
                className="px-2 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/50 text-[10px] font-bold transition active:scale-95"
              >
                {language === 'ml' ? 'കോപ്പി' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Reassuring Live Status or Offline Troubleshooting */}
          {config.isConnected || isFixedProxyActive ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2.5 text-[10px] space-y-1.5">
              <div className="flex items-center justify-between flex-wrap text-emerald-300 font-bold gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  {isFixedProxyActive ? (
                    <span>
                      {language === 'ml'
                        ? '🟢 SOCKS5 പ്രോക്സി റൂട്ട് സജീവം (Static IP Active):'
                        : '🟢 SOCKS5 Static Proxy Route Active:'}
                    </span>
                  ) : (
                    <span>
                      {language === 'ml'
                        ? '🟢 നേരിട്ടുള്ള Upstox API റൂട്ട് സജീവം (Direct Upstox API Active):'
                        : '🟢 Direct Upstox API Route Active:'}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-mono text-emerald-300 px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-500/30">
                  IP: {isFixedProxyActive ? '34.180.11.27' : liveContainerIp}
                </span>
              </div>
              <p className="text-slate-300 text-[10px] leading-relaxed">
                {isFixedProxyActive
                  ? language === 'ml'
                    ? 'SOCKS5 പ്രോക്സി (34.180.11.27:1080) തത്സമയം കണക്റ്റഡ് ആണ്. Upstox ഓർഡറുകളും API കോളുകളും ഈ ഫിക്സഡ് IP വഴി സുരക്ഷിതമായി റൂട്ട് ചെയ്യപ്പെടുന്നു.'
                    : 'SOCKS5 proxy (34.180.11.27:1080) is actively verified. All Upstox orders and API requests route securely through this static IP.'
                  : language === 'ml'
                    ? 'പ്രോക്സി സ്റ്റാൻഡ്‌ബൈ മോഡിലാണ്. Upstox ലൈവ് എഞ്ചിൻ നേരിട്ട് 100% സുരക്ഷിതമായി പ്രവർത്തിക്കുന്നു.'
                    : 'Proxy is in standby. Upstox live engine communicates directly.'}
              </p>
            </div>
          ) : (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5 text-[10px] space-y-1.5">
              <div className="flex items-center justify-between flex-wrap text-amber-300 font-bold gap-2">
                <span>
                  {language === 'ml'
                    ? '💡 SOCKS5 പ്രോക്സി ലഭ്യമല്ല — നേരിട്ടുള്ള IPv4 റൂട്ട് സജീവം:'
                    : '💡 SOCKS5 Proxy unreachable — direct IPv4 fallback active:'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isTestingProxy}
                    onClick={() => handleSaveProxy(false)}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-[9px] font-bold"
                  >
                    {isTestingProxy
                      ? 'Testing...'
                      : language === 'ml'
                        ? 'വീണ്ടും ടെസ്റ്റ് ചെയ്യുക'
                        : 'Retry Proxy'}
                  </button>
                  {proxyUrlInput && (
                    <button
                      type="button"
                      disabled={isTestingProxy}
                      onClick={() => handleSaveProxy(true)}
                      className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-[9px] font-bold"
                    >
                      {language === 'ml' ? 'Direct IP ഉപയോഗിക്കുക' : 'Use Direct IP'}
                    </button>
                  )}
                </div>
              </div>
              {proxyError && (
                <p className="text-amber-200/80 font-mono text-[9px]">Status: {proxyError}</p>
              )}
              <p className="text-slate-400 text-[9px]">
                {language === 'ml'
                  ? 'നിലവിൽ തടസ്സമില്ലാതെ ട്രേഡിങ് നടക്കാൻ കണ്ടെയ്‌നർ IP: '
                  : 'Direct outbound container IP (whitelist in Upstox if bypassing proxy): '}
                <b className="text-amber-300 font-mono">{liveContainerIp}</b>
              </p>
            </div>
          )}

          {/* Optional Custom Dedicated Proxy Drawer */}
          {showProxyConfig && (
            <div className="pt-2.5 border-t border-slate-800 flex flex-col gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight flex items-center gap-1.5">
                  <Settings className="w-3 h-3 text-slate-400" />
                  {language === 'ml'
                    ? 'SOCKS5 / HTTP പ്രോക്സി ക്രമീകരണം'
                    : 'SOCKS5 / HTTP Proxy Configuration'}
                </span>
                {isFixedProxyActive && (
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                    SOCKS5 ACTIVE
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={proxyUrlInput}
                    onChange={(e) => setProxyUrlInput(e.target.value)}
                    placeholder="socks5://user:pass@host:port (Optional)"
                    className="w-full bg-black/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveProxy(false)}
                  disabled={isTestingProxy}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 shadow-lg shadow-emerald-950/20 disabled:opacity-50"
                >
                  {isTestingProxy ? 'Testing...' : language === 'ml' ? 'സേവ് & ടെസ്റ്റ്' : 'Save & Test'}
                </button>
                {proxyUrlInput && (
                  <button
                    type="button"
                    onClick={() => handleSaveProxy(true)}
                    className="p-2 rounded-lg bg-rose-900/20 text-rose-400 hover:bg-rose-900/40 border border-rose-800/30 transition"
                    title={language === 'ml' ? 'പ്രോക്സി നീക്കം ചെയ്യുക' : 'Remove Proxy'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {proxyError && !isFixedProxyActive && (
                <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg p-2 text-[9px] space-y-1">
                  <span className="text-amber-400 font-bold block">
                    {language === 'ml' ? 'ഡയഗ്നോസ്റ്റിക് സ്റ്റാറ്റസ്:' : 'Diagnostic Status:'}
                  </span>
                  <p className="text-slate-300 font-mono break-all">{proxyError}</p>
                </div>
              )}

              <div className="text-[11px] text-slate-300 leading-relaxed font-sans bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 block">
                  {language === 'ml'
                    ? '📌 SOCKS5 സ്റ്റാറ്റിക് പ്രോക്സി വിവരങ്ങൾ:'
                    : '📌 SOCKS5 Static Proxy Details:'}
                </span>
                <span className="block text-slate-400 text-[10px]">
                  {language === 'ml'
                    ? 'GCP SOCKS5 (34.180.11.27:1080) ഡിഫോൾട്ടായി ക്രമീകരിച്ചിരിക്കുന്നു. ആവശ്യമെങ്കിൽ മറ്റൊരു socks5:// അല്ലെങ്കിൽ http:// പ്രോക്സി URL ഇവിടെ നൽകി സേവ് ചെയ്യാം.'
                    : 'GCP SOCKS5 (34.180.11.27:1080) is configured by default. You may enter any custom socks5:// or http:// proxy URL here and click Save & Test.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
