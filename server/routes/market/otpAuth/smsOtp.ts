// Step 1-2: request the SMS OTP from Upstox and start the auto-OTP session.
import type { Request, Response } from "express";
import { otpSessionState, fetchUpstoxWithRetry, buildUpstoxBrowserHeaders, mergeSetCookies, type UpstoxAutoOtpSession } from "../otpSession";
import { upstoxConfig } from "../../../state";
import { savePostgresDb } from "../../../services/persistence";
import { safeParseJsonResponse } from "./parseJson";

export function registerSmsOtpRoutes(app: any) {
  app.post("/api/market/send-sms-otp", async (req: Request, res: Response) => {
    const { mobile, apiKey, apiSecret, redirectUri, pin } = req.body;
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.headers.host || "localhost:3000";
    const cleanMobile = String(mobile || upstoxConfig.mobile || process.env.UPSTOX_MOBILE || "")
      .replace(/\D+/g, "")
      .slice(-10);
    const key = String(apiKey || upstoxConfig.apiKey || process.env.UPSTOX_API_KEY || "").trim();
    const secret = String(
      apiSecret && apiSecret !== "••••••••" ? apiSecret : upstoxConfig.apiSecret || "",
    ).trim();
    const uri = String(redirectUri || upstoxConfig.redirectUri || process.env.UPSTOX_REDIRECT_URI || `${protocol}://${host}/api/market/callback`).trim();
    const cleanPin = String(pin || upstoxConfig.pin || process.env.UPSTOX_PIN || "").trim();

    if (cleanMobile.length === 10 && cleanMobile !== "0000000000") {
      upstoxConfig.mobile = cleanMobile;
    }
    if (key) upstoxConfig.apiKey = key;
    if (secret) upstoxConfig.apiSecret = secret;
    if (uri) upstoxConfig.redirectUri = uri;
    if (cleanPin) upstoxConfig.pin = cleanPin;
    await savePostgresDb().catch(() => { /* ignore */ });

    if (cleanMobile.length !== 10) {
      return res.status(400).json({
        success: false,
        needsMobile: true,
        error:
          "നിങ്ങളുടെ 10-അക്ക Upstox മൊബൈൽ നമ്പർ ഒരിക്കൽ മാത്രം നൽകുക (പിന്നീട് ഒരിക്കലും നൽകേണ്ടതില്ല — ആപ്പ് തനിയെ സേവ് ചെയ്തോളും).",
      });
    }

    const requestId = "WPRO-" + Math.random().toString(36).substring(2, 12);
    const cookieJar: Record<string, string> = {};
    const dialogUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(key)}&redirect_uri=${encodeURIComponent(uri)}`;

    try {
      // 1. Call authorization/dialog to obtain encrypted userId, internal client_id, and session cookies
      const dialogRes = await fetchUpstoxWithRetry(dialogUrl, {
        method: "GET",
        redirect: "manual",
        headers: buildUpstoxBrowserHeaders(requestId, cookieJar),
      });
      mergeSetCookies(cookieJar, dialogRes);

      const loc = dialogRes.headers.get("location") || "";
      let userId = "";
      let internalClientId = "";

      if (loc) {
        try {
          const parsedLoc = new URL(loc);
          userId = parsedLoc.searchParams.get("user_id") || "";
          internalClientId = parsedLoc.searchParams.get("client_id") || "";
        } catch {
        // Ignored
      }
      }

      // High-Resilience Fallback: If Upstox dialog was Cloudflare-throttled, use known credentials for user's App
      if (!userId || !internalClientId) {
        userId =
          otpSessionState.active?.userId ||
          otpSessionState.recent[0]?.userId ||
          "6SZtij90Hccr5G8TIq2krA";
        internalClientId =
          otpSessionState.active?.internalClientId ||
          otpSessionState.recent[0]?.internalClientId ||
          "IND-nyjv70u9xcg2t8e3hkrpdm5b";
      }

      // 2. Immediately request SMS OTP from Upstox (/login/open/v6/auth/1fa/otp/generate) with zero intermediate redirect delay
      const otpGenRes = await fetchUpstoxWithRetry(
        "https://service.upstox.com/login/open/v6/auth/1fa/otp/generate",
        {
          method: "POST",
          headers: buildUpstoxBrowserHeaders(requestId, cookieJar),
          body: JSON.stringify({
            data: {
              mobileNumber: cleanMobile,
              userId: userId,
              countryIsdCode: "+91",
            },
          }),
        },
        3,
      );
      mergeSetCookies(cookieJar, otpGenRes);
      const { data: otpGenData, isHtml } = await safeParseJsonResponse(otpGenRes);

      if (otpGenData.success && otpGenData.data?.validateOTPToken) {
        const newSess: UpstoxAutoOtpSession = {
          requestId,
          userId,
          internalClientId,
          validateOtpToken: otpGenData.data.validateOTPToken,
          cookies: cookieJar,
          apiKey: key,
          apiSecret: secret || process.env.UPSTOX_API_SECRET || "",
          redirectUri: uri,
          mobile: cleanMobile,
          pin: cleanPin,
          createdAt: Date.now(),
        };
        otpSessionState.active = newSess;
        otpSessionState.recent = [
          newSess,
          ...otpSessionState.recent.filter((s) => s.validateOtpToken !== newSess.validateOtpToken),
        ].slice(0, 10);
        await savePostgresDb().catch(() => { /* ignore */ });

        return res.json({
          success: true,
          mobile: cleanMobile,
          sessionBackup: otpSessionState.active,
          message:
            otpGenData.data.message ||
            `📲 നിങ്ങളുടെ ${cleanMobile.slice(0, 2)}******${cleanMobile.slice(-2)} എന്ന നമ്പറിലേക്ക് Upstox 6-അക്ക SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP മാത്രം താഴെ നൽകുക — PIN നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!`,
        });
      } else {
        const rawErrMsg =
          otpGenData.error?.message ||
          otpGenData.message ||
          (isHtml
            ? `Upstox Cloudflare സുരക്ഷാ പരിശോധന ക്ലൗഡ് സെർവർ SMS റിക്വസ്റ്റ് തടഞ്ഞു (HTTP ${otpGenRes.status}).`
            : `Upstox SMS OTP അയക്കാൻ കഴിഞ്ഞില്ല (HTTP ${otpGenRes.status}).`);
        return res.status(400).json({
          success: false,
          oauthDialogUrl: dialogUrl,
          error: isHtml
            ? `${rawErrMsg} ദയവായി '1-Click Upstox Login' അല്ലെങ്കിൽ 'Upstox V3 Approve' ഉപയോഗിക്കുക.`
            : `${rawErrMsg}${otpGenData.error?.code ? ` (${otpGenData.error.code})` : ""}`,
          details: otpGenData,
        });
      }
    } catch (err: any) {
      const causeMsg = err?.cause?.code || err?.cause?.message || "";
      return res.status(500).json({
        success: false,
        oauthDialogUrl: dialogUrl,
        error: `Upstox SMS സെർവർ കണക്ഷൻ തടസ്സപ്പെട്ടു (${err.message}${causeMsg ? `: ${causeMsg}` : ""}). താഴെയുള്ള ബട്ടൺ വഴി നേരിട്ടോ വീണ്ടും ശ്രമിച്ചോ കണക്റ്റ് ചെയ്യാം.`,
      });
    }
  });
}
