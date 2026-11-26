import { useEffect } from 'react';
import type { UpstoxApiConfig } from '../../types';

export interface UpstoxModalConfigSyncParams {
  isOpen: boolean;
  config: UpstoxApiConfig;
  defaultApiKey: string;
  defaultApiSecret: string;
  getFallbackRedirectUri: () => string;
  setApiKey: (v: string) => void;
  setApiSecret: (v: string) => void;
  setAccessToken: (v: string) => void;
  setActiveTab: (v: 'DAILY_TOKEN' | 'API_KEYS') => void;
  setRedirectUri: (v: string) => void;
  setStatusMsg: (v: null) => void;
  setIsFixedProxyActive: (v: boolean) => void;
  setProxyUrlInput: (v: string) => void;
  setContainerIp: (v: string) => void;
  setProxyError: (v: string) => void;
  setSavedMobile: (v: string) => void;
  setLiveHoldingsCount: (v: number | null) => void;
  onSaveConfig: (cfg: Partial<UpstoxApiConfig>) => Promise<void>;
}

/** Loads saved modal fields and syncs live Upstox config + proxy status while the modal is open. */
export function useUpstoxModalConfigSync({
  isOpen,
  config,
  defaultApiKey,
  defaultApiSecret,
  getFallbackRedirectUri,
  setApiKey,
  setApiSecret,
  setAccessToken,
  setActiveTab,
  setRedirectUri,
  setStatusMsg,
  setIsFixedProxyActive,
  setProxyUrlInput,
  setContainerIp,
  setProxyError,
  setSavedMobile,
  setLiveHoldingsCount,
  onSaveConfig,
}: UpstoxModalConfigSyncParams) {
  useEffect(() => {
    if (isOpen) {
      setApiKey(config.apiKey || defaultApiKey);
      setApiSecret(
        config.apiSecret && config.apiSecret !== '••••••••' ? config.apiSecret : defaultApiSecret,
      );
      let localTok = config.accessToken || '';
      if (!localTok) {
        try {
          localTok = localStorage.getItem('upstox_daily_token') || '';
        } catch {
          /* ignored */
        }
      }
      setAccessToken(localTok);
      if (localTok.length > 30) {
        setActiveTab('DAILY_TOKEN');
      }
      const cleanUri =
        config.redirectUri && config.redirectUri.trim() !== ''
          ? config.redirectUri.trim()
          : getFallbackRedirectUri();
      setRedirectUri(cleanUri);
      setStatusMsg(null);

      const reqHeaders: Record<string, string> = {};
      if (localTok) reqHeaders['Authorization'] = `Bearer ${localTok}`;

      let cancelled = false;
      Promise.allSettled([
        fetch('/api/market/config', { headers: reqHeaders }).then((r) => r.json()),
        fetch('/api/market/proxy-status').then((pr) => pr.json()),
      ]).then(([cfgRes, proxyRes]) => {
        if (cancelled) return;
        const data = cfgRes.status === 'fulfilled' ? cfgRes.value : null;
        const pData = proxyRes.status === 'fulfilled' ? proxyRes.value : null;

        if (pData && pData.success) {
          setIsFixedProxyActive(Boolean(pData.isProxyActive));
          if (typeof pData.configuredProxy === 'string') setProxyUrlInput(pData.configuredProxy);
          if (pData.containerIp && pData.containerIp !== 'Detecting...') {
            setContainerIp(pData.containerIp);
          }
          setProxyError(pData.lastError || '');
        } else if (data && typeof data.isFixedProxyActive === 'boolean') {
          setIsFixedProxyActive(Boolean(data.isFixedProxyActive));
          setProxyError(data.proxyError || '');
        }

        if (!data) return;

        if (
          data.mobile &&
          String(data.mobile).length === 10 &&
          String(data.mobile) !== '0000000000'
        ) {
          setSavedMobile(String(data.mobile));
          try {
            localStorage.setItem('upstox_saved_mobile', String(data.mobile));
          } catch {
            /* ignored */
          }
        }
        if (data.apiSecret && data.apiSecret !== '••••••••') {
          setApiSecret(String(data.apiSecret));
        }
        if (data.serverSecondaryIp && data.serverSecondaryIp !== '34.180.11.27') {
          setContainerIp(data.serverSecondaryIp);
        }
        if (typeof data.holdingsCount === 'number') {
          setLiveHoldingsCount(data.holdingsCount);
        }
        const resolvedFixedProxy =
          pData && pData.success ? Boolean(pData.isProxyActive) : Boolean(data.isFixedProxyActive);

        if (data.isConnected && data.accessToken) {
          setAccessToken(data.accessToken);
          onSaveConfig({
            accessToken: data.accessToken,
            isConnected: true,
            userName: data.userName || '',
            userClientCode: data.userClientCode || '',
            availableMargin: data.availableMargin || 0,
            settledCash: data.settledCash,
            deliverySellCredit: data.deliverySellCredit,
            usedMargin: data.usedMargin || 0,
            utilizedMargin: data.utilizedMargin ?? Math.max(0, data.usedMargin || 0),
            payin: data.payin || 0,
            payout: data.payout || 0,
            totalBalance:
              data.totalBalance ?? (data.availableMargin || 0) + Math.max(0, data.usedMargin || 0),
            holdingsCount: typeof data.holdingsCount === 'number' ? data.holdingsCount : undefined,
            tokenGeneratedAt: data.tokenGeneratedAt || undefined,
            tokenExpiresAt: data.tokenExpiresAt || undefined,
            serverOutboundIp: data.serverOutboundIp || undefined,
            serverSecondaryIp: data.serverSecondaryIp || undefined,
            actualDetectedIp: data.actualDetectedIp || undefined,
            isFixedProxyActive: resolvedFixedProxy,
            proxyError: (pData?.lastError ?? data.proxyError) || '',
            todayTokenValid: true,
          });
        } else if (data.tokenExpired && !localTok) {
          onSaveConfig({
            isConnected: false,
            availableMargin: 0,
            settledCash: 0,
            deliverySellCredit: 0,
            usedMargin: 0,
            utilizedMargin: 0,
            payin: 0,
            payout: 0,
            totalBalance: 0,
            isFixedProxyActive: resolvedFixedProxy,
            todayTokenValid: false,
          });
        }
      });

      const proxyPollInterval = setInterval(() => {
        fetch('/api/market/proxy-status')
          .then((pr) => pr.json())
          .then((pData) => {
            if (!cancelled && pData && pData.success) {
              setIsFixedProxyActive(Boolean(pData.isProxyActive));
              if (pData.containerIp && pData.containerIp !== 'Detecting...') {
                setContainerIp(pData.containerIp);
              }
              setProxyError(pData.lastError || '');
            }
          })
          .catch(() => {});
      }, 8000);

      return () => {
        cancelled = true;
        clearInterval(proxyPollInterval);
      };
    }
  }, [isOpen, config.apiKey, config.apiSecret, config.accessToken, config.redirectUri]);
}
