import { useState, useEffect, useRef } from 'react';
import type { UpstoxApiConfig, Language } from '../../types';
import { translations } from '../../translations';
import { useUpstoxProxyState } from './useUpstoxProxyState';
import { useUpstoxTokenActions } from './useUpstoxTokenActions';
import { useUpstoxOtpConnect } from './useUpstoxOtpConnect';
import { useUpstoxConnectionActions } from './useUpstoxConnectionActions';

const DEFAULT_API_KEY = '3ab5711d-8891-480b-b0c1-29662852de49';
const DEFAULT_API_SECRET = 'jl5s7qy9r0';
const DEFAULT_MOBILE = '9847989434';

const getFallbackRedirectUri = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/market/callback`;
  }
  return 'http://localhost:3000/api/market/callback';
};

export type { UpstoxStatusMsg } from './upstoxModalTypes';

export interface UseUpstoxApiModalParams {
  isOpen: boolean;
  onClose: () => void;
  config: UpstoxApiConfig;
  onSaveConfig: (cfg: Partial<UpstoxApiConfig>) => Promise<void>;
  language: Language;
  onRefreshPortfolio?: () => void;
}

export function useUpstoxApiModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  language,
  onRefreshPortfolio,
}: UseUpstoxApiModalParams) {
  const t = translations[language];
  const onSaveConfigRef = useRef(onSaveConfig);
  onSaveConfigRef.current = onSaveConfig;
  const onRefreshPortfolioRef = useRef(onRefreshPortfolio);
  onRefreshPortfolioRef.current = onRefreshPortfolio;

  // Clean 2-Tab Layout: Tab 1 (Daily Token) | Tab 2 (Only OTP Input & Auto Connect)
  const [activeTab, setActiveTab] = useState<'DAILY_TOKEN' | 'API_KEYS'>(() => {
    try {
      const savedTok = localStorage.getItem('upstox_daily_token') || config.accessToken || '';
      return savedTok.length > 30 ? 'DAILY_TOKEN' : 'API_KEYS';
    } catch {
      return config.accessToken ? 'DAILY_TOKEN' : 'API_KEYS';
    }
  });

  const [apiKey, setApiKey] = useState(config.apiKey || DEFAULT_API_KEY);
  const [apiSecret, setApiSecret] = useState(
    config.apiSecret && config.apiSecret !== '••••••••' ? config.apiSecret : DEFAULT_API_SECRET,
  );
  const [accessToken, setAccessToken] = useState(config.accessToken || '');
  const [redirectUri, setRedirectUri] = useState(
    config.redirectUri && config.redirectUri.trim() !== ''
      ? config.redirectUri.trim()
      : getFallbackRedirectUri(),
  );

  // Saved mobile number (configured on the server)
  const [savedMobile, setSavedMobile] = useState(() => {
    try {
      const m = localStorage.getItem('upstox_saved_mobile');
      return m && m.length === 10 ? m : DEFAULT_MOBILE;
    } catch {
      return DEFAULT_MOBILE;
    }
  });

  // Single OTP / Code input in Tab 2
  const [otpInput, setOtpInput] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSessionBackup, setOtpSessionBackup] = useState<any>(null);
  const [showKeySettings, setShowKeySettings] = useState(false);

  const [loading, setLoading] = useState(false);
  const [liveHoldingsCount, setLiveHoldingsCount] = useState<number | null>(
    typeof config.holdingsCount === 'number' ? config.holdingsCount : null,
  );

  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const {
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
  } = useUpstoxProxyState(config, setStatusMsg);

  const { v3Loading, handleClearToken, handleRequestTokenV3, handleSaveRedirectUri } =
    useUpstoxTokenActions({
      language,
      apiKey,
      apiSecret,
      redirectUri,
      defaultApiKey: DEFAULT_API_KEY,
      defaultApiSecret: DEFAULT_API_SECRET,
      getFallbackRedirectUri,
      setAccessToken,
      setStatusMsg,
      onSaveConfig,
    });

  useEffect(() => {
    if (isOpen) {
      setApiKey(config.apiKey || DEFAULT_API_KEY);
      setApiSecret(
        config.apiSecret && config.apiSecret !== '••••••••' ? config.apiSecret : DEFAULT_API_SECRET,
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
          onSaveConfigRef.current({
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
          onSaveConfigRef.current({
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
  }, [isOpen, config.isConnected, language]);

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
  }, [language]);

  const { checkingStatus, validating, handleCheckLiveConnection, handleDailyTokenSubmit } =
    useUpstoxConnectionActions({
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
    });
  const { handleForceSendSmsOtp, handleOtpOrAutoConnect } = useUpstoxOtpConnect({
    language,
    apiKey,
    apiSecret,
    redirectUri,
    savedMobile,
    otpInput,
    otpSessionBackup,
    setAccessToken,
    setOtpInput,
    setOtpRequested,
    setOtpSessionBackup,
    setSavedMobile,
    setLoading,
    setStatusMsg,
    onSaveConfig,
    onRefreshPortfolio,
  });

  // Clear Daily Token

  return {
    t,
    activeTab,
    setActiveTab,
    apiKey,
    setApiKey,
    apiSecret,
    setApiSecret,
    accessToken,
    setAccessToken,
    redirectUri,
    setRedirectUri,
    savedMobile,
    setSavedMobile,
    otpInput,
    setOtpInput,
    otpRequested,
    showKeySettings,
    setShowKeySettings,
    loading,
    validating,
    checkingStatus,
    v3Loading,
    proxyUrlInput,
    setProxyUrlInput,
    isFixedProxyActive,
    isTestingProxy,
    showProxyConfig,
    setShowProxyConfig,
    containerIp,
    proxyError,
    liveHoldingsCount,
    statusMsg,
    setStatusMsg,
    handleSaveProxy,
    handleCheckLiveConnection,
    handleDailyTokenSubmit,
    handleForceSendSmsOtp,
    handleOtpOrAutoConnect,
    handleClearToken,
    handleRequestTokenV3,
    handleSaveRedirectUri,
    getFallbackRedirectUri,
    DEFAULT_API_KEY,
    isOpen,
    onClose,
    config,
    language,
  };
}
