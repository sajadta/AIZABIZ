// Step 3-5: verify the 6-digit OTP, submit the PIN, authorize OAuth and exchange the token.
import type { Request, Response } from 'express';
import { otpSessionState } from '../otpSession';
import { upstoxConfig } from '../../../state';
import { completeAutoOtpLogin } from './totpLoginAutoOtp';
import { completeDirectTotpLogin } from './totpLoginDirect';

export function registerTotpLoginRoutes(app: any) {
  app.post('/api/market/totp-login', async (req: Request, res: Response) => {
    const { totp, pin, apiKey, apiSecret, mobile, sessionBackup } = req.body;
    const cleanTotp = String(totp || '')
      .replace(/\D+/g, '')
      .trim();
    const cleanPin = String(pin || upstoxConfig.pin || process.env.UPSTOX_PIN || '').trim();
    const key = String(apiKey || upstoxConfig.apiKey || process.env.UPSTOX_API_KEY || '').trim();
    if (apiSecret && apiSecret !== '••••••••' && apiSecret.trim() !== '') {
      upstoxConfig.apiSecret = apiSecret.trim();
    }
    if (!upstoxConfig.apiSecret || upstoxConfig.apiSecret.includes('•')) {
      upstoxConfig.apiSecret = process.env.UPSTOX_API_SECRET || '';
    }
    if (mobile && String(mobile).replace(/\D+/g, '').length >= 10) {
      upstoxConfig.mobile = String(mobile).replace(/\D+/g, '').slice(-10);
    }
    if (cleanPin) upstoxConfig.pin = cleanPin;
    if (key) upstoxConfig.apiKey = key;

    if (!cleanTotp || cleanTotp.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'ദയവായി ഫോണിൽ വന്ന 6-അക്ക OTP കോഡ് നൽകുക (Please enter the 6-digit OTP code).',
      });
    }

    // Restore session from client backup if Render restarted between sending OTP and entering OTP
    if (sessionBackup && sessionBackup.validateOtpToken) {
      otpSessionState.active = sessionBackup;
      otpSessionState.recent = [
        sessionBackup,
        ...otpSessionState.recent.filter(
          (s) => s.validateOtpToken !== sessionBackup.validateOtpToken,
        ),
      ].slice(0, 10);
    } else if (!otpSessionState.active && otpSessionState.recent.length > 0) {
      otpSessionState.active = otpSessionState.recent[0];
    }

    // PATH A: complete steps 3-5 automatically when an SMS OTP session is active.
    const handledByAutoOtp = await completeAutoOtpLogin({
      res,
      cleanTotp,
      cleanPin,
    });
    if (handledByAutoOtp) return;

    // PATH B: fall back to direct TOTP login when no SMS OTP session exists.
    return completeDirectTotpLogin({ res, cleanTotp, cleanPin, apiKey: key });
  });
}
