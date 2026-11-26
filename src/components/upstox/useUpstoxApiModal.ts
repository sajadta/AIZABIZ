import { useState, useRef } from 'react';
import type { UpstoxApiConfig, Language } from '../../types';
import { translations } from '../../translations';
import { useUpstoxProxyState } from './useUpstoxProxyState';
import { useUpstoxTokenActions } from './useUpstoxTokenActions';
import { useUpstoxOtpConnect } from './useUpstoxOtpConnect';
import { useUpstoxConnectionActions } from './useUpstoxConnectionActions';
import { useUpstoxAutoConnect } from './useUpstoxAutoConnect';
import { useUpstoxModalConfigSync } from './useUpstoxModalConfigSync';

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

  useUpstoxModalConfigSync({
    isOpen,
    config,
    defaultApiKey: DEFAULT_API_KEY,
    defaultApiSecret: DEFAULT_API_SECRET,
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
  });

  useUpstoxAutoConnect({
    isOpen,
    config,
    language,
    onSaveConfig,
    onRefreshPortfolio,
    setAccessToken,
    setLiveHoldingsCount,
    setStatusMsg,
  });

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
