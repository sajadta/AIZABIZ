import { useState, useEffect } from 'react';
import type { UpstoxApiConfig, Language } from '../../types';
import { translations } from '../../translations';

const DEFAULT_API_KEY = '';
const DEFAULT_API_SECRET = '';
const DEFAULT_MOBILE = '';

const getFallbackRedirectUri = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/market/callback`;
  }
  return 'http://localhost:3000/api/market/callback';
};

export type UpstoxStatusMsg = { type: 'success' | 'error' | 'info'; text: string } | null;

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
  const [validating, setValidating] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [proxyUrlInput, setProxyUrlInput] = useState<string>('http://8.234.113.241:8888');
  const [isFixedProxyActive, setIsFixedProxyActive] = useState<boolean>(true);
  const [isTestingProxy, setIsTestingProxy] = useState<boolean>(false);
  const [showProxyConfig, setShowProxyConfig] = useState<boolean>(false);
  const [liveHoldingsCount, setLiveHoldingsCount] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

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
        if (remove) setProxyUrlInput('');
        setStatusMsg({
          type: 'success',
          text: data.message || `✅ Proxy Updated! Static IP: ${data.serverOutboundIp}`,
        });
      } else {
        setIsFixedProxyActive(false);
        setStatusMsg({
          type: 'error',
          text:
            (data.error || 'Failed to connect to proxy') +
            (data.suggestedFix ? ` — ${data.suggestedFix}` : ''),
        });
      }
    } catch (e: any) {
      setIsFixedProxyActive(false);
      setStatusMsg({
        type: 'error',
        text: 'Proxy test network error: ' + (e?.message || 'Failed'),
      });
    } finally {
      setIsTestingProxy(false);
    }
  };

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

      fetch('/api/market/config', { headers: reqHeaders })
        .then((r) => r.json())
        .then((data) => {
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
          setProxyUrlInput('http://8.234.113.241:8888');

          fetch('/api/market/proxy-status')
            .then((pr) => pr.json())
            .then((pData) => {
              if (pData.success) {
                setIsFixedProxyActive(Boolean(pData.isProxyActive));
                if (pData.configuredProxy) setProxyUrlInput(pData.configuredProxy);
              }
            })
            .catch(() => {});

          if (data.apiSecret && data.apiSecret !== '••••••••') {
            setApiSecret(String(data.apiSecret));
          }
          if (data.isConnected && data.accessToken) {
            setAccessToken(data.accessToken);
            onSaveConfig({
              accessToken: data.accessToken,
              isConnected: true,
              userName: data.userName || '',
              userClientCode: data.userClientCode || '',
              availableMargin: data.availableMargin || 0,
              usedMargin: data.usedMargin || 0,
              todayTokenValid: true,
            });
          } else if (data.tokenExpired && !localTok) {
            onSaveConfig({
              isConnected: false,
              availableMargin: 0,
              usedMargin: 0,
              todayTokenValid: false,
            });
          }
        })
        .catch(() => {});
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
          await onSaveConfig({
            accessToken: data.accessToken,
            isConnected: true,
            userName: data.userName || '',
            userClientCode: data.userClientCode || '',
            availableMargin: data.availableMargin || 0,
            usedMargin: data.usedMargin || 0,
            todayTokenValid: true,
          });
          if (onRefreshPortfolio) onRefreshPortfolio();
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
  }, [isOpen, config.isConnected, onSaveConfig, onRefreshPortfolio, language]);

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
        await onSaveConfig({
          accessToken: token,
          isConnected: true,
          userName: event.data.userName || '',
          userClientCode: event.data.userClientCode || '',
          todayTokenValid: true,
        });
        if (onRefreshPortfolio) onRefreshPortfolio();
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
  }, [onSaveConfig, onRefreshPortfolio, language]);

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

      const res = await fetch('/api/market/config', { headers: reqHeaders });
      const data = await res.json();
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
        await onSaveConfig({
          isConnected: true,
          accessToken: data.accessToken,
          userName: data.userName || '',
          userClientCode: data.userClientCode || '',
          availableMargin: data.availableMargin || 0,
          usedMargin: data.usedMargin || 0,
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

  // Resilient POST helper for local API calls
  const postWithAutoRetryAndRelay = async (endpoint: string, payload: any) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && (data.success || data.accessToken)) {
        return { ok: true, data };
      }
      const errStr = data?.error || (res.ok ? 'Operation failed' : `Server error (${res.status})`);
      return { ok: false, data: data || { success: false, error: errStr } };
    } catch (err: any) {
      return {
        ok: false,
        data: {
          success: false,
          error:
            err.message ||
            (language === 'ml'
              ? 'നെറ്റ്‌വർക്ക് കണക്ഷൻ തടസ്സപ്പെട്ടു. വീണ്ടും ശ്രമിക്കുക.'
              : 'Network connection error. Please retry.'),
        },
      };
    }
  };

  // Dedicated 1-click SMS OTP sender (works even if OTP box has text)
  const handleForceSendSmsOtp = async () => {
    setLoading(true);
    setStatusMsg(null);
    const cleanKey = (apiKey || DEFAULT_API_KEY).trim();
    const cleanUri = (redirectUri || getFallbackRedirectUri()).trim();
    const cleanSavedMobile = (savedMobile || DEFAULT_MOBILE).replace(/\D+/g, '').slice(-10);

    try {
      const { ok, data: otpData } = await postWithAutoRetryAndRelay('/api/market/send-sms-otp', {
        mobile: cleanSavedMobile,
        apiKey: cleanKey,
        apiSecret: apiSecret || DEFAULT_API_SECRET,
        redirectUri: cleanUri,
        pin: '',
      });
      if (ok && otpData.success) {
        setOtpInput('');
        setOtpRequested(true);
        if (otpData.sessionBackup) {
          setOtpSessionBackup(otpData.sessionBackup);
          try {
            localStorage.setItem(
              'upstox_otp_session_backup',
              JSON.stringify(otpData.sessionBackup),
            );
          } catch {
            /* ignored */
          }
        }
        setStatusMsg({
          type: 'success',
          text:
            language === 'ml'
              ? `📲 നിങ്ങളുടെ ഫോണിലേക്ക് (${cleanSavedMobile.slice(0, 2)}******${cleanSavedMobile.slice(-2)}) പുതിയ 6-അക്ക Upstox SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP താഴെ നൽകി പച്ച ബട്ടൺ അമർത്തുക!`
              : '📲 Fresh 6-digit SMS OTP sent to your phone! Enter the OTP below and tap the green button!',
        });
      } else {
        throw new Error(otpData?.error || 'Failed to send SMS OTP');
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Connection failed',
      });
    } finally {
      setLoading(false);
    }
  };

  // Tab 2: Single Automatic Handler for:
  // 1) Auto-sending SMS OTP using saved mobile number
  // 2) Verifying 6-digit SMS OTP -> Auto-submitting PIN -> Auto-generating Token!
  const handleOtpOrAutoConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    const cleanKey = (apiKey || DEFAULT_API_KEY).trim();
    const cleanUri = (redirectUri || getFallbackRedirectUri()).trim();
    const trimmedInput = otpInput.trim();
    const digitsOnly = trimmedInput.replace(/\D+/g, '');

    try {
      // CASE A: If user typed their 10-digit mobile number in the box (one-time setup), save it forever AND immediately send SMS OTP!
      if (/^[6-9]\d{9}$/.test(digitsOnly)) {
        setSavedMobile(digitsOnly);
        try {
          localStorage.setItem('upstox_saved_mobile', digitsOnly);
        } catch {
          /* ignored */
        }

        const { ok, data: otpData } = await postWithAutoRetryAndRelay('/api/market/send-sms-otp', {
          mobile: digitsOnly,
          apiKey: cleanKey,
          apiSecret,
          redirectUri: cleanUri,
          pin: '',
        });
        if (ok && otpData.success) {
          setOtpInput('');
          setOtpRequested(true);
          if (otpData.sessionBackup) {
            setOtpSessionBackup(otpData.sessionBackup);
            try {
              localStorage.setItem(
                'upstox_otp_session_backup',
                JSON.stringify(otpData.sessionBackup),
              );
            } catch {
              /* ignored */
            }
          }
          setStatusMsg({
            type: 'success',
            text:
              otpData.message ||
              (language === 'ml'
                ? `📲 മൊബൈൽ നമ്പർ സ്ഥിരമായി സേവ് ചെയ്തു! നിങ്ങളുടെ ഫോണിലേക്ക് 6-അക്ക SMS OTP അയച്ചിട്ടുണ്ട് — ആ OTP മാത്രം താഴെ നൽകി "സേവ് ചെയ്തു കണക്റ്റ് ചെയ്യുക" അമർത്തുക!`
                : '📲 Mobile saved! 6-digit SMS OTP sent to your phone — enter the OTP below and tap Save & Connect!'),
          });
        } else {
          throw new Error(otpData?.error || 'Failed to send SMS OTP');
        }
        setLoading(false);
        return;
      }

      // CASE B: User entered the 6-digit OTP -> Verify OTP + Auto-enter PIN  + Auto-generate Access Token!
      if (/^\d{6}$/.test(digitsOnly)) {
        let backupToUse = otpSessionBackup;
        if (!backupToUse) {
          try {
            const raw = localStorage.getItem('upstox_otp_session_backup');
            if (raw) backupToUse = JSON.parse(raw);
          } catch {
            /* ignored */
          }
        }
        const { ok, data } = await postWithAutoRetryAndRelay('/api/market/totp-login', {
          totp: digitsOnly,
          pin: '',
          mobile: savedMobile || DEFAULT_MOBILE,
          apiKey: cleanKey,
          apiSecret: apiSecret || DEFAULT_API_SECRET,
          sessionBackup: backupToUse,
        });
        if (ok && data.success && data.accessToken) {
          setAccessToken(data.accessToken);
          setOtpInput('');
          setOtpRequested(false);
          setOtpSessionBackup(null);
          try {
            localStorage.removeItem('upstox_otp_session_backup');
            localStorage.setItem('upstox_daily_token', data.accessToken);
            localStorage.setItem('upstox_token_date', new Date().toLocaleDateString('en-IN'));
          } catch {
            /* ignored */
          }
          await onSaveConfig({
            accessToken: data.accessToken,
            isConnected: true,
            userName: data.userName || '',
            userClientCode: data.userClientCode || '',
            todayTokenValid: true,
          });
          if (onRefreshPortfolio) onRefreshPortfolio();
          setStatusMsg({
            type: 'success',
            text:
              data.message ||
              (language === 'ml'
                ? '🎉 OTP പരിശോധിച്ചു, PIN ഓട്ടോമാറ്റിക്കായി നൽകി, പുതിയ ടോക്കൺ ജനറേറ്റ് ചെയ്ത് അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!'
                : '🎉 OTP Verified, PIN auto-submitted, and Upstox account connected live!'),
          });
          setLoading(false);
          return;
        } else {
          throw new Error(data?.error || 'OTP verification failed');
        }
      }

      // CASE C: User pasted a redirected URL or Auth Code or JWT token
      if (trimmedInput.length > 6) {
        const { ok, data } = await postWithAutoRetryAndRelay('/api/market/token', {
          code: trimmedInput,
          apiKey: cleanKey,
          apiSecret: apiSecret || DEFAULT_API_SECRET,
          redirectUri: cleanUri,
        });
        if (ok && data.accessToken) {
          setAccessToken(data.accessToken);
          setOtpInput('');
          try {
            localStorage.setItem('upstox_daily_token', data.accessToken);
            localStorage.setItem('upstox_token_date', new Date().toLocaleDateString('en-IN'));
          } catch {
            /* ignored */
          }
          await onSaveConfig({
            accessToken: data.accessToken,
            isConnected: true,
            userName: data.user_name || '',
            userClientCode: data.user_id || '',
            todayTokenValid: true,
          });
          if (onRefreshPortfolio) onRefreshPortfolio();
          setStatusMsg({
            type: 'success',
            text:
              language === 'ml'
                ? '🎉 പുതിയ Access Token ജനറേറ്റ് ചെയ്ത് ലൈവ് ആയി കണക്റ്റായി!'
                : '🎉 Access Token generated and connected live!',
          });
          setLoading(false);
          return;
        } else {
          throw new Error(data?.error || 'Invalid code');
        }
      }

      // CASE D: OTP box is empty -> User clicked "ഫോണിലേക്ക് SMS OTP അയക്കുക (Auto)" to request SMS OTP automatically!
      const cleanSavedMobile = (savedMobile || DEFAULT_MOBILE).replace(/\D+/g, '').slice(-10);
      if (cleanSavedMobile.length === 10) {
        const { ok, data: otpData } = await postWithAutoRetryAndRelay('/api/market/send-sms-otp', {
          mobile: cleanSavedMobile,
          apiKey: cleanKey,
          apiSecret: apiSecret || DEFAULT_API_SECRET,
          redirectUri: cleanUri,
          pin: '',
        });
        if (ok && otpData.success) {
          setOtpRequested(true);
          if (otpData.sessionBackup) {
            setOtpSessionBackup(otpData.sessionBackup);
            try {
              localStorage.setItem(
                'upstox_otp_session_backup',
                JSON.stringify(otpData.sessionBackup),
              );
            } catch {
              /* ignored */
            }
          }
          setStatusMsg({
            type: 'success',
            text:
              language === 'ml'
                ? `📲 നിങ്ങളുടെ ഫോണിലേക്ക് (${cleanSavedMobile.slice(0, 2)}******${cleanSavedMobile.slice(-2)}) Upstox 6-അക്ക SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP മാത്രം താഴെ നൽകി വീണ്ടും ബട്ടൺ അമർത്തുക — PIN നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!`
                : '📲 6-digit SMS OTP sent to your phone! Enter the OTP below and tap Save & Connect!',
          });
          setLoading(false);
          return;
        } else {
          throw new Error(otpData?.error || 'Failed to send SMS OTP');
        }
      } else {
        setStatusMsg({
          type: 'info',
          text:
            language === 'ml'
              ? '📱 ആദ്യ തവണ മാത്രം നിങ്ങളുടെ 10-അക്ക Upstox മൊബൈൽ നമ്പർ താഴെയുള്ള ബോക്സിൽ നൽകി "സേവ് ചെയ്തു കണക്റ്റ് ചെയ്യുക" അമർത്തുക. ആപ്പ് നമ്പർ സ്ഥിരമായി സേവ് ചെയ്ത് ഉടൻ ഫോണിലേക്ക് SMS OTP അയക്കും!'
              : '📱 For the first time only, enter your 10-digit Upstox mobile number in the box below and tap Save & Connect. It will be saved permanently and an SMS OTP will be sent immediately!',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Connection failed',
      });
    } finally {
      setLoading(false);
    }
  };

  // Clear Daily Token
  const handleClearToken = async () => {
    try {
      await fetch('/api/market/clear-token', { method: 'POST' });
      setAccessToken('');
      localStorage.removeItem('upstox_daily_token');
      localStorage.removeItem('upstox_token_date');
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
    proxyUrlInput,
    setProxyUrlInput,
    isFixedProxyActive,
    isTestingProxy,
    showProxyConfig,
    setShowProxyConfig,
    liveHoldingsCount,
    statusMsg,
    setStatusMsg,
    handleSaveProxy,
    handleCheckLiveConnection,
    handleDailyTokenSubmit,
    handleForceSendSmsOtp,
    handleOtpOrAutoConnect,
    handleClearToken,
    getFallbackRedirectUri,
    DEFAULT_API_KEY,
    isOpen,
    onClose,
    config,
    language,
  };
}
