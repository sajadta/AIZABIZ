// Live-connection verification and daily token submission handlers for the
// Upstox API modal, split out of useUpstoxApiModal to keep that hook readable.
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Language, UpstoxApiConfig } from '../../types';

export interface UpstoxConnectionActionsParams {
  language: Language;
  accessToken: string;
  setAccessToken: Dispatch<SetStateAction<string>>;
  config: UpstoxApiConfig;
  setStatusMsg: Dispatch<
    SetStateAction<{ type: 'success' | 'error' | 'info'; text: string } | null>
  >;
  setIsFixedProxyActive: Dispatch<SetStateAction<boolean>>;
  setProxyError: Dispatch<SetStateAction<string>>;
  setContainerIp: Dispatch<SetStateAction<string>>;
  setLiveHoldingsCount: Dispatch<SetStateAction<number | null>>;
  onSaveConfig: (patch: Partial<UpstoxApiConfig>) => Promise<void> | void;
  onRefreshPortfolio?: () => void;
}

export function useUpstoxConnectionActions({
  language,
  accessToken,
  setAccessToken,
  config,
  setStatusMsg,
  setIsFixedProxyActive,
  setProxyError,
  setContainerIp,
  setLiveHoldingsCount,
  onSaveConfig,
  onRefreshPortfolio,
}: UpstoxConnectionActionsParams) {
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [validating, setValidating] = useState(false);

  // Live Diagnostic Check Button Handler
  const handleCheckLiveConnection = async () => {
    setCheckingStatus(true);
    setStatusMsg(null);
    try {
      let localTok = accessToken || config.accessToken || '';
      if (!localTok) {
        try {
          localTok = localStorage.getItem('upstox_daily_token') || '';
        } catch {
          /* ignored */
        }
      }
      const reqHeaders: Record<string, string> = {};
      if (localTok) reqHeaders['Authorization'] = `Bearer ${localTok}`;

      const [cfgRes, proxyRes] = await Promise.all([
        fetch('/api/market/config', { headers: reqHeaders }),
        fetch('/api/market/proxy-status').catch(() => null),
      ]);
      const data = await cfgRes.json();
      const pData = proxyRes ? await proxyRes.json().catch(() => null) : null;
      const resolvedFixedProxy =
        pData && pData.success ? Boolean(pData.isProxyActive) : Boolean(data.isFixedProxyActive);
      setIsFixedProxyActive(resolvedFixedProxy);
      setProxyError((pData?.success ? pData.lastError : data.proxyError) || '');
      if (pData?.containerIp && pData.containerIp !== 'Detecting...') {
        setContainerIp(pData.containerIp);
      }
      if (data.isConnected) {
        setLiveHoldingsCount(typeof data.holdingsCount === 'number' ? data.holdingsCount : null);
        if (data.accessToken) {
          setAccessToken(data.accessToken);
          try {
            localStorage.setItem('upstox_daily_token', data.accessToken);
          } catch {
            /* ignored */
          }
        }
        if (data.serverSecondaryIp && data.serverSecondaryIp !== '34.180.11.27') {
          setContainerIp(data.serverSecondaryIp);
        }
        await onSaveConfig({
          isConnected: true,
          accessToken: data.accessToken,
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
          isFixedProxyActive: resolvedFixedProxy,
          todayTokenValid: true,
        });
        if (onRefreshPortfolio) onRefreshPortfolio();
        setStatusMsg({
          type: 'success',
          text:
            language === 'ml'
              ? `✅ Upstox ടോക്കൺ ലൈവ് ആയി പ്രവർത്തിക്കുന്നു! ഫണ്ട് ബാലൻസ്: ₹${Number(data.availableMargin || 0).toLocaleString('en-IN')} • ഹോൾഡിങ്‌സ്: ${data.holdingsCount ?? 0} ഓഹരികൾ.`
              : `✅ Upstox Token is LIVE! Margin: ₹${Number(data.availableMargin || 0).toLocaleString('en-IN')} • Holdings: ${data.holdingsCount ?? 0} stocks.`,
        });
      } else {
        if (data.tokenExpired) {
          try {
            localStorage.removeItem('upstox_daily_token');
          } catch {
            /* ignored */
          }
          await onSaveConfig({ isConnected: false, accessToken: '' });
        }
        setStatusMsg({
          type: 'error',
          text:
            language === 'ml'
              ? '❌ Upstox ടോക്കൺ നിലവിൽ ആക്റ്റീവ് അല്ല. താഴെ "സേവ് ചെയ്തു കണക്റ്റ് ചെയ്യുക" അമർത്തി OTP വരുത്തി നൽകുക.'
              : '❌ Upstox Token is NOT active. Click Save & Connect below to receive OTP.',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to check connection status',
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  // Tab 1: Direct Daily Token Save & Verify
  const handleDailyTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanToken = accessToken?.trim() || '';
    if (cleanToken.startsWith('Bearer ')) cleanToken = cleanToken.replace('Bearer ', '').trim();

    if (!cleanToken) {
      setStatusMsg({
        type: 'error',
        text:
          language === 'ml'
            ? 'ദയവായി ഇന്ന് ജനറേറ്റ് ചെയ്ത Upstox Access Token നൽകുക.'
            : "Please enter today's Upstox Access Token.",
      });
      return;
    }

    setValidating(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/market/daily-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: cleanToken }),
      });

      const data = await res.json();

      if (data.success) {
        try {
          const todayStr = new Date().toLocaleDateString('en-IN');
          localStorage.setItem('upstox_daily_token', cleanToken);
          localStorage.setItem('upstox_token_date', todayStr);
        } catch {
          /* ignored */
        }

        await onSaveConfig({
          accessToken: cleanToken,
          isConnected: true,
          userName: data.profile?.userName || '',
          userClientCode: data.profile?.userClientCode || '',
          tokenGeneratedAt:
            data.profile?.tokenGeneratedAt || new Date().toLocaleTimeString('en-IN'),
          tokenExpiresAt: data.profile?.tokenExpiresAt || 'Tomorrow 03:30 AM',
          todayTokenValid: true,
        });
        if (onRefreshPortfolio) onRefreshPortfolio();

        setStatusMsg({
          type: 'success',
          text:
            language === 'ml'
              ? `✅ ടോക്കൺ പരിശോധിച്ചു! ${data.profile?.userName || 'Sajad'} (${data.profile?.userClientCode || ''}) അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!`
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

  return { checkingStatus, validating, handleCheckLiveConnection, handleDailyTokenSubmit };
}
