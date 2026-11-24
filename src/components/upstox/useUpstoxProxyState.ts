import { useEffect, useState } from 'react';
import type { UpstoxApiConfig } from '../../types';
import type { UpstoxStatusMsg } from './upstoxModalTypes';

export const DEFAULT_PROXY_URL = 'socks5://upstoxuser:Sajad9847989434@34.180.11.27:1080';

export function useUpstoxProxyState(
  config: UpstoxApiConfig,
  setStatusMsg: (msg: UpstoxStatusMsg) => void,
) {
  const [proxyUrlInput, setProxyUrlInput] = useState<string>(DEFAULT_PROXY_URL);
  const [isFixedProxyActive, setIsFixedProxyActive] = useState<boolean>(
    Boolean(config.isFixedProxyActive),
  );
  const [isTestingProxy, setIsTestingProxy] = useState<boolean>(false);
  const [showProxyConfig, setShowProxyConfig] = useState<boolean>(false);
  const [containerIp, setContainerIp] = useState<string>(
    config.serverSecondaryIp && config.serverSecondaryIp !== '34.180.11.27'
      ? config.serverSecondaryIp
      : 'Detecting...',
  );
  const [proxyError, setProxyError] = useState<string>(config.proxyError || '');

  useEffect(() => {
    if (!isTestingProxy && typeof config.isFixedProxyActive === 'boolean') {
      setIsFixedProxyActive(config.isFixedProxyActive);
      if (config.isFixedProxyActive) {
        setProxyError('');
      } else if (typeof config.proxyError === 'string') {
        setProxyError(config.proxyError);
      }
    }
  }, [config.isFixedProxyActive, config.proxyError, isTestingProxy]);

  const handleSaveProxy = async (remove = false) => {
    setIsTestingProxy(true);
    setStatusMsg(null);
    try {
      const targetVal = remove ? '' : proxyUrlInput;
      const res = await fetch('/api/market/proxy-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyUrl: targetVal }),
      });
      const data = await res.json();
      if (data.success) {
        setIsFixedProxyActive(Boolean(data.isFixedProxy));
        setProxyError('');
        if (remove) setProxyUrlInput('');
        setStatusMsg({
          type: 'success',
          text: data.message || `✅ Proxy Updated! Static IP: ${data.serverOutboundIp}`,
        });
      } else {
        setIsFixedProxyActive(false);
        setProxyError(data.error || 'Failed to connect to proxy');
        setStatusMsg({
          type: 'error',
          text:
            (data.error || 'Failed to connect to proxy') +
            (data.suggestedFix ? ` — ${data.suggestedFix}` : ''),
        });
      }
    } catch (e: any) {
      setIsFixedProxyActive(false);
      setProxyError(e?.message || 'Network error');
      setStatusMsg({
        type: 'error',
        text: 'Proxy test network error: ' + (e?.message || 'Failed'),
      });
    } finally {
      setIsTestingProxy(false);
    }
  };

  return {
    proxyUrlInput,
    setProxyUrlInput,
    isFixedProxyActive,
    setIsFixedProxyActive,
    isTestingProxy,
    showProxyConfig,
    setShowProxyConfig,
    containerIp,
    setContainerIp,
    proxyError,
    setProxyError,
    handleSaveProxy,
  };
}
