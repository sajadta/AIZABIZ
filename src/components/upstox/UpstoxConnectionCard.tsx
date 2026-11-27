import React from 'react';
import { RefreshCw, Trash2, UserCheck } from 'lucide-react';
import { LiveAccountSummary } from './LiveAccountSummary';
import { useUpstoxApiModal } from './useUpstoxApiModal';
import { UpstoxStaticIpCard } from './UpstoxStaticIpCard';
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
  const liveContainerIp =
    (containerIp && containerIp !== 'Detecting...' && containerIp !== '34.180.11.27'
      ? containerIp
      : '') ||
    (config.serverSecondaryIp && config.serverSecondaryIp !== '34.180.11.27'
      ? config.serverSecondaryIp
      : '') ||
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

        <LiveAccountSummary
          config={config}
          language={language}
          liveHoldingsCount={liveHoldingsCount}
        />

        <UpstoxStaticIpCard
          config={config}
          isFixedProxyActive={isFixedProxyActive}
          copyIpList={copyIpList}
          liveContainerIp={liveContainerIp}
          setStatusMsg={setStatusMsg}
          showProxyConfig={showProxyConfig}
          setShowProxyConfig={setShowProxyConfig}
          proxyUrlInput={proxyUrlInput}
          setProxyUrlInput={setProxyUrlInput}
          isTestingProxy={isTestingProxy}
          proxyError={proxyError}
          handleSaveProxy={handleSaveProxy}
          language={language}
        />
      </div>
    </>
  );
};
