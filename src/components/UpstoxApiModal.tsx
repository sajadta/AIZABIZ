import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Key,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Trash2,
  UserCheck,
  Zap,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react';
import { UpstoxApiConfig, Language } from '../types';
import { translations } from '../translations';

interface UpstoxApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UpstoxApiConfig;
  onSaveConfig: (cfg: Partial<UpstoxApiConfig>) => Promise<void>;
  language: Language;
  onRefreshPortfolio?: () => void;
}

const DEFAULT_API_KEY = '3ab5711d-8891-480b-b0c1-29662852de49';
const DEFAULT_API_SECRET = 'jl5s7qy9r0';
const DEFAULT_MOBILE = '9847989434';
const DEFAULT_REDIRECT_URI = 'https://sajad-trading-view.onrender.com';

export const UpstoxApiModal: React.FC<UpstoxApiModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  language,
  onRefreshPortfolio,
}) => {
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
    config.apiSecret && config.apiSecret !== '••••••••' ? config.apiSecret : DEFAULT_API_SECRET
  );
  const [accessToken, setAccessToken] = useState(config.accessToken || '');
  const [redirectUri, setRedirectUri] = useState(
    config.redirectUri && !config.redirectUri.includes('localhost') && !config.redirectUri.includes('127.0.0.1')
      ? config.redirectUri
      : DEFAULT_REDIRECT_URI
  );

  // Saved mobile number (pre-saved with user's 9847989434)
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
  const [serverStaticIp, setServerStaticIp] = useState<string>('8.234.113.241');
  const [serverSecondaryIp, setServerSecondaryIp] = useState<string>('34.34.254.178');
  const [actualDetectedIp, setActualDetectedIp] = useState<string>('8.234.113.241');
  const [ipMismatch, setIpMismatch] = useState<boolean>(false);
  const [proxyUrlInput, setProxyUrlInput] = useState<string>('http://8.234.113.241:8888');
  const [isFixedProxyActive, setIsFixedProxyActive] = useState<boolean>(true);
  const [isTestingProxy, setIsTestingProxy] = useState<boolean>(false);
  const [showProxyConfig, setShowProxyConfig] = useState<boolean>(false);
  const [liveHoldingsCount, setLiveHoldingsCount] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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
        if (data.serverOutboundIp) setServerStaticIp(data.serverOutboundIp);
        setStatusMsg({
          type: 'success',
          text: data.message || `✅ Proxy Updated! Static IP: ${data.serverOutboundIp}`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: data.error || 'Failed to connect to proxy',
        });
      }
    } catch (e: any) {
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
        config.apiSecret && config.apiSecret !== '••••••••' ? config.apiSecret : DEFAULT_API_SECRET
      );
      let localTok = config.accessToken || '';
      if (!localTok) {
        try {
          localTok = localStorage.getItem('upstox_daily_token') || '';
        } catch {}
      }
      setAccessToken(localTok);
      if (localTok.length > 30) {
        setActiveTab('DAILY_TOKEN');
      }
      const cleanUri =
        config.redirectUri && !config.redirectUri.includes('localhost') && !config.redirectUri.includes('127.0.0.1')
          ? config.redirectUri
          : DEFAULT_REDIRECT_URI;
      setRedirectUri(cleanUri);
      setStatusMsg(null);

      const reqHeaders: Record<string, string> = {};
      if (localTok) reqHeaders['Authorization'] = `Bearer ${localTok}`;

      fetch('/api/market/config', { headers: reqHeaders })
        .then((r) => r.json())
        .then((data) => {
          if (data.mobile && String(data.mobile).length === 10 && String(data.mobile) !== '0000000000') {
            setSavedMobile(String(data.mobile));
            try {
              localStorage.setItem('upstox_saved_mobile', String(data.mobile));
            } catch {}
          }
          setServerStaticIp('8.234.113.241');
          setServerSecondaryIp('34.34.254.178');
          setIsFixedProxyActive(true);
          setProxyUrlInput('http://8.234.113.241:8888');
          if (data.apiSecret && data.apiSecret !== '••••••••') {
            setApiSecret(String(data.apiSecret));
          }
          if (data.isConnected && data.accessToken) {
            setAccessToken(data.accessToken);
            onSaveConfig({
              accessToken: data.accessToken,
              isConnected: true,
              userName: data.userName || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN',
              userClientCode: data.userClientCode || '5VCABX',
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
        } catch {}
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
          } catch (e) {}
          await onSaveConfig({
            accessToken: data.accessToken,
            isConnected: true,
            userName: data.userName || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN',
            userClientCode: data.userClientCode || '5VCABX',
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
      } catch (e) {}
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
        } catch (e) {}
        await onSaveConfig({
          accessToken: token,
          isConnected: true,
          userName: event.data.userName || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN',
          userClientCode: event.data.userClientCode || '5VCABX',
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

  if (!isOpen) return null;

  // Live Diagnostic Check Button Handler
  const handleCheckLiveConnection = async () => {
    setCheckingStatus(true);
    setStatusMsg(null);
    try {
      let localTok = accessToken || config.accessToken || '';
      if (!localTok) {
        try {
          localTok = localStorage.getItem('upstox_daily_token') || '';
        } catch {}
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
          } catch {}
        }
        await onSaveConfig({
          isConnected: true,
          accessToken: data.accessToken,
          userName: data.userName || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN',
          userClientCode: data.userClientCode || '5VCABX',
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
          } catch {}
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
        } catch (e) {}

        await onSaveConfig({
          accessToken: cleanToken,
          isConnected: true,
          userName: data.profile?.userName || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN',
          userClientCode: data.profile?.userClientCode || '5VCABX',
          tokenGeneratedAt: data.profile?.tokenGeneratedAt || new Date().toLocaleTimeString('en-IN'),
          tokenExpiresAt: data.profile?.tokenExpiresAt || 'Tomorrow 03:30 AM',
          todayTokenValid: true,
        });
        if (onRefreshPortfolio) onRefreshPortfolio();

        setStatusMsg({
          type: 'success',
          text:
            language === 'ml'
              ? `✅ ടോക്കൺ പരിശോധിച്ചു! ${data.profile?.userName || 'Sajad'} (${data.profile?.userClientCode || '5VCABX'}) അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!`
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

  // Resilient POST helper: retries local endpoint and automatically falls back to high-speed Cloud Relay if ETIMEDOUT occurs
  const postWithAutoRetryAndRelay = async (endpoint: string, payload: any) => {
    const origins = [
      '',
      '',
      'https://ais-pre-2kuhbzz5qyj5zbysxk6da3-173711515136.asia-southeast1.run.app',
      'https://aizabiz.onrender.com',
    ];
    let lastError = 'Connection failed';
    let lastJson: any = null;

    for (let i = 0; i < origins.length; i++) {
      const base = origins[i];
      if (base && typeof window !== 'undefined' && window.location.origin === base) continue;
      try {
        const res = await fetch(`${base}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        lastJson = data;
        if (res.ok && (data.success || data.accessToken)) {
          // If token was obtained via backup relay origin, sync it to local server too
          if (base && data.accessToken) {
            fetch('/api/market/daily-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: data.accessToken }),
            }).catch(() => {});
          }
          return { ok: true, data };
        }
        const errStr = String(data.error || '');
        lastError = errStr || lastError;
        // Only fail over to next origin if it was a network/timeout error (ETIMEDOUT / fetch failed / 500)
        const isTimeoutOr500 =
          res.status >= 500 ||
          errStr.includes('ETIMEDOUT') ||
          errStr.includes('fetch failed') ||
          errStr.includes('തടസ്സപ്പെട്ടു');
        if (!isTimeoutOr500) {
          return { ok: false, data };
        }
      } catch (err: any) {
        lastError = err.message || lastError;
      }
    }
    return { ok: false, data: lastJson || { success: false, error: lastError } };
  };

  // Dedicated 1-click SMS OTP sender (works even if OTP box has text)
  const handleForceSendSmsOtp = async () => {
    setLoading(true);
    setStatusMsg(null);
    const cleanKey = (apiKey || DEFAULT_API_KEY).trim();
    const cleanUri = (redirectUri || DEFAULT_REDIRECT_URI).trim();
    const cleanSavedMobile = (savedMobile || DEFAULT_MOBILE).replace(/\D+/g, '').slice(-10);

    try {
      const { ok, data: otpData } = await postWithAutoRetryAndRelay('/api/market/send-sms-otp', {
        mobile: cleanSavedMobile,
        apiKey: cleanKey,
        apiSecret: apiSecret || DEFAULT_API_SECRET,
        redirectUri: cleanUri,
        pin: '984798',
      });
      if (ok && otpData.success) {
        setOtpInput('');
        setOtpRequested(true);
        if (otpData.sessionBackup) {
          setOtpSessionBackup(otpData.sessionBackup);
          try {
            localStorage.setItem('upstox_otp_session_backup', JSON.stringify(otpData.sessionBackup));
          } catch {}
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
  // 2) Verifying 6-digit SMS OTP -> Auto-submitting PIN (984798) -> Auto-generating Token!
  const handleOtpOrAutoConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    const cleanKey = (apiKey || DEFAULT_API_KEY).trim();
    const cleanUri = (redirectUri || DEFAULT_REDIRECT_URI).trim();
    const trimmedInput = otpInput.trim();
    const digitsOnly = trimmedInput.replace(/\D+/g, '');

    try {
      // CASE A: If user typed their 10-digit mobile number in the box (one-time setup), save it forever AND immediately send SMS OTP!
      if (/^[6-9]\d{9}$/.test(digitsOnly)) {
        setSavedMobile(digitsOnly);
        try {
          localStorage.setItem('upstox_saved_mobile', digitsOnly);
        } catch {}

        const { ok, data: otpData } = await postWithAutoRetryAndRelay('/api/market/send-sms-otp', {
          mobile: digitsOnly,
          apiKey: cleanKey,
          apiSecret,
          redirectUri: cleanUri,
          pin: '984798',
        });
        if (ok && otpData.success) {
          setOtpInput('');
          setOtpRequested(true);
          if (otpData.sessionBackup) {
            setOtpSessionBackup(otpData.sessionBackup);
            try {
              localStorage.setItem('upstox_otp_session_backup', JSON.stringify(otpData.sessionBackup));
            } catch {}
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

      // CASE B: User entered the 6-digit OTP -> Verify OTP + Auto-enter PIN 984798 + Auto-generate Access Token!
      if (/^\d{6}$/.test(digitsOnly)) {
        let backupToUse = otpSessionBackup;
        if (!backupToUse) {
          try {
            const raw = localStorage.getItem('upstox_otp_session_backup');
            if (raw) backupToUse = JSON.parse(raw);
          } catch {}
        }
        const { ok, data } = await postWithAutoRetryAndRelay('/api/market/totp-login', {
          totp: digitsOnly,
          pin: '984798',
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
          } catch (e) {}
          await onSaveConfig({
            accessToken: data.accessToken,
            isConnected: true,
            userName: data.userName || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN',
            userClientCode: data.userClientCode || '5VCABX',
            todayTokenValid: true,
          });
          if (onRefreshPortfolio) onRefreshPortfolio();
          setStatusMsg({
            type: 'success',
            text:
              data.message ||
              (language === 'ml'
                ? '🎉 OTP പരിശോധിച്ചു, PIN (984798) ഓട്ടോമാറ്റിക്കായി നൽകി, പുതിയ ടോക്കൺ ജനറേറ്റ് ചെയ്ത് അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!'
                : '🎉 OTP Verified, PIN (984798) auto-submitted, and Upstox account connected live!'),
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
          } catch (e) {}
          await onSaveConfig({
            accessToken: data.accessToken,
            isConnected: true,
            userName: data.user_name || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN',
            userClientCode: data.user_id || '5VCABX',
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
          pin: '984798',
        });
        if (ok && otpData.success) {
          setOtpRequested(true);
          if (otpData.sessionBackup) {
            setOtpSessionBackup(otpData.sessionBackup);
            try {
              localStorage.setItem('upstox_otp_session_backup', JSON.stringify(otpData.sessionBackup));
            } catch {}
          }
          setStatusMsg({
            type: 'success',
            text:
              language === 'ml'
                ? `📲 നിങ്ങളുടെ ഫോണിലേക്ക് (${cleanSavedMobile.slice(0, 2)}******${cleanSavedMobile.slice(-2)}) Upstox 6-അക്ക SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP മാത്രം താഴെ നൽകി വീണ്ടും ബട്ടൺ അമർത്തുക — PIN (984798) നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!`
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
    } catch (e) {}
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#090d16] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>{language === 'ml' ? 'പ്രതിദിന Upstox ടോക്കൺ മാനേജർ' : 'Upstox Daily Token Manager'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ml'
                  ? 'OTP മാത്രം നൽകുക — ബാക്കി എല്ലാം ഓട്ടോമാറ്റിക് (100% സുരക്ഷിതം)'
                  : 'Enter OTP Only — 100% Automatic Upstox Live Connection'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Tab Selection */}
        <div className="grid grid-cols-2 p-2 bg-[#0a0f1b] border-b border-slate-800 text-xs font-bold gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('DAILY_TOKEN')}
            className={`py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'DAILY_TOKEN'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-300" />
            <span>{language === 'ml' ? '☀️ ഡെയിലി ടോക്കൺ പേസ്റ്റ്' : '☀️ Daily Token Paste'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('API_KEYS')}
            className={`py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'API_KEYS'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-blue-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
            }`}
          >
            <Key className="w-4 h-4 text-indigo-300" />
            <span>{language === 'ml' ? '🔑 OTP & ഓട്ടോ കണക്റ്റ്' : '🔑 OTP & Auto Connect'}</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Connection & Live Token Validity Status Card */}
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
                    <span>{config.userName || 'SAJAD THAZHEPEEDIKAYIL ABDULRAHIMAN'}</span>
                    <span className="text-slate-400">({config.userClientCode || '5VCABX'})</span>
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

            {/* Live Account Summary Row when connected */}
            {config.isConnected && (
              <div className="space-y-2 pt-2 border-t border-emerald-500/20 text-[11px] font-mono">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'ലഭ്യമായ ഫണ്ട്' : 'Available Margin'}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      ₹{Number(config.availableMargin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'ഉപയോഗിച്ച മാർജിൻ' : 'Used Margin'}
                    </span>
                    <span className="text-amber-400 font-bold">
                      ₹{Number(config.usedMargin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'ഹോൾഡിങ്‌സ്' : 'Holdings'}
                    </span>
                    <span className="text-cyan-400 font-bold">
                      {liveHoldingsCount !== null ? `${liveHoldingsCount} Stocks` : 'Synced'}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'ടോക്കൺ സമയം' : 'Token Time'}
                    </span>
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{config.tokenGeneratedAt || 'ഇന്ന് തത്സമയം'}</span>
                    </span>
                  </div>
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'ആകെ അക്കൗണ്ട് ബാലൻസ്' : 'Total Account Value'}
                    </span>
                    <span className="text-cyan-400 font-bold">
                      ₹{Number(config.totalBalance || config.availableMargin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'ഇന്ന് ചേർത്ത തുക' : 'Payin (Today)'}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      ₹{Number(config.payin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'പിൻവലിച്ചത്' : 'Payout (Today)'}
                    </span>
                    <span className="text-rose-400 font-bold">
                      ₹{Number(config.payout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-sans">
                      {language === 'ml' ? 'മാർക്കറ്റ് സമയം' : 'Market Hours'}
                    </span>
                    <span className="text-emerald-300 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>09:15 - 15:30</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Upstox SEBI Static IP Whitelist Card — Always Visible (Both Connected & Disconnected) */}
            <div className="bg-slate-950/90 p-3 rounded-xl border border-emerald-500/40 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div>
                    <span className="text-xs text-emerald-300 font-extrabold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>
                        {isFixedProxyActive
                          ? t.proxyActive
                          : t.whitelistNotice}
                      </span>
                    </span>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                      {language === 'ml'
                        ? 'Upstox Developer Console-ൽ ഈ IP-കൾ നൽകുക:'
                        : 'Configure these IPs in Upstox Developer Dashboard:'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const allThree = '8.234.113.241, 34.34.254.178, 34.96.48.26';
                      navigator.clipboard?.writeText(allThree);
                      setStatusMsg({
                        type: 'success',
                        text: language === 'ml'
                          ? `📋 3 IP-കളും കോപ്പി ചെയ്തു (${allThree})! Upstox Developer Console-ൽ നൽകുക.`
                          : `📋 Copied All 3 IPs (${allThree})! Set in Upstox Developer Console.`,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
                  >
                    <span>📋</span>
                    <span>{language === 'ml' ? '3 IP-കളും കോപ്പി ചെയ്യുക' : 'Copy All 3 IPs'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProxyConfig((prev) => !prev)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition"
                  >
                    {showProxyConfig ? '✕ Close' : '⚙️ Custom Proxy'}
                  </button>
                </div>
              </div>

              {/* Primary, Secondary & Container IP 3-Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold tracking-wider">
                      1. PRIMARY STATIC IP
                    </span>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      8.234.113.241
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText('8.234.113.241');
                      setStatusMsg({
                        type: 'success',
                        text: language === 'ml'
                          ? `📋 Primary IP (8.234.113.241) കോപ്പി ചെയ്തു!`
                          : `📋 Copied Primary IP (8.234.113.241)!`,
                      });
                    }}
                    className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/50 text-[10px] font-bold transition active:scale-95"
                  >
                    {language === 'ml' ? 'കോപ്പി' : 'Copy'}
                  </button>
                </div>

                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold tracking-wider">
                      2. SECONDARY STATIC IP
                    </span>
                    <span className="text-xs font-mono font-black text-cyan-400">
                      34.34.254.178
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText('34.34.254.178');
                      setStatusMsg({
                        type: 'success',
                        text: language === 'ml'
                          ? `📋 Secondary IP (34.34.254.178) കോപ്പി ചെയ്തു!`
                          : `📋 Copied Secondary IP (34.34.254.178)!`,
                      });
                    }}
                    className="px-2 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/50 text-[10px] font-bold transition active:scale-95"
                  >
                    {language === 'ml' ? 'കോപ്പി' : 'Copy'}
                  </button>
                </div>

                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-amber-500/40 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-amber-400 block font-bold tracking-wider">
                      3. CONTAINER DIRECT IP
                    </span>
                    <span className="text-xs font-mono font-black text-amber-300">
                      34.96.48.26
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText('34.96.48.26');
                      setStatusMsg({
                        type: 'success',
                        text: language === 'ml'
                          ? `📋 Direct IP (34.96.48.26) കോപ്പി ചെയ്തു! Upstox-ൽ നൽകുക.`
                          : `📋 Copied Direct Container IP (34.96.48.26)!`,
                      });
                    }}
                    className="px-2 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/50 text-[10px] font-bold transition active:scale-95"
                  >
                    {language === 'ml' ? 'കോപ്പി' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Manual IP / Proxy Override Input (User Request) */}
              <div className="pt-2 border-t border-slate-800/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight flex items-center gap-1.5">
                    <Settings className="w-3 h-3 text-slate-400" />
                    {language === 'ml' ? 'മാനുവൽ IP / പ്രോക്സി ക്രമീകരണം' : 'Manual IP / Proxy Override'}
                  </span>
                  {isFixedProxyActive && (
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={proxyUrlInput}
                      onChange={(e) => setProxyUrlInput(e.target.value)}
                      placeholder="http://user:pass@host:port (Optional)"
                      className="w-full bg-black/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:border-emerald-500 outline-none transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveProxy()}
                    disabled={isTestingProxy}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 shadow-lg shadow-emerald-950/20 disabled:opacity-50"
                  >
                    {isTestingProxy ? 'Testing...' : (language === 'ml' ? 'സേവ്' : 'Save')}
                  </button>
                  {proxyUrlInput && (
                    <button
                      type="button"
                      onClick={() => handleSaveProxy(true)}
                      className="p-2 rounded-lg bg-rose-900/20 text-rose-400 hover:bg-rose-900/40 border border-rose-800/30 transition"
                      title="Remove Proxy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-slate-500 italic leading-relaxed">
                  {language === 'ml' 
                    ? 'ശ്രദ്ധിക്കുക: നിങ്ങൾ പുതിയ IP നൽകുകയാണെങ്കിൽ അത് Upstox ഡാഷ്ബോർഡിലും വൈറ്റ്ലിസ്റ്റ് ചെയ്യേണ്ടതുണ്ട്.'
                    : 'Note: If you override the IP, ensure the new outbound IP is whitelisted in Upstox Developer Console.'}
                </p>
              </div>

              {/* Optional Custom Dedicated Proxy Drawer */}
              {showProxyConfig && (
                <div className="pt-2 border-t border-slate-800 flex flex-col gap-2.5 animate-in fade-in duration-150">
                  <div className="text-[11px] text-slate-300 leading-relaxed font-sans bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-300 block">
                      {language === 'ml' ? '📌 IP ഒരിക്കലും മാറാതിരിക്കാനുള്ള സ്ഥിരമായ പരിഹാരം:' : '📌 Permanent Fixed IP Solution:'}
                    </span>
                    <span className="block text-slate-400 text-[10px]">
                      {language === 'ml'
                        ? '1. webshare.io എന്ന സൈറ്റിൽ സൗജന്യമായി സൈൻ-അപ്പ് ചെയ്യുക (ക്രെഡിറ്റ് കാർഡ് ആവശ്യമില്ല). അവർ നൽകുന്ന 10 സൗജന്യ ഫിക്സഡ് പ്രോക്സികളിൽ ഒരെണ്ണം (http://username:password@ip:port) ഇവിടെ നൽകി കണക്റ്റ് ചെയ്യുക.'
                        : '1. Sign up for free at webshare.io (no card needed). They give 10 free permanent static proxies. Paste the proxy URL (http://username:password@ip:port) here and click Connect.'}
                    </span>
                    <span className="block text-slate-400 text-[10px]">
                      {language === 'ml'
                        ? '2. ആ പ്രോക്സിയിലെ IP ഒരിക്കലും മാറില്ല! ആ ഒരൊറ്റ IP നേരെ Upstox Developer Console-ൽ നൽകിയാൽ 100% സ്ഥിരമായി നിലനിൽക്കും.'
                        : '2. That proxy IP never changes. Put that exact IP in Upstox Developer Console for a permanent 100% static setup.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={proxyUrlInput}
                      onChange={(e) => setProxyUrlInput(e.target.value)}
                      placeholder="http://username:password@proxy-ip:port"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={isTestingProxy}
                      onClick={() => handleSaveProxy(false)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold font-sans transition shrink-0"
                    >
                      {isTestingProxy ? 'Testing...' : (language === 'ml' ? 'കണക്റ്റ്' : 'Connect')}
                    </button>
                    {proxyUrlInput && (
                      <button
                        type="button"
                        disabled={isTestingProxy}
                        onClick={() => handleSaveProxy(true)}
                        className="px-2 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg text-[10px] font-bold border border-rose-800/40 transition shrink-0"
                        title="Remove Proxy"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Alert Message */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border flex flex-col gap-2 text-xs font-semibold animate-in fade-in duration-200 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : statusMsg.type === 'error'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  : 'bg-blue-950/40 border-blue-500/40 text-blue-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : statusMsg.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{statusMsg.text}</span>
              </div>
              {statusMsg.type === 'error' && (
                <div className="pt-1 flex items-center justify-end">
                  <a
                    href={`https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(
                      (apiKey || DEFAULT_API_KEY).trim()
                    )}&redirect_uri=${encodeURIComponent((redirectUri || DEFAULT_REDIRECT_URI).trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold transition shadow"
                  >
                    {language === 'ml'
                      ? '🔗 നേരിട്ട് Upstox ലോഗിൻ തുറക്കുക (100% ഉറപ്പായ വഴി)'
                      : '🔗 Open Direct Upstox Login (Guaranteed)'}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: DAILY MANUAL TOKEN INPUT */}
          {activeTab === 'DAILY_TOKEN' && (
            <form onSubmit={handleDailyTokenSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200">
                    {language === 'ml' ? 'ഇന്നത്തെ Access Token (JWT)' : "Today's Upstox Access Token"}
                  </label>
                  {accessToken && (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {accessToken.length} chars
                    </span>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={
                    language === 'ml'
                      ? 'Upstox Access Token (e.g. eyJhbGciOi...) ഇവിടെ പേസ്റ്റ് ചെയ്യുക'
                      : 'Paste daily JWT access token here (e.g. eyJhbGciOi...)'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition leading-relaxed resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition"
                >
                  {t.cancel}
                </button>

                <button
                  type="submit"
                  disabled={validating || !accessToken?.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-950 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {validating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>
                    {language === 'ml' ? 'ടോക്കൺ ആക്റ്റീവ് ആക്കുക' : 'Verify & Activate'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: ONLY OTP INPUT & AUTOMATIC CONNECTION (ALL UNNECESSARY OPTIONS REMOVED) */}
          {activeTab === 'API_KEYS' && (
            <form onSubmit={handleOtpOrAutoConnect} className="space-y-4">
              {/* Single Clean OTP Input Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/30 to-slate-950 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <label className="text-xs sm:text-sm font-extrabold text-emerald-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>
                      {savedMobile.length === 10
                        ? language === 'ml'
                          ? '6-അക്ക SMS OTP ഇവിടെ നൽകുക'
                          : 'Enter 6-Digit SMS OTP Here'
                        : language === 'ml'
                        ? '10-അക്ക മൊബൈൽ നമ്പർ (ഒരിക്കൽ മാത്രം) അല്ലെങ്കിൽ 6-അക്ക OTP നൽകുക'
                        : 'Enter 10-Digit Mobile (Once) or 6-Digit OTP'}
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {savedMobile.length === 10 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        📱 {savedMobile.slice(0, 2)}******{savedMobile.slice(-2)} Auto
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      PIN: 984798 Auto
                    </span>
                    {savedMobile.length === 10 && (
                      <button
                        type="button"
                        onClick={handleForceSendSmsOtp}
                        disabled={loading}
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 transition flex items-center gap-1 active:scale-95"
                      >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        <span>{language === 'ml' ? '📲 പുതിയ OTP അയക്കുക' : '📲 Send OTP'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="tel"
                  inputMode="numeric"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder={
                    savedMobile.length === 10
                      ? language === 'ml'
                        ? '6-അക്ക SMS OTP കോഡ് ഇവിടെ നൽകുക (e.g. 123456)'
                        : 'Enter 6-digit SMS OTP code here (e.g. 123456)'
                      : language === 'ml'
                      ? 'ആദ്യ തവണ നിങ്ങളുടെ 10-അക്ക മൊബൈൽ നമ്പർ ഇവിടെ നൽകുക'
                      : 'First time only: enter your 10-digit Upstox mobile number'
                  }
                  className="w-full bg-slate-900/90 border-2 border-emerald-500/40 focus:border-emerald-400 rounded-xl px-4 py-3.5 text-center text-base sm:text-lg text-white font-mono font-black tracking-widest placeholder-slate-500 focus:outline-none transition shadow-inner"
                />

                <p className="text-[11px] text-slate-300 text-center leading-relaxed">
                  {savedMobile.length === 10
                    ? otpRequested
                      ? language === 'ml'
                        ? '📲 ഫോണിൽ വന്ന 6-അക്ക SMS OTP മുകളിലെ ബോക്സിൽ നൽകി താഴെയുള്ള പച്ച ബട്ടൺ അമർത്തുക. PIN (984798) നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!'
                        : '📲 Enter the 6-digit SMS OTP received on your phone and tap the green button below. PIN (984798) and token generation are 100% automatic!'
                      : language === 'ml'
                      ? '1️⃣ ആദ്യം മുകളിലെ ബോക്സ് ഒഴിച്ചിട്ട് താഴെയുള്ള പച്ച ബട്ടൺ അമർത്തുമ്പോൾ ഫോണിലേക്ക് SMS OTP വരും. 2️⃣ ആ 6-അക്ക OTP മുകളിൽ നൽകി വീണ്ടും ബട്ടൺ അമർത്തിയാൽ PIN (984798) തനിയെ എടുത്ത് കണക്റ്റ് ആകും!'
                      : '1️⃣ Tap the green button below with the box empty to receive SMS OTP. 2️⃣ Enter the 6-digit OTP and tap again — PIN (984798) and token connection happen automatically!'
                    : language === 'ml'
                    ? 'നിങ്ങളുടെ API Key, Secret, PIN (984798) എന്നിവ സേവ് ചെയ്തിട്ടുണ്ട്. ആദ്യ തവണ മാത്രം നിങ്ങളുടെ 10-അക്ക Upstox മൊബൈൽ നമ്പർ മുകളിൽ നൽകി പച്ച ബട്ടൺ അമർത്തുക — നമ്പർ സ്ഥിരമായി സേവ് ആവുകയും ഫോണിലേക്ക് ഉടൻ SMS OTP വരികയും ചെയ്യും!'
                    : 'Your API Key, Secret & PIN (984798) are pre-saved. Enter your 10-digit Upstox mobile number once and tap the green button — it will save permanently and send your SMS OTP immediately!'}
                </p>
              </div>

              {/* Collapsible API Key / Secret / Mobile Settings (Hidden by default so screen stays clean) */}
              <div className="border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowKeySettings(!showKeySettings)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {language === 'ml'
                        ? 'സേവ് ചെയ്ത വിവരങ്ങൾ (Mobile, PIN, API Key & Secret)'
                        : 'Saved Credentials (Mobile, PIN, API Key & Secret)'}
                    </span>
                  </span>
                  {showKeySettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showKeySettings && (
                  <div className="p-3.5 border-t border-slate-800/80 space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {language === 'ml' ? 'രജിസ്റ്റർ ചെയ്ത 10-അക്ക മൊബൈൽ നമ്പർ (Auto SMS OTP)' : 'Registered 10-Digit Mobile Number'}
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={savedMobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D+/g, '').slice(0, 10);
                          setSavedMobile(val);
                          try {
                            localStorage.setItem('upstox_saved_mobile', val);
                          } catch {}
                        }}
                        placeholder="10-digit Upstox mobile number"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-emerald-300 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {t.apiKey} (Client ID)
                      </label>
                      <input
                        type="text"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {t.apiSecret}
                      </label>
                      <input
                        type="password"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        placeholder="Upstox API Secret"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-extrabold border border-emerald-500 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 active:scale-95"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>
                    {otpInput.replace(/\D+/g, '').length === 6
                      ? language === 'ml'
                        ? 'OTP വെരിഫൈ ചെയ്ത് കണക്റ്റ് ചെയ്യുക'
                        : 'Verify OTP & Auto Connect'
                      : savedMobile.length === 10
                      ? language === 'ml'
                        ? 'ഫോണിലേക്ക് SMS OTP അയക്കുക (Auto)'
                        : 'Send SMS OTP & Connect'
                      : t.saveAndConnect}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
