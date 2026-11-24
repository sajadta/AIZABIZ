// SMS-OTP connect flow: resilient API helper plus the one-click OTP request and
// OTP/auth-code verification handlers used by the Upstox modal.
import type { Language } from '../../types';

const DEFAULT_API_KEY = '3ab5711d-8891-480b-b0c1-29662852de49';
const DEFAULT_API_SECRET = 'jl5s7qy9r0';
const DEFAULT_MOBILE = '9847989434';

const getFallbackRedirectUri = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/market/callback`;
  }
  return 'http://localhost:3000/api/market/callback';
};

export interface UpstoxOtpConnectParams {
  language: Language;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  savedMobile: string;
  otpInput: string;
  otpSessionBackup: any;
  setAccessToken: (token: string) => void;
  setOtpInput: (value: string) => void;
  setOtpRequested: (value: boolean) => void;
  setOtpSessionBackup: (value: any) => void;
  setSavedMobile: (value: string) => void;
  setLoading: (value: boolean) => void;
  setStatusMsg: (msg: { type: 'success' | 'error' | 'info'; text: string } | null) => void;
  onSaveConfig: (cfg: any) => Promise<void>;
  onRefreshPortfolio?: () => void;
}

export function useUpstoxOtpConnect({
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
}: UpstoxOtpConnectParams) {
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
  return { handleForceSendSmsOtp, handleOtpOrAutoConnect };
}
