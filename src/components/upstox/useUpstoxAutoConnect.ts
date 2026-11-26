import { useEffect, useRef } from 'react';
import type { Language, UpstoxApiConfig } from '../../types';

interface UseUpstoxAutoConnectParams {
  isOpen: boolean;
  config: UpstoxApiConfig;
  language: Language;
  onSaveConfig: (cfg: Partial<UpstoxApiConfig>) => Promise<void> | void;
  onRefreshPortfolio?: () => void;
  setAccessToken: (token: string) => void;
  setLiveHoldingsCount: (count: number | null) => void;
  setStatusMsg: (msg: { type: 'success' | 'error' | 'info'; text: string } | null) => void;
}

/** Polls the backend for an approved token and listens for the OAuth callback postMessage. */
export function useUpstoxAutoConnect({
  isOpen,
  config,
  language,
  onSaveConfig,
  onRefreshPortfolio,
  setAccessToken,
  setLiveHoldingsCount,
  setStatusMsg,
}: UseUpstoxAutoConnectParams): void {
  // Refs keep the polling effects subscribed across parent re-renders.
  const onSaveConfigRef = useRef(onSaveConfig);
  onSaveConfigRef.current = onSaveConfig;
  const onRefreshPortfolioRef = useRef(onRefreshPortfolio);
  onRefreshPortfolioRef.current = onRefreshPortfolio;

  // Auto-poll backend every 2 seconds while modal is open so any approved token immediately connects
  useEffect(() => {
    if (!isOpen || config.isConnected) return;
    const pollTimer = setInterval(async () => {
      try {
        let localTok = '';
        try {
          localTok = localStorage.getItem('upstox_daily_token') || '';
        } catch {
          /* ignored */
        }
        const reqHeaders: Record<string, string> = {};
        if (localTok) reqHeaders['Authorization'] = `Bearer ${localTok}`;

        const res = await fetch('/api/market/config', { headers: reqHeaders });
        if (!res.ok) return;
        const data = await res.json();
        if (data.isConnected && data.accessToken) {
          setAccessToken(data.accessToken);
          setLiveHoldingsCount(typeof data.holdingsCount === 'number' ? data.holdingsCount : null);
          try {
            localStorage.setItem('upstox_daily_token', data.accessToken);
            localStorage.setItem('upstox_token_date', new Date().toLocaleDateString('en-IN'));
          } catch {
            /* ignored */
          }
          await onSaveConfigRef.current({
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
            actualDetectedIp: data.actualDetectedIp || data.serverSecondaryIp || undefined,
            todayTokenValid: true,
          });
          if (onRefreshPortfolioRef.current) onRefreshPortfolioRef.current();
          setStatusMsg({
            type: 'success',
            text:
              language === 'ml'
                ? `🎉 Upstox ടോക്കൺ ഓട്ടോമാറ്റിക്കായി സ്വീകരിച്ചു! ലൈവ് ട്രേഡിംഗും ഹോൾഡിങ്‌സും (${data.holdingsCount ?? 0}) സജീവമായി!`
                : '🎉 Upstox Token automatically received! Live Trading & Holdings are now ACTIVE!',
          });
        }
      } catch {
        /* ignored */
      }
    }, 2000);
    return () => clearInterval(pollTimer);
  }, [isOpen, config.isConnected, language, setAccessToken, setLiveHoldingsCount, setStatusMsg]);

  // Listen for automatic OAuth callback postMessage
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'UPSTOX_OAUTH_SUCCESS' && event.data.accessToken) {
        const token = event.data.accessToken;
        setAccessToken(token);
        try {
          localStorage.setItem('upstox_daily_token', token);
          localStorage.setItem('upstox_token_date', new Date().toLocaleDateString('en-IN'));
        } catch {
          /* ignored */
        }
        await onSaveConfigRef.current({
          accessToken: token,
          isConnected: true,
          userName: event.data.userName || '',
          userClientCode: event.data.userClientCode || '',
          todayTokenValid: true,
        });
        if (onRefreshPortfolioRef.current) onRefreshPortfolioRef.current();
        setStatusMsg({
          type: 'success',
          text:
            language === 'ml'
              ? '🎉 പുതിയ Access Token ഓട്ടോമാറ്റിക്കായി ജനറേറ്റ് ചെയ്ത് ലൈവ് കണക്റ്റായി!'
              : '🎉 Daily Access Token automatically generated and connected!',
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [language, setAccessToken, setStatusMsg]);
}
