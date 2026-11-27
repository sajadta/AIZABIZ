// PATH A of the Upstox TOTP login: finish steps 3-5 using an active automated SMS
// OTP session (verify OTP, submit PIN, authorize OAuth, exchange the token).
import type { Response } from 'express';
import {
  otpSessionState,
  fetchUpstoxWithRetry,
  buildUpstoxBrowserHeaders,
  mergeSetCookies,
} from '../otpSession';
import {
  upstoxConfig,
  botConfig,
  invalidTokens,
  setCachedUpstoxLivePositions,
} from '../../../state';
import { saveTokenBackupToDisk } from '../../../lib/tokens';
import { savePostgresDb } from '../../../services/persistence';
import { publishTokenToCloudRelay, resetVerifiedTokenCache } from '../../../services/tokenSync';

export interface AutoOtpLoginContext {
  res: Response;
  cleanTotp: string;
  cleanPin: string;
}

/** Returns true when this handler already sent a response. */
export async function completeAutoOtpLogin({
  res,
  cleanTotp,
  cleanPin,
}: AutoOtpLoginContext): Promise<boolean> {
  // PATH A: If we have an active Automated SMS OTP session, complete Steps 3, 4, 5 automatically!
  const candidateSessions = [
    ...(otpSessionState.active ? [otpSessionState.active] : []),
    ...otpSessionState.recent.filter(
      (s) =>
        s.validateOtpToken !== otpSessionState.active?.validateOtpToken &&
        Date.now() - (s.createdAt || Date.now()) < 20 * 60 * 1000,
    ),
  ];

  if (candidateSessions.length > 0) {
    try {
      let sess = candidateSessions[0];
      let verifyData: any = null;

      for (const candidate of candidateSessions) {
        sess = candidate;
        // Step 3: Verify the 6-digit SMS OTP (/login/open/v5/auth/1fa/otp-totp/verify)
        let verifyRes = await fetchUpstoxWithRetry(
          'https://service.upstox.com/login/open/v5/auth/1fa/otp-totp/verify',
          {
            method: 'POST',
            headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies),
            body: JSON.stringify({
              data: {
                otp: cleanTotp,
                validateOtpToken: sess.validateOtpToken,
              },
            }),
          },
          2,
        );
        mergeSetCookies(sess.cookies, verifyRes);
        verifyData = await verifyRes.json();

        if (!verifyData.success && verifyRes.status === 404) {
          verifyRes = await fetchUpstoxWithRetry(
            'https://service.upstox.com/login/open/v4/auth/1fa/otp-totp/verify',
            {
              method: 'POST',
              headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies),
              body: JSON.stringify({
                data: {
                  otp: cleanTotp,
                  validateOtpToken: sess.validateOtpToken,
                },
              }),
            },
            2,
          );
          mergeSetCookies(sess.cookies, verifyRes);
          verifyData = await verifyRes.json();
        }

        if (verifyData?.success) {
          break;
        }
      }

      const pinToUse = cleanPin || sess.pin || process.env.UPSTOX_PIN || '';
      const secretToUse =
        upstoxConfig.apiSecret || sess.apiSecret || process.env.UPSTOX_API_SECRET || '';

      if (!verifyData?.success) {
        res.status(400).json({
          success: false,
          error:
            verifyData?.error?.message ||
            'നൽകിയ OTP തെറ്റാണ് അല്ലെങ്കിൽ സമയം കഴിഞ്ഞു. വീണ്ടും ശ്രമിക്കുക.',
        });
        return true;
      }

      // Extract profileId and userId if returned by OTP verification
      const profileId =
        verifyData.data?.userProfile?.profileId ||
        verifyData.data?.accounts?.[0]?.profileId ||
        sess.cookies['profile_id'] ||
        '';
      const verifiedUserId =
        verifyData.data?.userProfile?.userId ||
        verifyData.data?.accounts?.[0]?.userId ||
        sess.cookies['user_id'] ||
        '';

      const pinHeaders: Record<string, string> = {};
      if (profileId) pinHeaders['X-Profile-Id'] = String(profileId);
      if (verifiedUserId) pinHeaders['X-User-Id'] = String(verifiedUserId);

      // Step 4: Automatically submit 6-digit PIN in base64 (/login/open/v3/auth/2fa)
      const encodedPin = Buffer.from(pinToUse, 'utf-8').toString('base64');
      const upstoxInternalRedirect = 'https://api-v2.upstox.com/login/authorization/redirect';
      const twoFaUrl = `https://service.upstox.com/login/open/v3/auth/2fa?client_id=${encodeURIComponent(sess.internalClientId)}&redirect_uri=${encodeURIComponent(upstoxInternalRedirect)}`;

      const twoFaRes = await fetchUpstoxWithRetry(twoFaUrl, {
        method: 'POST',
        headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies, pinHeaders),
        body: JSON.stringify({
          data: {
            twoFAMethod: 'SECRET_PIN',
            inputText: encodedPin,
          },
        }),
      });
      mergeSetCookies(sess.cookies, twoFaRes);
      const twoFaData = await twoFaRes.json();

      if (!twoFaData.success) {
        res.status(400).json({
          success: false,
          error: twoFaData.error?.message || 'OTP ശരിയായിരുന്നു, എന്നാൽ PIN പരിശോധന പരാജയപ്പെട്ടു.',
        });
        return true;
      }

      // Check if 2FA response already gave redirectUri with ?code=
      let finalRedirectUri = twoFaData.data?.redirectUri || '';

      // Step 5: If redirectUri not yet returned, automatically call /login/v2/oauth/authorize
      if (!finalRedirectUri || !finalRedirectUri.includes('code=')) {
        const oauthUrl = `https://service.upstox.com/login/v2/oauth/authorize?client_id=${encodeURIComponent(sess.internalClientId)}&redirect_uri=${encodeURIComponent(upstoxInternalRedirect)}&requestId=${encodeURIComponent(sess.requestId)}&response_type=code`;
        const oauthRes = await fetchUpstoxWithRetry(oauthUrl, {
          method: 'POST',
          headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies, pinHeaders),
          body: JSON.stringify({
            data: {
              userOAuthApproval: true,
            },
          }),
        });
        mergeSetCookies(sess.cookies, oauthRes);
        const oauthData = await oauthRes.json();
        if (oauthData.success && oauthData.data?.redirectUri) {
          finalRedirectUri = oauthData.data.redirectUri;
        }
      }

      // Extract ?code= from finalRedirectUri
      let authCode = '';
      if (finalRedirectUri) {
        try {
          const parsedRedirect = new URL(finalRedirectUri);
          authCode = parsedRedirect.searchParams.get('code') || '';
        } catch {
          const m = finalRedirectUri.match(/[?&]code=([^&#\s]+)/);
          if (m && m[1]) authCode = decodeURIComponent(m[1]);
        }
      }

      if (!authCode) {
        res.status(400).json({
          success: false,
          error:
            'OTP-യും PIN-ഉം ശരിയായിരുന്നു, എന്നാൽ Authorization Code ലഭിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.',
        });
        return true;
      }

      // Step 6: Automatically exchange ?code= for the live JWT access_token!
      const candidateSecrets = Array.from(
        new Set(
          [
            secretToUse,
            upstoxConfig.apiSecret,
            process.env.UPSTOX_API_SECRET_FALLBACK || '',
          ].filter(Boolean),
        ),
      );
      let tokenData: any = null;

      for (const candSecret of candidateSecrets) {
        const tokenParams = new URLSearchParams();
        tokenParams.append('code', authCode.trim());
        tokenParams.append('client_id', sess.apiKey);
        tokenParams.append('client_secret', candSecret);
        tokenParams.append('redirect_uri', sess.redirectUri);
        tokenParams.append('grant_type', 'authorization_code');

        try {
          const tokenRes = await fetchUpstoxWithRetry(
            'https://api.upstox.com/v2/login/authorization/token',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                'Api-Version': '2.0',
              },
              body: tokenParams.toString(),
            },
          );
          const resJson = await tokenRes.json();
          if (resJson?.access_token) {
            tokenData = resJson;
            upstoxConfig.apiSecret = candSecret;
            break;
          } else {
            tokenData = resJson;
          }
        } catch (e) {
          // Ignored
        }
      }

      if (tokenData?.access_token) {
        otpSessionState.active = null;
        upstoxConfig.accessToken = tokenData.access_token;
        upstoxConfig.userName = tokenData.user_name || process.env.UPSTOX_USER_NAME || '';
        upstoxConfig.userEmail = tokenData.email || upstoxConfig.userEmail || '';
        upstoxConfig.userClientCode = tokenData.user_id || process.env.UPSTOX_CLIENT_CODE || '';
        upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString('en-IN');
        upstoxConfig.tokenExpiresAt = 'Tomorrow 03:30 AM';
        if (!botConfig.userExplicitlySelectedMode) {
          botConfig.mode = 'UPSTOX_LIVE';
        }
        invalidTokens.delete(tokenData.access_token);
        resetVerifiedTokenCache();
        setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
        saveTokenBackupToDisk(tokenData.access_token, upstoxConfig);
        await savePostgresDb().catch(() => {
          /* ignore */
        });
        publishTokenToCloudRelay(tokenData.access_token).catch(() => {
          /* ignore */
        });

        res.json({
          success: true,
          accessToken: tokenData.access_token,
          userName: upstoxConfig.userName,
          userClientCode: upstoxConfig.userClientCode,
          message:
            '🎉 OTP പരിശോധിച്ചു, PIN ഓട്ടോമാറ്റിക്കായി നൽകി, പുതിയ ടോക്കൺ ജനറേറ്റ് ചെയ്ത് അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!',
        });
        return true;
      } else {
        res.status(400).json({
          success: false,
          error:
            tokenData?.errors?.[0]?.message ||
            tokenData?.message ||
            'ടോക്കൺ എക്സ്ചേഞ്ച് പരാജയപ്പെട്ടു. API Secret & Redirect URI പരിശോധിക്കുക.',
        });
        return true;
      }
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'ഓട്ടോമാറ്റിക് OTP + PIN ലോഗിൻ പിശക്: ' + err.message,
      });
      return true;
    }
  }
  return false;
}
