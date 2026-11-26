// Low-level helpers for the Upstox SMS-OTP connect flow: resilient API posting,
// session-backup persistence and token storage.
import type { Language } from '../../types';

export const DEFAULT_API_KEY = '3ab5711d-8891-480b-b0c1-29662852de49';
export const DEFAULT_API_SECRET = 'jl5s7qy9r0';
export const DEFAULT_MOBILE = '9847989434';

export const getFallbackRedirectUri = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/market/callback`;
  }
  return 'http://localhost:3000/api/market/callback';
};

export type OtpPostResult = { ok: boolean; data: any };

export type OtpPoster = (endpoint: string, payload: any) => Promise<OtpPostResult>;

/** Builds a POST helper that reports transport failures as a localized error object. */
export const createOtpPoster = (language: Language): OtpPoster => {
  return async (endpoint, payload) => {
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
};

const OTP_BACKUP_STORAGE_KEY = 'upstox_otp_session_backup';

export const persistOtpSessionBackup = (backup: any): void => {
  if (!backup) return;
  try {
    localStorage.setItem(OTP_BACKUP_STORAGE_KEY, JSON.stringify(backup));
  } catch {
    /* ignored */
  }
};

export const readOtpSessionBackup = (): any => {
  try {
    const raw = localStorage.getItem(OTP_BACKUP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearOtpSessionBackup = (): void => {
  try {
    localStorage.removeItem(OTP_BACKUP_STORAGE_KEY);
  } catch {
    /* ignored */
  }
};

/** Persists the generated token so the app can reuse it for the rest of the day. */
export const persistAccessToken = (token: string): void => {
  try {
    localStorage.setItem('upstox_daily_token', token);
    localStorage.setItem('upstox_token_date', new Date().toLocaleDateString('en-IN'));
  } catch {
    /* ignored */
  }
};

export const persistSavedMobile = (mobile: string): void => {
  try {
    localStorage.setItem('upstox_saved_mobile', mobile);
  } catch {
    /* ignored */
  }
};

export const cleanMobile = (mobile: string): string => mobile.replace(/\D+/g, '').slice(-10);
