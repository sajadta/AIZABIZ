import React from 'react';
import { Settings, Trash2 } from 'lucide-react';
import type { Language } from '../../types';

export interface ProxyConfigDrawerProps {
  proxyUrlInput: string;
  setProxyUrlInput: (v: string) => void;
  isTestingProxy: boolean;
  proxyError: string;
  isFixedProxyActive: boolean;
  handleSaveProxy: (remove: boolean) => void;
  language: Language;
}

export const ProxyConfigDrawer: React.FC<ProxyConfigDrawerProps> = ({
  proxyUrlInput,
  setProxyUrlInput,
  isTestingProxy,
  proxyError,
  isFixedProxyActive,
  handleSaveProxy,
  language,
}) => (
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
);
