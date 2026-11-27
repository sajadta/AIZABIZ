import { useState } from 'react';
import type { Language } from '../../types';
import { safeStorage } from '../../utils/storage';
import type { UpstoxStatusMsg } from './upstoxModalTypes';
import { errorMessage } from '../../utils/errors';

interface UseUpstoxTokenActionsParams {
  language: Language;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  defaultApiKey: string;
  defaultApiSecret: string;
  getFallbackRedirectUri: () => string;
  setAccessToken: (token: string) => void;
  setStatusMsg: (msg: UpstoxStatusMsg) => void;
  onSaveConfig: (cfg: {
    accessToken?: string;
    isConnected?: boolean;
    redirectUri?: string;
  }) => Promise<void>;
}

export function useUpstoxTokenActions({
  language,
  apiKey,
  apiSecret,
  redirectUri,
  defaultApiKey,
  defaultApiSecret,
  getFallbackRedirectUri,
  setAccessToken,
  setStatusMsg,
  onSaveConfig,
}: UseUpstoxTokenActionsParams) {
  const [v3Loading, setV3Loading] = useState(false);

  const handleClearToken = async () => {
    try {
      await fetch('/api/market/clear-token', { method: 'POST' });
      setAccessToken('');
      safeStorage.removeItem('upstox_daily_token');
      safeStorage.removeItem('upstox_token_date');
      await onSaveConfig({ accessToken: '', isConnected: false });
      setStatusMsg({
        type: 'info',
        text:
          language === 'ml'
            ? 'ഇന്നത്തെ ടോക്കൺ നീക്കം ചെയ്തു. പേപ്പർ ട്രേഡിംഗ് മോഡിലേക്ക് മാറി.'
            : 'Daily token cleared. Switched to Paper Trading Mode.',
      });
    } catch {
      /* ignored */
    }
  };

  // Upstox V3 1-Click App / WhatsApp Approve Token Request
  const handleRequestTokenV3 = async () => {
    setV3Loading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/market/request-token-v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: (apiKey || defaultApiKey).trim(),
          apiSecret: apiSecret || defaultApiSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({
          type: 'success',
          text:
            data.message ||
            (language === 'ml'
              ? '📲 Upstox ആപ്പിലേക്കും WhatsApp-ലേക്കും Approve റിക്വസ്റ്റ് അയച്ചു!'
              : '📲 Sent 1-Click Approve request to Upstox Mobile App & WhatsApp!'),
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: data.error || 'Upstox V3 Token Request failed',
        });
      }
    } catch (e) {
      setStatusMsg({
        type: 'error',
        text: errorMessage(e) || 'Failed to send V3 Token Request',
      });
    } finally {
      setV3Loading(false);
    }
  };

  // Save Callback Redirect URI to match Upstox Developer Console
  const handleSaveRedirectUri = async () => {
    const cleanUri = (redirectUri || getFallbackRedirectUri()).trim();
    try {
      await onSaveConfig({ redirectUri: cleanUri });
      setStatusMsg({
        type: 'success',
        text:
          language === 'ml'
            ? `✅ Redirect URI സേവ് ചെയ്തു: ${cleanUri}`
            : `✅ Redirect URI saved: ${cleanUri}`,
      });
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to save Redirect URI' });
    }
  };

  return {
    v3Loading,
    handleClearToken,
    handleRequestTokenV3,
    handleSaveRedirectUri,
  };
}
