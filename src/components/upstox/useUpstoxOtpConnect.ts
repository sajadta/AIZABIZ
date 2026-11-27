// SMS-OTP connect flow: one-click OTP request plus OTP/auth-code verification handlers
// used by the Upstox modal.
import type { Language, UpstoxApiConfig } from '../../types';
import {
  DEFAULT_API_KEY,
  DEFAULT_API_SECRET,
  DEFAULT_MOBILE,
  cleanMobile,
  clearOtpSessionBackup,
  createOtpPoster,
  getFallbackRedirectUri,
  persistAccessToken,
  persistOtpSessionBackup,
  persistSavedMobile,
  readOtpSessionBackup,
} from './upstoxOtpApi';
import type { OtpSessionBackup } from './upstoxOtpApi';
import { errorMessage } from '../../utils/errors';

export interface UpstoxOtpConnectParams {
  language: Language;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  savedMobile: string;
  otpInput: string;
  otpSessionBackup: OtpSessionBackup | null;
  setAccessToken: (token: string) => void;
  setOtpInput: (value: string) => void;
  setOtpRequested: (value: boolean) => void;
  setOtpSessionBackup: (value: OtpSessionBackup | null) => void;
  setSavedMobile: (value: string) => void;
  setLoading: (value: boolean) => void;
  setStatusMsg: (msg: { type: 'success' | 'error' | 'info'; text: string } | null) => void;
  onSaveConfig: (cfg: Partial<UpstoxApiConfig>) => Promise<void>;
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
  const postWithAutoRetryAndRelay = createOtpPoster(language);

  const resolvedKey = () => (apiKey || DEFAULT_API_KEY).trim();
  const resolvedUri = () => (redirectUri || getFallbackRedirectUri()).trim();
  const resolvedSecret = () => apiSecret || DEFAULT_API_SECRET;

  const requestSmsOtp = async (mobile: string) =>
    postWithAutoRetryAndRelay('/api/market/send-sms-otp', {
      mobile,
      apiKey: resolvedKey(),
      apiSecret: resolvedSecret(),
      redirectUri: resolvedUri(),
      pin: '',
    });

  const storeSessionBackup = (backup: OtpSessionBackup | null | undefined) => {
    if (!backup) return;
    setOtpSessionBackup(backup);
    persistOtpSessionBackup(backup);
  };

  const connectWithToken = async (payload: {
    accessToken: string;
    userName: string;
    userClientCode: string;
    message: string;
  }) => {
    setAccessToken(payload.accessToken);
    setOtpInput('');
    setOtpRequested(false);
    setOtpSessionBackup(null);
    clearOtpSessionBackup();
    persistAccessToken(payload.accessToken);
    await onSaveConfig({
      accessToken: payload.accessToken,
      isConnected: true,
      userName: payload.userName,
      userClientCode: payload.userClientCode,
      todayTokenValid: true,
    });
    if (onRefreshPortfolio) onRefreshPortfolio();
    setStatusMsg({ type: 'success', text: payload.message });
  };

  // Dedicated 1-click SMS OTP sender (works even if OTP box has text)
  const handleForceSendSmsOtp = async () => {
    setLoading(true);
    setStatusMsg(null);
    const mobile = cleanMobile(savedMobile || DEFAULT_MOBILE);

    try {
      const { ok, data: otpData } = await requestSmsOtp(mobile);
      if (ok && otpData.success) {
        setOtpInput('');
        setOtpRequested(true);
        storeSessionBackup(otpData.sessionBackup);
        setStatusMsg({
          type: 'success',
          text:
            language === 'ml'
              ? `📲 നിങ്ങളുടെ ഫോണിലേക്ക് (${mobile.slice(0, 2)}******${mobile.slice(-2)}) പുതിയ 6-അക്ക Upstox SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP താഴെ നൽകി പച്ച ബട്ടൺ അമർത്തുക!`
              : '📲 Fresh 6-digit SMS OTP sent to your phone! Enter the OTP below and tap the green button!',
        });
      } else {
        throw new Error(otpData?.error || 'Failed to send SMS OTP');
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: errorMessage(err) || 'Connection failed',
      });
    } finally {
      setLoading(false);
    }
  };

  // Tab 2: Single automatic handler for:
  // 1) Auto-sending the SMS OTP using the saved mobile number
  // 2) Verifying the 6-digit OTP -> submitting PIN -> generating the access token
  const handleOtpOrAutoConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    const trimmedInput = otpInput.trim();
    const digitsOnly = trimmedInput.replace(/\D+/g, '');

    try {
      // CASE A: User typed their 10-digit mobile number (one-time setup):
      // save it permanently and immediately send an SMS OTP.
      if (/^[6-9]\d{9}$/.test(digitsOnly)) {
        setSavedMobile(digitsOnly);
        persistSavedMobile(digitsOnly);

        const { ok, data: otpData } = await requestSmsOtp(digitsOnly);
        if (ok && otpData.success) {
          setOtpInput('');
          setOtpRequested(true);
          storeSessionBackup(otpData.sessionBackup);
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

      // CASE B: User entered the 6-digit OTP -> verify OTP, auto-submit PIN, generate token.
      if (/^\d{6}$/.test(digitsOnly)) {
        const backupToUse = otpSessionBackup || readOtpSessionBackup();
        const { ok, data } = await postWithAutoRetryAndRelay('/api/market/totp-login', {
          totp: digitsOnly,
          pin: '',
          mobile: savedMobile || DEFAULT_MOBILE,
          apiKey: resolvedKey(),
          apiSecret: resolvedSecret(),
          sessionBackup: backupToUse,
        });
        if (ok && data.success && data.accessToken) {
          await connectWithToken({
            accessToken: data.accessToken,
            userName: data.userName || '',
            userClientCode: data.userClientCode || '',
            message:
              data.message ||
              (language === 'ml'
                ? '🎉 OTP പരിശോധിച്ചു, PIN ഓട്ടോമാറ്റിക്കായി നൽകി, പുതിയ ടോക്കൺ ജനറേറ്റ് ചെയ്ത് അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!'
                : '🎉 OTP Verified, PIN auto-submitted, and Upstox account connected live!'),
          });
          setLoading(false);
          return;
        }
        throw new Error(data?.error || 'OTP verification failed');
      }

      // CASE C: User pasted a redirected URL or auth code.
      if (trimmedInput.length > 6) {
        const { ok, data } = await postWithAutoRetryAndRelay('/api/market/token', {
          code: trimmedInput,
          apiKey: resolvedKey(),
          apiSecret: resolvedSecret(),
          redirectUri: resolvedUri(),
        });
        if (ok && data.accessToken) {
          await connectWithToken({
            accessToken: data.accessToken,
            userName: data.user_name || '',
            userClientCode: data.user_id || '',
            message:
              language === 'ml'
                ? '🎉 പുതിയ Access Token ജനറേറ്റ് ചെയ്ത് ലൈവ് ആയി കണക്റ്റായി!'
                : '🎉 Access Token generated and connected live!',
          });
          setLoading(false);
          return;
        }
        throw new Error(data?.error || 'Invalid code');
      }

      // CASE D: OTP box is empty -> request an SMS OTP automatically.
      const mobile = cleanMobile(savedMobile || DEFAULT_MOBILE);
      if (mobile.length === 10) {
        const { ok, data: otpData } = await requestSmsOtp(mobile);
        if (ok && otpData.success) {
          setOtpRequested(true);
          storeSessionBackup(otpData.sessionBackup);
          setStatusMsg({
            type: 'success',
            text:
              language === 'ml'
                ? `📲 നിങ്ങളുടെ ഫോണിലേക്ക് (${mobile.slice(0, 2)}******${mobile.slice(-2)}) Upstox 6-അക്ക SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP മാത്രം താഴെ നൽകി വീണ്ടും ബട്ടൺ അമർത്തുക — PIN നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!`
                : '📲 6-digit SMS OTP sent to your phone! Enter the OTP below and tap Save & Connect!',
          });
          setLoading(false);
          return;
        }
        throw new Error(otpData?.error || 'Failed to send SMS OTP');
      }

      setStatusMsg({
        type: 'info',
        text:
          language === 'ml'
            ? '📱 ആദ്യ തവണ മാത്രം നിങ്ങളുടെ 10-അക്ക Upstox മൊബൈൽ നമ്പർ താഴെയുള്ള ബോക്സിൽ നൽകി "സേവ് ചെയ്തു കണക്റ്റ് ചെയ്യുക" അമർത്തുക. ആപ്പ് നമ്പർ സ്ഥിരമായി സേവ് ചെയ്ത് ഉടൻ ഫോണിലേക്ക് SMS OTP അയക്കും!'
            : '📱 For the first time only, enter your 10-digit Upstox mobile number in the box below and tap Save & Connect. It will be saved permanently and an SMS OTP will be sent immediately!',
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: errorMessage(err) || 'Connection failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return { handleForceSendSmsOtp, handleOtpOrAutoConnect };
}
