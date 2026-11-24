// Step 3-5: verify the 6-digit OTP, submit the PIN, authorize OAuth and exchange the token.
import type { Request, Response } from "express";
import { otpSessionState, fetchUpstoxWithRetry, buildUpstoxBrowserHeaders, mergeSetCookies, type UpstoxAutoOtpSession } from "../otpSession";
import { upstoxConfig, botConfig, invalidTokens, setCachedUpstoxLivePositions } from "../../../state";
import { saveTokenBackupToDisk } from "../../../lib/tokens";
import { savePostgresDb } from "../../../services/persistence";
import { publishTokenToCloudRelay, resetVerifiedTokenCache } from "../../../services/tokenSync";
import { safeParseJsonResponse } from "./parseJson";

export function registerTotpLoginRoutes(app: any) {
  app.post("/api/market/totp-login", async (req: Request, res: Response) => {
    const { totp, pin, apiKey, apiSecret, mobile, sessionBackup } = req.body;
    const cleanTotp = String(totp || "").replace(/\D+/g, "").trim();
    const cleanPin = String(pin || upstoxConfig.pin || process.env.UPSTOX_PIN || "").trim();
    const key = String(apiKey || upstoxConfig.apiKey || process.env.UPSTOX_API_KEY || "").trim();
    if (apiSecret && apiSecret !== "••••••••" && apiSecret.trim() !== "") {
      upstoxConfig.apiSecret = apiSecret.trim();
    }
    if (!upstoxConfig.apiSecret || upstoxConfig.apiSecret.includes("•")) {
      upstoxConfig.apiSecret = process.env.UPSTOX_API_SECRET || "";
    }
    if (mobile && String(mobile).replace(/\D+/g, "").length >= 10) {
      upstoxConfig.mobile = String(mobile).replace(/\D+/g, "").slice(-10);
    }
    if (cleanPin) upstoxConfig.pin = cleanPin;
    if (key) upstoxConfig.apiKey = key;

    if (!cleanTotp || cleanTotp.length !== 6) {
      return res.status(400).json({
        success: false,
        error: "ദയവായി ഫോണിൽ വന്ന 6-അക്ക OTP കോഡ് നൽകുക (Please enter the 6-digit OTP code).",
      });
    }

    // Restore session from client backup if Render restarted between sending OTP and entering OTP
    if (sessionBackup && sessionBackup.validateOtpToken) {
      otpSessionState.active = sessionBackup;
      otpSessionState.recent = [
        sessionBackup,
        ...otpSessionState.recent.filter((s) => s.validateOtpToken !== sessionBackup.validateOtpToken),
      ].slice(0, 10);
    } else if (!otpSessionState.active && otpSessionState.recent.length > 0) {
      otpSessionState.active = otpSessionState.recent[0];
    }

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
            "https://service.upstox.com/login/open/v5/auth/1fa/otp-totp/verify",
            {
              method: "POST",
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
              "https://service.upstox.com/login/open/v4/auth/1fa/otp-totp/verify",
              {
                method: "POST",
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

        const pinToUse = cleanPin || sess.pin || process.env.UPSTOX_PIN || "";
        const secretToUse = upstoxConfig.apiSecret || sess.apiSecret || process.env.UPSTOX_API_SECRET || "";

        if (!verifyData?.success) {
          return res.status(400).json({
            success: false,
            error:
              verifyData?.error?.message ||
              "നൽകിയ OTP തെറ്റാണ് അല്ലെങ്കിൽ സമയം കഴിഞ്ഞു. വീണ്ടും ശ്രമിക്കുക.",
          });
        }

        // Extract profileId and userId if returned by OTP verification
        const profileId =
          verifyData.data?.userProfile?.profileId ||
          verifyData.data?.accounts?.[0]?.profileId ||
          sess.cookies["profile_id"] ||
          "";
        const verifiedUserId =
          verifyData.data?.userProfile?.userId ||
          verifyData.data?.accounts?.[0]?.userId ||
          sess.cookies["user_id"] ||
          "";

        const pinHeaders: Record<string, string> = {};
        if (profileId) pinHeaders["X-Profile-Id"] = String(profileId);
        if (verifiedUserId) pinHeaders["X-User-Id"] = String(verifiedUserId);

        // Step 4: Automatically submit 6-digit PIN in base64 (/login/open/v3/auth/2fa)
        const encodedPin = Buffer.from(pinToUse, "utf-8").toString("base64");
        const upstoxInternalRedirect = "https://api-v2.upstox.com/login/authorization/redirect";
        const twoFaUrl = `https://service.upstox.com/login/open/v3/auth/2fa?client_id=${encodeURIComponent(sess.internalClientId)}&redirect_uri=${encodeURIComponent(upstoxInternalRedirect)}`;

        const twoFaRes = await fetchUpstoxWithRetry(twoFaUrl, {
          method: "POST",
          headers: buildUpstoxBrowserHeaders(sess.requestId, sess.cookies, pinHeaders),
          body: JSON.stringify({
            data: {
              twoFAMethod: "SECRET_PIN",
              inputText: encodedPin,
            },
          }),
        });
        mergeSetCookies(sess.cookies, twoFaRes);
        const twoFaData = await twoFaRes.json();

        if (!twoFaData.success) {
          return res.status(400).json({
            success: false,
            error:
              twoFaData.error?.message ||
              "OTP ശരിയായിരുന്നു, എന്നാൽ PIN പരിശോധന പരാജയപ്പെട്ടു.",
          });
        }

        // Check if 2FA response already gave redirectUri with ?code=
        let finalRedirectUri = twoFaData.data?.redirectUri || "";

        // Step 5: If redirectUri not yet returned, automatically call /login/v2/oauth/authorize
        if (!finalRedirectUri || !finalRedirectUri.includes("code=")) {
          const oauthUrl = `https://service.upstox.com/login/v2/oauth/authorize?client_id=${encodeURIComponent(sess.internalClientId)}&redirect_uri=${encodeURIComponent(upstoxInternalRedirect)}&requestId=${encodeURIComponent(sess.requestId)}&response_type=code`;
          const oauthRes = await fetchUpstoxWithRetry(oauthUrl, {
            method: "POST",
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
        let authCode = "";
        if (finalRedirectUri) {
          try {
            const parsedRedirect = new URL(finalRedirectUri);
            authCode = parsedRedirect.searchParams.get("code") || "";
          } catch {
            const m = finalRedirectUri.match(/[?&]code=([^&#\s]+)/);
            if (m && m[1]) authCode = decodeURIComponent(m[1]);
          }
        }

        if (!authCode) {
          return res.status(400).json({
            success: false,
            error: "OTP-യും PIN-ഉം ശരിയായിരുന്നു, എന്നാൽ Authorization Code ലഭിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.",
          });
        }

        // Step 6: Automatically exchange ?code= for the live JWT access_token!
        const candidateSecrets = Array.from(
          new Set([secretToUse, upstoxConfig.apiSecret, process.env.UPSTOX_API_SECRET_FALLBACK || ""].filter(Boolean))
        );
        let tokenData: any = null;

        for (const candSecret of candidateSecrets) {
          const tokenParams = new URLSearchParams();
          tokenParams.append("code", authCode.trim());
          tokenParams.append("client_id", sess.apiKey);
          tokenParams.append("client_secret", candSecret);
          tokenParams.append("redirect_uri", sess.redirectUri);
          tokenParams.append("grant_type", "authorization_code");

          try {
            const tokenRes = await fetchUpstoxWithRetry("https://api.upstox.com/v2/login/authorization/token", {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
                "Api-Version": "2.0",
              },
              body: tokenParams.toString(),
            });
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
          upstoxConfig.userName =
            tokenData.user_name || process.env.UPSTOX_USER_NAME || "";
          upstoxConfig.userEmail = tokenData.email || upstoxConfig.userEmail || "";
          upstoxConfig.userClientCode = tokenData.user_id || process.env.UPSTOX_CLIENT_CODE || "";
          upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
          upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
          if (!botConfig.userExplicitlySelectedMode) {
            botConfig.mode = "UPSTOX_LIVE";
          }
          invalidTokens.delete(tokenData.access_token);
          resetVerifiedTokenCache();
          setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
          saveTokenBackupToDisk(tokenData.access_token, upstoxConfig);
          await savePostgresDb().catch(() => { /* ignore */ });
          publishTokenToCloudRelay(tokenData.access_token).catch(() => { /* ignore */ });

          return res.json({
            success: true,
            accessToken: tokenData.access_token,
            userName: upstoxConfig.userName,
            userClientCode: upstoxConfig.userClientCode,
            message:
              "🎉 OTP പരിശോധിച്ചു, PIN ഓട്ടോമാറ്റിക്കായി നൽകി, പുതിയ ടോക്കൺ ജനറേറ്റ് ചെയ്ത് അക്കൗണ്ട് ലൈവ് ആയി കണക്റ്റായി!",
          });
        } else {
          return res.status(400).json({
            success: false,
            error:
              tokenData?.errors?.[0]?.message ||
              tokenData?.message ||
              "ടോക്കൺ എക്സ്ചേഞ്ച് പരാജയപ്പെട്ടു. API Secret & Redirect URI പരിശോധിക്കുക.",
          });
        }
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: "ഓട്ടോമാറ്റിക് OTP + PIN ലോഗിൻ പിശക്: " + err.message,
        });
      }
    }

    // PATH B: Fallback to direct TOTP login if user didn't initiate an SMS OTP session
    try {
      const response = await fetch(
        "https://api.upstox.com/v2/totp-login/authorization/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-api-key": key,
            "Api-Version": "2.0",
          },
          body: JSON.stringify({
            totp: cleanTotp,
            pin: cleanPin,
          }),
        },
      );

      const data = await response.json();
      const token = data.access_token || data.data?.access_token;

      if (token) {
        upstoxConfig.accessToken = token;
        upstoxConfig.userName =
          data.user_name || data.data?.user_name || process.env.UPSTOX_USER_NAME || "";
        upstoxConfig.userEmail =
          data.email || data.data?.email || upstoxConfig.userEmail || "";
        upstoxConfig.userClientCode =
          data.user_id || data.data?.user_id || process.env.UPSTOX_CLIENT_CODE || "";
        upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
        upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
        if (!botConfig.userExplicitlySelectedMode) {
          botConfig.mode = "UPSTOX_LIVE";
        }
        invalidTokens.delete(token);
        resetVerifiedTokenCache();
        setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
        saveTokenBackupToDisk(token, upstoxConfig);
        await savePostgresDb().catch(() => { /* ignore */ });
        publishTokenToCloudRelay(token).catch(() => { /* ignore */ });

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
        error: "Failed to contact Upstox OTP endpoint: " + err.message,
      });
    }
  });
}
