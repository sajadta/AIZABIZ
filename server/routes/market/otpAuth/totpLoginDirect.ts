// PATH B of the Upstox TOTP login: direct TOTP login used when the caller never
// started an automated SMS OTP session.
import type { Response } from 'express';
import {
  upstoxConfig,
  botConfig,
  invalidTokens,
  setCachedUpstoxLivePositions,
} from '../../../state';
import { saveTokenBackupToDisk } from '../../../lib/tokens';
import { savePostgresDb } from '../../../services/persistence';
import { publishTokenToCloudRelay, resetVerifiedTokenCache } from '../../../services/tokenSync';

export interface DirectTotpLoginContext {
  res: Response;
  cleanTotp: string;
  cleanPin: string;
  apiKey: string;
}

export async function completeDirectTotpLogin({
  res,
  cleanTotp,
  cleanPin,
  apiKey: key,
}: DirectTotpLoginContext): Promise<unknown> {
  // PATH B: Fallback to direct TOTP login if user didn't initiate an SMS OTP session
  try {
    const response = await fetch('https://api.upstox.com/v2/totp-login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': key,
        'Api-Version': '2.0',
      },
      body: JSON.stringify({
        totp: cleanTotp,
        pin: cleanPin,
      }),
    });

    const data = await response.json();
    const token = data.access_token || data.data?.access_token;

    if (token) {
      upstoxConfig.accessToken = token;
      upstoxConfig.userName =
        data.user_name || data.data?.user_name || process.env.UPSTOX_USER_NAME || '';
      upstoxConfig.userEmail = data.email || data.data?.email || upstoxConfig.userEmail || '';
      upstoxConfig.userClientCode =
        data.user_id || data.data?.user_id || process.env.UPSTOX_CLIENT_CODE || '';
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString('en-IN');
      upstoxConfig.tokenExpiresAt = 'Tomorrow 03:30 AM';
      if (!botConfig.userExplicitlySelectedMode) {
        botConfig.mode = 'UPSTOX_LIVE';
      }
      invalidTokens.delete(token);
      resetVerifiedTokenCache();
      setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
      saveTokenBackupToDisk(token, upstoxConfig);
      await savePostgresDb().catch(() => {
        /* ignore */
      });
      publishTokenToCloudRelay(token).catch(() => {
        /* ignore */
      });

      return res.json({
        success: true,
        accessToken: token,
        userName: upstoxConfig.userName,
        userClientCode: upstoxConfig.userClientCode,
      });
    } else {
      const errMsg =
        data.errors?.[0]?.message ||
        data.message ||
        "ആദ്യം OTP ബോക്സ് ഒഴിച്ചിട്ട് 'സേവ് ചെയ്തു കണക്റ്റ് ചെയ്യുക' അമർത്തി ഫോണിലേക്ക് SMS OTP വരുത്തുക, എന്നിട്ട് ആ 6-അക്ക OTP ഇവിടെ നൽകുക.";
      return res.status(400).json({
        success: false,
        error: errMsg,
        details: data,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to contact Upstox OTP endpoint: ' + err.message,
    });
  }
}
