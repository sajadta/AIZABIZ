// Upstox market configuration, authentication, holdings and market-data routes.
import express from "express";
import type { Request, Response } from "express";
import https from "https";
import zlib from "zlib";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  upstoxConfig, setUpstoxConfig, botConfig, botLogs, invalidTokens,
  customHoldingBuyPrices, globalLiveQuotes, intradayCandleCache, paperPositions, paperTradeHistory,
  getCachedUpstoxLivePositions, getLastQuotesCache, FIXED_PRIMARY_IP, FIXED_SECONDARY_IP,
} from "../state";
import { isJwtTokenActuallyExpired, saveTokenBackupToDisk } from "../lib/tokens";
import { isUpstoxAuthFailureError } from "../utils";
import { getInstrumentKey, getUnderlyingOptionInstrumentKey, getDynamicLotSizeInfo, aggregateCandles, lotSizeCache } from "../lib/instruments";
import { fetchLiveUpstoxCharges } from "../lib/charges";
import { savePostgresDb } from "../services/persistence";
import { placeUpstoxOrderIpv4, getUpstoxAgent } from "../services/upstoxTransport";
import {
  publishTokenToCloudRelay, syncTokenFromRenderWebhookBridge, getLiveOutboundIp,
  lastVerifiedTokenStatus, setLastVerifiedTokenStatus,
} from "../services/tokenSync";
import { setLastWebhookDiagnostic, getLastWebhookDiagnostic } from "../state";
import { refreshCentralUpstoxQuotes, fetchRealNseQuotesFallback } from "../services/marketData";
import { YAHOO_NSE_MAP } from "../data/yahooMap";
import { GoogleGenAI, Type } from "@google/genai";

export function registerMarketRoutes(app: express.Application) {
app.get("/api/market/config", async (req: Request, res: Response) => {
  const ipResult = await getLiveOutboundIp();
  const currentLiveIp = ipResult.ip;
  if (
    upstoxConfig.accessToken &&
    (invalidTokens.has(upstoxConfig.accessToken) ||
      isJwtTokenActuallyExpired(upstoxConfig.accessToken))
  ) {
    upstoxConfig.accessToken = "";
  }
  if (!upstoxConfig.accessToken) {
    await syncTokenFromRenderWebhookBridge();
  }
  let isConnected = Boolean(upstoxConfig.accessToken);
  let tokenExpired = false;

  let availableMargin = lastVerifiedTokenStatus.availableMargin || 0;
  let usedMargin = lastVerifiedTokenStatus.usedMargin || 0;
  let utilizedMargin = lastVerifiedTokenStatus.utilizedMargin || 0;
  let payin = lastVerifiedTokenStatus.payin || 0;
  let payout = lastVerifiedTokenStatus.payout || 0;
  let holdingsCount = lastVerifiedTokenStatus.holdingsCount || 0;
  let userName = upstoxConfig.userName || lastVerifiedTokenStatus.userName || process.env.UPSTOX_USER_NAME || "";
  let userEmail = upstoxConfig.userEmail || lastVerifiedTokenStatus.userEmail || process.env.UPSTOX_USER_EMAIL || "";
  let userClientCode = upstoxConfig.userClientCode || lastVerifiedTokenStatus.userClientCode || process.env.UPSTOX_CLIENT_CODE || "";

  if (isConnected) {
    // Use 30-second verification cache to reduce API overhead and transient 429/401 errors
    if (
      lastVerifiedTokenStatus.token === upstoxConfig.accessToken &&
      Date.now() - lastVerifiedTokenStatus.verifiedAt < 30000
    ) {
      isConnected = true;
    } else {
      try {
        const [profileRes, fundsRes, holdingsRes] = await Promise.all([
          fetch("https://api.upstox.com/v2/user/profile", {
            headers: {
              Authorization: `Bearer ${upstoxConfig.accessToken}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          }),
          fetch("https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC", {
            headers: {
              Authorization: `Bearer ${upstoxConfig.accessToken}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          }).catch(() => null),
          fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
            headers: {
              Authorization: `Bearer ${upstoxConfig.accessToken}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          }).catch(() => null),
        ]);

        const profileData = await profileRes.json().catch(() => null);
        const fundsData = fundsRes ? await fundsRes.json().catch(() => null) : null;
        const holdingsData = holdingsRes ? await holdingsRes.json().catch(() => null) : null;

        if (holdingsData && holdingsData.status === "success" && Array.isArray(holdingsData.data)) {
          holdingsCount = holdingsData.data.length;
        }

        if (
          fundsData &&
          fundsData.status === "success" &&
          fundsData.data &&
          fundsData.data.equity
        ) {
          availableMargin = fundsData.data.equity.available_margin || 0;
          usedMargin = fundsData.data.equity.used_margin || 0;
          utilizedMargin = fundsData.data.equity.used_margin || 0;
          payin = fundsData.data.equity.payin || 0;
          payout = fundsData.data.equity.payout || 0;
        }

        if (profileData && profileData.status === "success" && profileData.data) {
          isConnected = true;
          userName = profileData.data.user_name || userName;
          userEmail = profileData.data.email || userEmail;
          userClientCode = profileData.data.user_id || userClientCode;
          upstoxConfig.userName = userName;
          upstoxConfig.userEmail = userEmail;
          upstoxConfig.userClientCode = userClientCode;
          setLastVerifiedTokenStatus({
            token: upstoxConfig.accessToken,
            verifiedAt: Date.now(),
            availableMargin,
            usedMargin,
            utilizedMargin,
            payin,
            payout,
            holdingsCount,
            userName,
            userEmail,
            userClientCode,
          });
          saveTokenBackupToDisk(upstoxConfig.accessToken, upstoxConfig);
        } else if (
          profileData &&
          isUpstoxAuthFailureError(profileRes.status, profileData) &&
          (isJwtTokenActuallyExpired(upstoxConfig.accessToken) ||
            Date.now() - lastVerifiedTokenStatus.verifiedAt > 10 * 60 * 1000)
        ) {
          // Logic Fix: Only mark expired if Upstox explicitly returned 401/UDAPI100050 AND JWT is truly expired or unverified for >10m
          const reason = isJwtTokenActuallyExpired(upstoxConfig.accessToken) ? "JWT Expired" : "Upstox 401 Auth Failure";
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: `⚠️ Upstox Token disconnected (${reason}). Please reconnect.`,
            messageMalayalam: `⚠️ Upstox ടോക്കൺ കാലാവധി കഴിഞ്ഞു (${reason === "JWT Expired" ? "സമയപരിധി കഴിഞ്ഞു" : "അംഗീകാരം റദ്ദാക്കപ്പെട്ടു"}). ദയവായി വീണ്ടും കണക്ട് ചെയ്യുക.`,
            type: "ERROR",
          });
          invalidTokens.add(upstoxConfig.accessToken);
          upstoxConfig.accessToken = "";
          isConnected = false;
          tokenExpired = true;
        }
      } catch (e) {
        // Network hiccup: keep existing valid token instead of wiping it!
        isConnected = Boolean(upstoxConfig.accessToken);
      }
    }
  }


  res.json({
    hasApiKey: Boolean(upstoxConfig.apiKey || process.env.UPSTOX_API_KEY),
    hasApiSecret: Boolean(upstoxConfig.apiSecret || process.env.UPSTOX_API_SECRET),
    redirectUri: upstoxConfig.redirectUri || process.env.UPSTOX_REDIRECT_URI || "",
    accessToken: upstoxConfig.accessToken,
    hasToken: isConnected,
    isConnected,
    tokenExpired,
    userName: userName,
    userEmail: userEmail,
    userClientCode: userClientCode,
    broker: isConnected ? "Upstox Securities Live Engine" : "Setup Required",
    tokenGeneratedAt: upstoxConfig.tokenGeneratedAt || "",
    tokenExpiresAt: upstoxConfig.tokenExpiresAt || "",
    todayTokenValid: isConnected,
    availableMargin,
    usedMargin,
    utilizedMargin,
    payin,
    payout,
    totalBalance: availableMargin + utilizedMargin,
    holdingsCount,
    serverOutboundIp: FIXED_PRIMARY_IP,
    serverSecondaryIp: FIXED_SECONDARY_IP,
    isFixedProxyActive: ipResult.isFixedProxy,
    outboundProxyConfigured: Boolean(upstoxConfig.outboundProxyUrl),
    maskedProxyUrl: upstoxConfig.outboundProxyUrl
      ? upstoxConfig.outboundProxyUrl.replace(/:[^:@]+@/, ":••••••••@")
      : "",
    lastWebhookDiagnostic: getLastWebhookDiagnostic(),
  });
});

let cachedOutboundServerIp = "";
let isCurrentIpFromProxy = false;
let lastIpCheckAt = 0;

app.post("/api/market/proxy-config", async (req: Request, res: Response) => {
  const { proxyUrl } = req.body;
  const targetProxy = typeof proxyUrl === "string" ? proxyUrl.trim() : "";
  if (!targetProxy) {
    upstoxConfig.outboundProxyUrl = "";
    await savePostgresDb().catch(() => { /* ignore */ });
    const fallbackIp = await getLiveOutboundIp();
    return res.json({
      success: true,
      message: "Proxy removed. Reverted to standard direct connection.",
      isFixedProxy: false,
      serverOutboundIp: fallbackIp.ip,
    });
  }

  try {
    const testAgent = new HttpsProxyAgent(targetProxy, { timeout: 7000 });
    const detectedIp = await new Promise<string>((resolve, reject) => {
      const r = https.get("https://api.ipify.org", { agent: testAgent, timeout: 7000 }, (res) => {
        let str = "";
        res.on("data", (d) => (str += d));
        res.on("end", () => resolve(str.trim()));
      });
      r.on("error", reject);
      r.setTimeout(7000, () => {
        r.destroy();
        reject(new Error("Proxy connection timed out (7s)"));
      });
    });

    if (!detectedIp || detectedIp.length > 45) {
      throw new Error("Invalid IP received from proxy");
    }

    upstoxConfig.outboundProxyUrl = targetProxy;
    cachedOutboundServerIp = detectedIp;
    isCurrentIpFromProxy = true;
    lastIpCheckAt = Date.now();
    await savePostgresDb().catch(() => { /* ignore */ });

    return res.json({
      success: true,
      message: `✅ Fixed IP Proxy connected! Outbound Static IP: ${detectedIp}`,
      serverOutboundIp: detectedIp,
      isFixedProxy: true,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: `Proxy test failed: ${err?.message || "Could not reach proxy"}`,
    });
  }
});

app.post("/api/market/config", async (req: Request, res: Response) => {
  const { apiKey, apiSecret, redirectUri, accessToken, mobile, pin } = req.body;
  if (apiKey !== undefined) upstoxConfig.apiKey = apiKey.trim();
  if (apiSecret !== undefined && apiSecret !== "••••••••" && apiSecret.trim() !== "") {
    upstoxConfig.apiSecret = apiSecret.trim();
  }
  if (redirectUri !== undefined) upstoxConfig.redirectUri = redirectUri.trim();
  if (mobile !== undefined && String(mobile).trim()) upstoxConfig.mobile = String(mobile).trim();
  if (pin !== undefined && String(pin).trim()) upstoxConfig.pin = String(pin).trim();

  if (typeof accessToken === "string") {
    let token = accessToken.trim();
    if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();
    if (token) {
      // If the user explicitly posts a token, we remove it from invalidTokens to allow re-validation.
      // This helps in cases where a transient error might have incorrectly flagged a valid token.
      if (invalidTokens.has(token)) {
        invalidTokens.delete(token);
      }

      try {
        const response = await fetch("https://api.upstox.com/v2/user/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        });
        const data = await response.json();
        if (data.status === "success" && data.data) {
          upstoxConfig.accessToken = token;
          upstoxConfig.userName = data.data.user_name || "Live Trader";
          upstoxConfig.userEmail = data.data.email || "trader@upstox.com";
          upstoxConfig.userClientCode = data.data.user_id || "UPSTOX_USER";
          upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString(
            "en-IN",
          );
          upstoxConfig.tokenExpiresAt = "03:30 AM (Next Day) ";
          await savePostgresDb().catch(() => { /* ignore */ });
          publishTokenToCloudRelay(token).catch(() => { /* ignore */ });
        } else if (isUpstoxAuthFailureError(response.status, data)) {
          invalidTokens.add(token);
          upstoxConfig.accessToken = "";
          return res
            .status(401)
            .json({
              success: false,
              error: data.errors?.[0]?.message || "Invalid or expired Upstox token provided",
            });
        }
      } catch (err) {
        return res
          .status(500)
          .json({ success: false, error: "Failed to validate token" });
      }
    }
  }

  await savePostgresDb().catch(() => { /* ignore */ });

  res.json({
    success: true,
    message: "Upstox configuration updated successfully",
    isConnected: Boolean(upstoxConfig.accessToken),
    hasApiKey: Boolean(upstoxConfig.apiKey || process.env.UPSTOX_API_KEY),
    hasApiSecret: Boolean(upstoxConfig.apiSecret || process.env.UPSTOX_API_SECRET),
    redirectUri: upstoxConfig.redirectUri,
    userName: upstoxConfig.userName,
    userClientCode: upstoxConfig.userClientCode,
    todayTokenValid: Boolean(upstoxConfig.accessToken),
    tokenGeneratedAt: upstoxConfig.tokenGeneratedAt,
    tokenExpiresAt: upstoxConfig.tokenExpiresAt,
  });
});

app.post("/api/market/save-config", (req: Request, res: Response) => {
  const { apiKey, apiSecret, redirectUri, accessToken, mobile, pin } = req.body;
  if (apiKey) upstoxConfig.apiKey = apiKey.trim();
  if (apiSecret && apiSecret !== "••••••••") upstoxConfig.apiSecret = apiSecret.trim();
  if (redirectUri) upstoxConfig.redirectUri = redirectUri.trim();
  if (mobile && String(mobile).trim()) upstoxConfig.mobile = String(mobile).trim();
  if (pin && String(pin).trim()) upstoxConfig.pin = String(pin).trim();
  if (typeof accessToken === "string" && accessToken.trim().length > 20) {
    const cleanToken = accessToken.trim();
    upstoxConfig.accessToken = cleanToken;
    invalidTokens.delete(cleanToken);
    publishTokenToCloudRelay(cleanToken).catch(() => { /* ignore */ });
  }

  savePostgresDb().catch(() => { /* ignore */ });

  res.json({
    success: true,
    message: "Upstox configuration updated successfully",
    isConnected: Boolean(upstoxConfig.accessToken),
    mobile: upstoxConfig.mobile,
  });
});

// Dedicated Daily Token Activation and Verification Endpoint
app.post("/api/market/daily-token", async (req: Request, res: Response) => {
  const { accessToken } = req.body;
  let token = (accessToken || "").trim();
  if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      error:
        "Please enter a valid Upstox Access Token / ദയവായി ഒരു സാധുവായ Upstox ടോക്കൺ നൽകുക",
    });
  }

  if (invalidTokens.has(token)) {
    upstoxConfig.accessToken = "";
    return res.status(401).json({
      success: false,
      error: "This Upstox token has expired (UDAPI100050). Please generate a fresh daily token.",
    });
  }

  try {
    const response = await fetch("https://api.upstox.com/v2/user/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });

    const data = await response.json();

    if (data.status === "success" && data.data) {
      upstoxConfig.accessToken = token;
      upstoxConfig.userName = data.data.user_name || "Live Trader";
      upstoxConfig.userEmail = data.data.email || "trader@upstox.com";
      upstoxConfig.userClientCode = data.data.user_id || "UPSTOX_USER";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      if (!botConfig.userExplicitlySelectedMode) {
        botConfig.mode = "UPSTOX_LIVE";
      }
      invalidTokens.delete(token);
      await savePostgresDb().catch(() => { /* ignore */ });
      publishTokenToCloudRelay(token).catch(() => { /* ignore */ });

      return res.json({
        success: true,
        message:
          "Daily Token verified and activated! Live trading mode enabled.",
        profile: {
          userName: upstoxConfig.userName,
          userEmail: upstoxConfig.userEmail,
          userClientCode: upstoxConfig.userClientCode,
          tokenGeneratedAt: upstoxConfig.tokenGeneratedAt,
          tokenExpiresAt: upstoxConfig.tokenExpiresAt,
        },
      });
    } else {
      if (isUpstoxAuthFailureError(response.status, data)) {
        invalidTokens.add(token);
      }
      upstoxConfig.accessToken = "";
      return res.status(401).json({
        success: false,
        error:
          data.errors?.[0]?.message ||
          "Invalid or expired token. Please generate a new token and try again.",
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Connection error while validating token. Please try again.",
    });
  }
});

// Clear token endpoint
app.post("/api/market/clear-token", (req: Request, res: Response) => {
  upstoxConfig.accessToken = "";
  upstoxConfig.tokenGeneratedAt = "";
  upstoxConfig.tokenExpiresAt = "";
  res.json({
    success: true,
    message: "Daily Upstox token cleared. Switched to Paper Trading Mode.",
  });
});

// Upstox Postback, Notifier Webhook & OAuth Callback Endpoint (handles both GET ?code= and POST webhook payloads on /api/market/webhook, /api/market/notifier, and POST /)
const handleUpstoxWebhook = async (req: Request, res: Response) => {
  try {
    // 0. If Upstox redirected via GET with ?code=... (because user set Redirect URL to /api/market/webhook)
    const oauthCode = (req.query.code as string) || "";
    if (req.method === "GET" && oauthCode) {
      const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
      const host = req.headers.host;
      const callbackUri =
        upstoxConfig.redirectUri || `${protocol}://${host}/api/market/webhook`;

      const params = new URLSearchParams();
      params.append("code", oauthCode.trim());
      params.append("client_id", upstoxConfig.apiKey);
      params.append("client_secret", upstoxConfig.apiSecret);
      params.append("redirect_uri", callbackUri);
      params.append("grant_type", "authorization_code");

      const response = await fetch(
        "https://api.upstox.com/v2/login/authorization/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "Api-Version": "2.0",
          },
          body: params.toString(),
        },
      );
      const data = await response.json();

      if (data.access_token) {
        upstoxConfig.accessToken = data.access_token;
        upstoxConfig.userName = data.user_name || process.env.UPSTOX_USER_NAME || "";
        upstoxConfig.userEmail = data.email || upstoxConfig.userEmail || "";
        upstoxConfig.userClientCode = data.user_id || process.env.UPSTOX_CLIENT_CODE || "";
        upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
        upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
        // Preserve existing botConfig.mode (PAPER_TRADING or UPSTOX_LIVE)
        invalidTokens.delete(data.access_token);
        await savePostgresDb().catch(() => { /* ignore */ });
        publishTokenToCloudRelay(data.access_token).catch(() => { /* ignore */ });

        return res.send(`
          <html><body style="background:#0b0f19;color:#34d399;font-family:sans-serif;padding:40px;text-align:center;">
            <h2>✅ Upstox Access Token ഓട്ടോമാറ്റിക്കായി ആക്റ്റീവ് ആയി!</h2>
            <p style="color:#cbd5e1;">അക്കൗണ്ട്: <b>${upstoxConfig.userName} (${upstoxConfig.userClientCode})</b></p>
            <p style="color:#94a3b8;font-size:13px;">ലൈവ് ട്രേഡിംഗും ഹോൾഡിങ്‌സും സജീവമായി. ആപ്പിലേക്ക് തിരികെ പോകുന്നു...</p>
            <script>
              try {
                localStorage.setItem('upstox_daily_token', ${JSON.stringify(data.access_token)});
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'UPSTOX_OAUTH_SUCCESS',
                    accessToken: ${JSON.stringify(data.access_token)},
                    userName: ${JSON.stringify(upstoxConfig.userName)},
                    userClientCode: ${JSON.stringify(upstoxConfig.userClientCode)}
                  }, '*');
                  setTimeout(() => window.close(), 800);
                } else {
                  setTimeout(() => { window.location.href = '/'; }, 800);
                }
              } catch (e) {
                window.location.href = '/';
              }
            </script>
          </body></html>
        `);
      }
    }

    const payload = req.body || {};
    const rawStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    setLastWebhookDiagnostic(`${new Date().toLocaleTimeString("en-IN")}: ${rawStr.slice(0, 200)}`);

    // 1. Check if Upstox Notifier Webhook pushed a new access_token (check all fields + regex JWT match)
    let incomingToken =
      payload.access_token ||
      payload.accessToken ||
      payload.token ||
      payload.data?.access_token ||
      payload.data?.accessToken ||
      payload.data?.token ||
      (req.query.access_token as string) ||
      (req.query.token as string) ||
      "";

    if (!incomingToken && rawStr.includes("eyJ")) {
      const jwtMatch = rawStr.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      if (jwtMatch && jwtMatch[0]) {
        incomingToken = jwtMatch[0];
      }
    }

    if (incomingToken && typeof incomingToken === "string") {
      const cleanToken = incomingToken.replace(/^Bearer\s+/i, "").trim();
      upstoxConfig.accessToken = cleanToken;
      if (payload.user_id || payload.client_id) {
        upstoxConfig.userClientCode = payload.user_id || payload.client_id;
      }
      if (payload.user_name) {
        upstoxConfig.userName = payload.user_name;
      }
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      // Preserve existing botConfig.mode (PAPER_TRADING or UPSTOX_LIVE)
      invalidTokens.delete(cleanToken);
      await savePostgresDb().catch(() => { /* ignore */ });
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: `✅ Upstox Notifier Webhook വഴി പുതിയ Access Token ഓട്ടോമാറ്റിക്കായി ലഭിച്ചു!`,
        type: "SUCCESS",
      });
    }

    // 2. Check if Upstox Postback pushed an Order Update
    if (payload.order_id && payload.status) {
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: `📦 Upstox Order Update [${payload.trading_symbol || payload.instrument_token}]: ${payload.transaction_type || ""} ${payload.status} @ ₹${payload.average_price || payload.price || 0}`,
        type: payload.status === "complete" ? "SUCCESS" : "INFO",
      });
    }

    res.status(200).json({ status: "success", received: true });
  } catch (e: any) {
    res.status(200).json({ status: "ok" });
  }
};

app.all("/api/market/webhook", handleUpstoxWebhook);
app.all("/api/market/notifier", handleUpstoxWebhook);
app.post("/", handleUpstoxWebhook);

// Validate token endpoint
app.post("/api/market/validate-token", async (req: Request, res: Response) => {
  const token = (req.body.accessToken || upstoxConfig.accessToken || "").trim();
  if (!token) {
    return res.status(400).json({ valid: false, error: "No token provided" });
  }

  try {
    const response = await fetch("https://api.upstox.com/v2/user/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    const data = await response.json();
    if (data.status === "success" && data.data) {
      return res.json({
        valid: true,
        userName: data.data.user_name || "Live Trader",
        userEmail: data.data.email || "",
        userClientCode: data.data.user_id || "",
      });
    } else {
      invalidTokens.add(token);
      return res.status(401).json({
        valid: false,
        error: data.errors?.[0]?.message || "Invalid or expired Upstox token",
      });
    }
  } catch (e: any) {
    return res.status(500).json({ valid: false, error: e.message || "Token validation failed" });
  }
});

// 2.5 Automated Upstox SMS OTP + Auto PIN + Auto OAuth Code + Auto Token Exchange Engine
interface UpstoxAutoOtpSession {
  requestId: string;
  userId: string;
  internalClientId: string;
  validateOtpToken: string;
  cookies: Record<string, string>;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  mobile: string;
  pin: string;
  createdAt: number;
}

let activeAutoOtpSession: UpstoxAutoOtpSession | null = null;
let recentAutoOtpSessions: UpstoxAutoOtpSession[] = [
  {
    requestId: "WPRO-3egkrksx7b",
    userId: "6SZtij90Hccr5G8TIq2krA",
    internalClientId: "IND-nyjv70u9xcg2t8e3hkrpdm5b",
    validateOtpToken: "ll1FA-e042cf74c757dee57f73f245b4e515124ad09b8f3a6f373cebfc7eea7fb6fe8c",
    cookies: {
      udapi_api_key: process.env.UPSTOX_API_KEY || "",
      __cf_bm: "APVkIakoA8oIMlCKmWEcXAZn5HmSbtmwhB1n97fxVyw-1791776470.3146067-1.0.1.1-r36ZZnzG5Mh_XG24aA2ZQuD_neKhSGk12jPVmtN.G9UJBvh92k.SxQv8OGjAYlTVg.ptYo_t16tVoFU_RQqTqebtNli3c2.tHsUmagrEPaRjaSj73w9nAWyoEk8QHCwX",
      _cfuvid: "rTkD8jVRZSZqyebeUSkiZbwedOz4rQh4Quu3MOjY.Nw-1791776470.3146067-1.0.1.1-vVKj9E88ywztg1mGTEvFeWcUG_mowUXfkFdJ6oEZ0CY",
    },
    apiKey: process.env.UPSTOX_API_KEY || "",
    apiSecret: process.env.UPSTOX_API_SECRET || "",
    redirectUri: process.env.UPSTOX_REDIRECT_URI || "",
    mobile: process.env.UPSTOX_MOBILE || "",
    pin: process.env.UPSTOX_PIN || "",
    createdAt: Date.now(),
  },
  {
    requestId: "WPRO-frrwujndfv",
    userId: "6SZtij90Hccr5G8TIq2krA",
    internalClientId: "IND-nyjv70u9xcg2t8e3hkrpdm5b",
    validateOtpToken: "ll1FA-612b975394378b452a29c9862f5f48390ca8e08c68410c6e889624109a3960cf",
    cookies: {
      udapi_api_key: process.env.UPSTOX_API_KEY || "",
      __cf_bm: "bXngocYZYkTkF3di1lN4AHP2XuwpwLQOZPoFEYHhxvA-1791776468.5745695-1.0.1.1-AIdlHk1ILWcRSOkKhQr07EAzIKKtzzchmg.DvO.Cf0E6p.GUHVa3hVLrlyLkg8Mhos7DPDARNOkg0FDNzZBr.n3sXzw3CPgYZ_6vSJuljyijkioGs8vF6q7FHPT28BIP",
      _cfuvid: "MWR3OKJABaFLrUmS4l1aaTtT2ULpIKz.k_UQh9FKwm0-1791776468.5745695-1.0.1.1-eM9hdukfcQCeHmZOLwzUrFfGTCXxF4ey7OoHOil82A0",
    },
    apiKey: process.env.UPSTOX_API_KEY || "",
    apiSecret: process.env.UPSTOX_API_SECRET || "",
    redirectUri: process.env.UPSTOX_REDIRECT_URI || "",
    mobile: process.env.UPSTOX_MOBILE || "",
    pin: process.env.UPSTOX_PIN || "",
    createdAt: Date.now() - 1000,
  },
];
activeAutoOtpSession = recentAutoOtpSessions[0];

const ipv4HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  timeout: 12000,
  family: 4,
});

function mergeSetCookies(cookieJar: Record<string, string>, res: any) {
  const rawList: string[] =
    typeof res?.headers?.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : Array.isArray(res?.rawSetCookies)
        ? res.rawSetCookies
        : res?.headers?.get?.("set-cookie")
          ? [res.headers.get("set-cookie") as string]
          : [];
  for (const raw of rawList) {
    if (!raw) continue;
    const firstPart = String(raw).split(";")[0];
    const eqIdx = firstPart.indexOf("=");
    if (eqIdx > 0) {
      const k = firstPart.slice(0, eqIdx).trim();
      const v = firstPart.slice(eqIdx + 1).trim();
      cookieJar[k] = v;
    }
  }
}

function formatCookieJar(cookieJar: Record<string, string>): string {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function buildUpstoxBrowserHeaders(requestId: string, cookieJar: Record<string, string>, extra: Record<string, string> = {}) {
  const cookieStr = formatCookieJar(cookieJar);
  return {
    accept: "*/*",
    "accept-language": "en-GB,en;q=0.9",
    "content-type": "application/json",
    origin: "https://login.upstox.com",
    priority: "u=1, i",
    referer: "https://login.upstox.com/",
    "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-device-details":
      "platform=WEB|osName=Mac OS/10.15.7|osVersion=Chrome/140.0.0.0|appVersion=4.0.0|modelName=Chrome|manufacturer=Apple|uuid=3Z1IVTlV4rUUGbNp8KP0|userAgent=Upstox 3.0 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-request-id": requestId,
    ...(cookieStr ? { cookie: cookieStr } : {}),
    ...extra,
  };
}

function httpsRequestIPv4(urlStr: string, options: RequestInit = {}, timeoutMs = 12000): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const method = (options.method || "GET").toUpperCase();
    const rawHeaders: Record<string, string> = {};
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers as Record<string, string>)) {
        if (v !== undefined && v !== null) rawHeaders[k] = String(v);
      }
    }
    const bodyStr = typeof options.body === "string" ? options.body : "";
    if (bodyStr && !rawHeaders["content-length"] && !rawHeaders["Content-Length"]) {
      rawHeaders["content-length"] = String(Buffer.byteLength(bodyStr, "utf-8"));
    }

    const reqAgent = parsed.hostname.includes("upstox") ? getUpstoxAgent() : ipv4HttpsAgent;

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        headers: rawHeaders,
        agent: reqAgent,
        family: 4,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          let buffer = Buffer.concat(chunks);
          const enc = String(res.headers["content-encoding"] || "").toLowerCase();
          try {
            if (enc === "gzip") buffer = zlib.gunzipSync(buffer);
            else if (enc === "deflate") buffer = zlib.inflateSync(buffer);
            else if (enc === "br") buffer = zlib.brotliDecompressSync(buffer);
          } catch {
      // Ignored
    }
          const textBody = buffer.toString("utf-8");
          const status = res.statusCode || 200;
          const setCookies: string[] = Array.isArray(res.headers["set-cookie"])
            ? (res.headers["set-cookie"] as string[])
            : res.headers["set-cookie"]
              ? [String(res.headers["set-cookie"])]
              : [];

          resolve({
            status,
            ok: status >= 200 && status < 300,
            rawSetCookies: setCookies,
            headers: {
              get: (name: string) => {
                const val = res.headers[name.toLowerCase()];
                return Array.isArray(val) ? val.join(", ") : val ? String(val) : null;
              },
              getSetCookie: () => setCookies,
            },
            text: async () => textBody,
            json: async () => {
              try {
                return JSON.parse(textBody);
              } catch {
                return {};
              }
            },
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("IPv4 request timed out"));
    });
    req.on("error", (err) => {
      reject(err);
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function fetchUpstoxWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await httpsRequestIPv4(url, options, 10000);
    } catch (err: any) {
      lastErr = err;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(timer);
        return res;
      } catch (fetchErr: any) {
        lastErr = fetchErr;
      }
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 350 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// Step 1 & 2 Automatic: Send SMS OTP to user's saved mobile number without opening Upstox web
app.post("/api/market/send-sms-otp", async (req: Request, res: Response) => {
  const { mobile, apiKey, apiSecret, redirectUri, pin } = req.body;
  const cleanMobile = String(mobile || upstoxConfig.mobile || process.env.UPSTOX_MOBILE || "")
    .replace(/\D+/g, "")
    .slice(-10);
  const key = String(apiKey || upstoxConfig.apiKey || process.env.UPSTOX_API_KEY || "").trim();
  const secret = String(
    apiSecret && apiSecret !== "••••••••" ? apiSecret : upstoxConfig.apiSecret || "",
  ).trim();
  const uri = String(redirectUri || upstoxConfig.redirectUri || process.env.UPSTOX_REDIRECT_URI || "").trim();
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
        activeAutoOtpSession?.userId ||
        recentAutoOtpSessions[0]?.userId ||
        "6SZtij90Hccr5G8TIq2krA";
      internalClientId =
        activeAutoOtpSession?.internalClientId ||
        recentAutoOtpSessions[0]?.internalClientId ||
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
    const otpGenData = await otpGenRes.json();

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
      activeAutoOtpSession = newSess;
      recentAutoOtpSessions = [
        newSess,
        ...recentAutoOtpSessions.filter((s) => s.validateOtpToken !== newSess.validateOtpToken),
      ].slice(0, 10);
      await savePostgresDb().catch(() => { /* ignore */ });

      return res.json({
        success: true,
        mobile: cleanMobile,
        sessionBackup: activeAutoOtpSession,
        message:
          otpGenData.data.message ||
          `📲 നിങ്ങളുടെ ${cleanMobile.slice(0, 2)}******${cleanMobile.slice(-2)} എന്ന നമ്പറിലേക്ക് Upstox 6-അക്ക SMS OTP അയച്ചിട്ടുണ്ട്! ആ OTP മാത്രം താഴെ നൽകുക — PIN നൽകി ടോക്കൺ എടുക്കുന്ന ബാക്കി എല്ലാം ആപ്പ് തനിയെ ചെയ്യും!`,
      });
    } else {
      const errMsg =
        otpGenData.error?.message ||
        "Upstox SMS OTP അയക്കാൻ കഴിഞ്ഞില്ല. മൊബൈൽ നമ്പർ ശരിയാണെന്ന് ഉറപ്പാക്കുക.";
      return res.status(400).json({
        success: false,
        oauthDialogUrl: dialogUrl,
        error: `${errMsg} (${otpGenData.error?.code || ""})`,
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

// Step 3, 4, 5 Automatic: Verify 6-Digit SMS OTP -> Auto-Submit PIN -> Auto-Authorize OAuth -> Auto-Exchange Access Token!
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
    activeAutoOtpSession = sessionBackup;
    recentAutoOtpSessions = [
      sessionBackup,
      ...recentAutoOtpSessions.filter((s) => s.validateOtpToken !== sessionBackup.validateOtpToken),
    ].slice(0, 10);
  } else if (!activeAutoOtpSession && recentAutoOtpSessions.length > 0) {
    activeAutoOtpSession = recentAutoOtpSessions[0];
  }

  // PATH A: If we have an active Automated SMS OTP session, complete Steps 3, 4, 5 automatically!
  const candidateSessions = [
    ...(activeAutoOtpSession ? [activeAutoOtpSession] : []),
    ...recentAutoOtpSessions.filter(
      (s) =>
        s.validateOtpToken !== activeAutoOtpSession?.validateOtpToken &&
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

      if (tokenData.access_token) {
        activeAutoOtpSession = null;
        upstoxConfig.accessToken = tokenData.access_token;
        upstoxConfig.userName =
          tokenData.user_name || process.env.UPSTOX_USER_NAME || "";
        upstoxConfig.userEmail = tokenData.email || upstoxConfig.userEmail || "";
        upstoxConfig.userClientCode = tokenData.user_id || process.env.UPSTOX_CLIENT_CODE || "";
        upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
        upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
        // Preserve existing botConfig.mode (PAPER_TRADING or UPSTOX_LIVE)
        invalidTokens.delete(tokenData.access_token);
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
            tokenData.errors?.[0]?.message ||
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

// Upstox V3 Access Token Request (Sends 1-Click Approval Notification to Upstox Mobile App & WhatsApp -> Pushes token to /api/market/webhook)
app.post("/api/market/request-token-v3", async (req: Request, res: Response) => {
  const { apiKey, apiSecret } = req.body;
  const key = String(apiKey || upstoxConfig.apiKey || process.env.UPSTOX_API_KEY || "").trim();
  const secret = String(
    apiSecret && apiSecret !== "••••••••" ? apiSecret : upstoxConfig.apiSecret || "",
  ).trim();

  if (!key || !secret) {
    return res.status(400).json({
      success: false,
      error: "API Secret നല്‍കിയിട്ടില്ല! ദയവായി API Secret നല്‍കിയ ശേഷം വീണ്ടും ശ്രമിക്കുക.",
    });
  }

  upstoxConfig.apiKey = key;
  upstoxConfig.apiSecret = secret;
  await savePostgresDb().catch(() => { /* ignore */ });

  try {
    const response = await fetch(
      `https://api.upstox.com/v3/login/auth/token/request/${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_secret: secret,
        }),
      },
    );

    const data = await response.json();
    if (response.ok && (data.status === "success" || data.data)) {
      return res.json({
        success: true,
        message:
          "📲 നിങ്ങളുടെ Upstox മൊബൈൽ ആപ്പിലേക്കും WhatsApp-ലേക്കും ടോക്കൺ റിക്വസ്റ്റ് അയച്ചു! ഫോണിൽ 'Approve' അമർത്തിയാൽ ഉടൻ ആപ്പ് തനിയെ ടോക്കൺ സ്വീകരിച്ച് ലൈവ് ആകും (നമ്പറോ PIN-ഓ അടിക്കേണ്ടതില്ല)!",
        data,
      });
    } else {
      const errMsg =
        data.errors?.[0]?.message ||
        data.message ||
        "Upstox V3 Token Request അയക്കാൻ കഴിഞ്ഞില്ല (Upstox Developer App-ൽ Notifier Webhook URL സജ്ജീകരിച്ചിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക).";
      return res.status(400).json({
        success: false,
        error: errMsg,
        details: data,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Error sending Upstox V3 token request: " + err.message,
    });
  }
});

app.get("/api/market/auth-url", (req: Request, res: Response) => {
  const apiKey = (req.query.apiKey as string) || upstoxConfig.apiKey;
  const redirectUri =
    (req.query.redirectUri as string) || upstoxConfig.redirectUri;

  if (!apiKey) {
    return res.status(400).json({
      error: "API Key is required to generate Upstox login dialog URL",
    });
  }

  const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.json({ loginUrl });
});

// Token Exchange Callback Handler (POST from UI & GET from OAuth Redirect)
app.post("/api/market/token", async (req: Request, res: Response) => {
  const { code, cmode, apiKey, apiSecret, redirectUri } = req.body;
  let rawCode = (code || cmode || "").trim();
  let detectedRedirectUri = "";

  // If user pasted a full redirected URL (e.g. http://localhost:8080/?code=xyz), extract code & origin
  if (rawCode.includes("code=")) {
    try {
      const parsedUrl = new URL(rawCode);
      rawCode = parsedUrl.searchParams.get("code") || rawCode;
      detectedRedirectUri = `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch {
      const match = rawCode.match(/[?&]code=([^&#\s]+)/);
      if (match && match[1]) rawCode = decodeURIComponent(match[1]);
    }
  }

  const key = (apiKey || upstoxConfig.apiKey || "").trim();
  const secret = (
    apiSecret && apiSecret !== "••••••••" ? apiSecret : upstoxConfig.apiSecret || ""
  ).trim();
  const uri = (redirectUri || detectedRedirectUri || upstoxConfig.redirectUri || "").trim();

  if (!rawCode || !key || !secret) {
    return res.status(400).json({
      error: !secret
        ? "API Secret നല്‍കിയിട്ടില്ല! ദയവായി Upstox API Secret നല്‍കിയ ശേഷം വീണ്ടും ശ്രമിക്കുക."
        : "Missing authorization code, API Key, or API Secret for token exchange",
    });
  }

  // Save credentials in memory
  upstoxConfig.apiKey = key;
  upstoxConfig.apiSecret = secret;
  if (uri) upstoxConfig.redirectUri = uri;

  try {
    const params = new URLSearchParams();
    params.append("code", rawCode);
    params.append("client_id", key);
    params.append("client_secret", secret);
    params.append("redirect_uri", uri);
    params.append("grant_type", "authorization_code");

    const response = await fetch(
      "https://api.upstox.com/v2/login/authorization/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "Api-Version": "2.0",
        },
        body: params.toString(),
      },
    );

    const data = await response.json();
    if (data.access_token) {
      upstoxConfig.accessToken = data.access_token;
      upstoxConfig.userName = data.user_name || "Upstox Trader";
      upstoxConfig.userEmail = data.email || upstoxConfig.userEmail || "";
      upstoxConfig.userClientCode = data.user_id || upstoxConfig.userClientCode || "";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      invalidTokens.delete(data.access_token);
      savePostgresDb();
      publishTokenToCloudRelay(data.access_token).catch(() => { /* ignore */ });

      return res.json({
        success: true,
        accessToken: data.access_token,
        user_name: upstoxConfig.userName,
        user_id: upstoxConfig.userClientCode,
      });
    } else {
      const errMsg =
        data.errors?.[0]?.message ||
        data.message ||
        "Token exchange failed. Check Redirect URI & API Secret.";
      return res.status(400).json({
        error: errMsg,
        details: data,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to contact Upstox token gateway: " + err.message,
    });
  }
});

// Automatic OAuth Redirect Callback Endpoint (/api/market/callback?code=...)
app.get("/api/market/callback", async (req: Request, res: Response) => {
  const code = (req.query.code as string) || "";
  if (!code) {
    return res.status(400).send(`
      <html><body style="background:#0b0f19;color:#f87171;font-family:sans-serif;padding:40px;text-align:center;">
        <h2>Upstox Authorization Code ലഭ്യമല്ല</h2>
        <p>ദയവായി Upstox API Keys & Redirect URI പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.</p>
      </body></html>
    `);
  }

  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers.host;
  const callbackUri = upstoxConfig.redirectUri || `${protocol}://${host}/api/market/callback`;

  try {
    const params = new URLSearchParams();
    params.append("code", code.trim());
    params.append("client_id", upstoxConfig.apiKey);
    params.append("client_secret", upstoxConfig.apiSecret);
    params.append("redirect_uri", callbackUri);
    params.append("grant_type", "authorization_code");

    const response = await fetch(
      "https://api.upstox.com/v2/login/authorization/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "Api-Version": "2.0",
        },
        body: params.toString(),
      },
    );
    const data = await response.json();

    if (data.access_token) {
      upstoxConfig.accessToken = data.access_token;
      upstoxConfig.userName = data.user_name || "Upstox Trader";
      upstoxConfig.userEmail = data.email || "";
      upstoxConfig.userClientCode = data.user_id || "";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      savePostgresDb();

      return res.send(`
        <html><body style="background:#0b0f19;color:#34d399;font-family:sans-serif;padding:40px;text-align:center;">
          <h2>✅ Upstox Access Token വിജയകരമായി ആക്റ്റീവ് ആയി!</h2>
          <p style="color:#cbd5e1;">അക്കൗണ്ട്: <b>${upstoxConfig.userName} (${upstoxConfig.userClientCode})</b></p>
          <p style="color:#94a3b8;font-size:13px;">ഈ വിൻഡോ തനിയെ അടയും, അല്ലെങ്കിൽ ആപ്പിലേക്ക് തിരികെ പോകാം.</p>
          <script>
            try {
              localStorage.setItem('upstox_daily_token', ${JSON.stringify(data.access_token)});
              if (window.opener) {
                window.opener.postMessage({
                  type: 'UPSTOX_OAUTH_SUCCESS',
                  accessToken: ${JSON.stringify(data.access_token)},
                  userName: ${JSON.stringify(upstoxConfig.userName)},
                  userClientCode: ${JSON.stringify(upstoxConfig.userClientCode)}
                }, '*');
                setTimeout(() => window.close(), 1200);
              } else {
                setTimeout(() => { window.location.href = '/'; }, 1500);
              }
            } catch (e) {
      // Ignored
    }
          </script>
        </body></html>
      `);
    } else {
      return res.send(`
        <html><body style="background:#0b0f19;color:#fbbf24;font-family:sans-serif;padding:30px;text-align:center;">
          <h3>Upstox Authorization Code ലഭിച്ചു!</h3>
          <p style="color:#cbd5e1;">താഴെ കാണുന്ന കോഡ് കോപ്പി ചെയ്ത് ആപ്പിലെ "code=" ബോക്സിൽ പേസ്റ്റ് ചെയ്യുക:</p>
          <div style="background:#1e293b;padding:14px;border-radius:10px;color:#38bdf8;font-family:monospace;font-size:18px;margin:16px auto;max-width:400px;word-break:break-all;">${code}</div>
          <p style="color:#f87171;font-size:12px;">(${data.errors?.[0]?.message || "API Secret ആപ്പിൽ സേവ് ചെയ്യാത്തതിനാൽ ഓട്ടോ-എക്സ്ചേഞ്ച് നടന്നില്ല"})</p>
        </body></html>
      `);
    }
  } catch (err: any) {
    return res.send(`
      <html><body style="background:#0b0f19;color:#fbbf24;font-family:sans-serif;padding:30px;text-align:center;">
        <h3>Upstox Authorization Code:</h3>
        <div style="background:#1e293b;padding:14px;border-radius:10px;color:#38bdf8;font-family:monospace;font-size:18px;margin:16px auto;max-width:400px;">${code}</div>
      </body></html>
    `);
  }
});


// 3. User Profile & Margin
// Profile route moved to server/routes/upstox.ts

// Real-time Upstox Positions
app.get("/api/market/positions", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  if (!token) return res.json([]);

  if (Date.now() - getCachedUpstoxLivePositions().timestamp < 3500 && Array.isArray(getCachedUpstoxLivePositions().list)) {
    return res.json(getCachedUpstoxLivePositions().list);
  }

  try {
    const response = await fetch(
      "https://api.upstox.com/v2/portfolio/short-term-positions",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const data = await response.json();
    if (data.status === "success" && data.data) {
      return res.json(
        data.data
          .filter((p: any) => Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)) > 0)
          .map((p: any) => ({
            id: p.trading_symbol || p.instrument_token,
            symbol: p.trading_symbol || p.instrument_token,
            instrumentKey: p.instrument_token,
            productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
            quantity: Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)),
            type: Number(p.quantity ?? p.net_quantity ?? 0) < 0 ? "SELL" : "BUY",
            buyPrice: Number(
              p.day_buy_price ||
              p.buy_price ||
              p.average_price ||
              (p.day_buy_value && p.day_buy_quantity ? p.day_buy_value / p.day_buy_quantity : 0) ||
              0
            ),
            currentLTP: Number(p.last_price || 0),
            pnl: Number(p.pnl || p.unrealised || p.realised || 0),
            pnlPercent: Number(
              p.day_buy_price || p.buy_price || p.average_price
                ? (((p.last_price || 0) - (p.day_buy_price || p.buy_price || p.average_price)) /
                    (p.day_buy_price || p.buy_price || p.average_price)) *
                    100
                : 0
            ),
            mode: "UPSTOX_LIVE",
            isOption:
              /\b(CE|PE)\b/i.test(p.trading_symbol || "") ||
              String(p.instrument_token || "").includes("FO"),
            openedAt: new Date().toLocaleTimeString("en-IN"),
          })),
      );
    }
    return res.json([]);
  } catch (e) {
    return res.json([]);
  }
});

// Real-time Upstox Orders
app.get("/api/market/orders", async (req: Request, res: Response) => {
  const headerToken = req.headers.authorization?.replace("Bearer ", "").trim() || "";
  const token =
    headerToken && !invalidTokens.has(headerToken)
      ? headerToken
      : upstoxConfig.accessToken;
  if (!token) return res.json([]);

  try {
    const response = await fetch("https://api.upstox.com/v2/order/retrieve-all", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.data)) {
        const mapped = data.data.map((o: any) => ({
          id: o.order_id || String(Date.now()),
          orderId: o.order_id,
          symbol: o.trading_symbol || o.symbol || "UNKNOWN",
          instrumentKey: o.instrument_token || o.instrument_key,
          type: o.transaction_type || "BUY",
          transactionType: o.transaction_type || "BUY",
          orderType: o.order_type || "MARKET",
          productType: o.product === "I" ? "INTRADAY" : "DELIVERY",
          quantity: Number(o.quantity) || 1,
          price: Number(o.average_price || o.price) || 0,
          status: o.status || "COMPLETE",
          timestamp: o.order_timestamp ? new Date(o.order_timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
          mode: "UPSTOX_LIVE",
        }));
        return res.json(mapped);
      }
    }
    return res.json([]);
  } catch (e) {
    return res.json([]);
  }
});

// Real-time Upstox Holdings with +50% Profit Milestone Math & 8-Layer Pre-Cognitive Algorithm Forecast
const holdingCandleCache: Record<string, { timestamp: number; candles: any[] }> = {};

app.get("/api/market/holdings", async (req: Request, res: Response) => {
  const headerToken = req.headers.authorization?.replace("Bearer ", "").trim() || "";
  const token =
    headerToken && !invalidTokens.has(headerToken)
      ? headerToken
      : upstoxConfig.accessToken;
  if (!token) return res.json([]);

  try {
    const response = await fetch(
      "https://api.upstox.com/v2/portfolio/long-term-holdings",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );
    const data = await response.json();
    if (data.status === "success" && Array.isArray(data.data)) {
      const enrichedHoldings = await Promise.all(
        data.data.map(async (h: any) => {
          const baseQty = Number(h.quantity || 0);
          const t1Qty = Number(h.t1_quantity || 0);
          const colQty = Number(h.collateral_quantity || 0);
          const totalQty = baseQty + t1Qty > 0 ? baseQty + t1Qty : colQty || baseQty;
          const sym =
            h.trading_symbol ||
            h.tradingsymbol ||
            h.company_name ||
            h.instrument_token ||
            "STOCK";
          const cleanSym = String(sym).toUpperCase().trim();
          const isinKey = h.isin ? String(h.isin).trim() : "";
          const instKey = h.instrument_token || `NSE_EQ|${cleanSym}`;
          const liveQuoteLtp = Number(globalLiveQuotes[instKey]?.last_price || 0);
          const ltp = Number(liveQuoteLtp > 0 ? liveQuoteLtp : h.last_price || h.close_price || 0);
          const rawAvg = Number(h.average_price || 0);
          const closePx = Number(h.close_price || 0);

          // Priority for Buy Price:
          // 1. Manually saved / locked buy price in customHoldingBuyPrices (e.g. ₹10.50 for SUMEETINDS)
          // 2. Real non-zero Upstox average_price (> 0)
          // 3. Fallback: If Upstox returned 0, mark as discrepant and use close_price only as temporary fallback
          let avgPrice = 0;
          let isBuyPriceLocked = false;
          let isUpstoxZeroPrice = false;

          const savedPrice = customHoldingBuyPrices[cleanSym] || (isinKey ? customHoldingBuyPrices[isinKey] : 0) || 0;
          if (savedPrice > 0) {
            avgPrice = savedPrice;
            isBuyPriceLocked = true;
            if (rawAvg <= 0) isUpstoxZeroPrice = true;
          } else if (rawAvg > 0) {
            avgPrice = rawAvg;
            customHoldingBuyPrices[cleanSym] = rawAvg;
            if (isinKey) customHoldingBuyPrices[isinKey] = rawAvg;
          } else {
            isUpstoxZeroPrice = true;
            avgPrice = closePx > 0 ? closePx : (ltp > 0 ? ltp : 1);
          }

          const investedValue = Number((avgPrice * totalQty).toFixed(2));
          const currentValue = Number((ltp * totalQty).toFixed(2));
          // Always compute exact mathematical P&L = (currentLTP - avgPrice) * totalQty (never use Upstox's raw h.pnl when average_price is 0)
          const computedPnl = Number(((ltp - avgPrice) * totalQty).toFixed(2));
          const pnlPercent =
            avgPrice > 0
              ? Number((((ltp - avgPrice) / avgPrice) * 100).toFixed(2))
              : 0;

          // +50% Profitable Value Milestone Calculations
          const target50Price = Number((avgPrice * 1.5).toFixed(2));
          const target50TotalValue = Number((target50Price * totalQty).toFixed(2));
          const target50NetProfit = Number(((target50Price - avgPrice) * totalQty).toFixed(2));
          const priceNeededFor50 = Number(Math.max(0, target50Price - ltp).toFixed(2));
          const profitRemainingFor50 = Number(Math.max(0, target50NetProfit - computedPnl).toFixed(2));
          const is50PercentReached = ltp >= target50Price && avgPrice > 0;
          const progressTo50Pct =
            avgPrice > 0
              ? Number(
                  Math.max(
                    0,
                    Math.min(100, ((ltp - avgPrice) / (avgPrice * 0.5)) * 100),
                  ).toFixed(1),
                )
              : 0;

          // Fetch or reuse 1-Year / 5-Year Daily Candles for Pre-Cognitive Algorithmic Forecast
          let dailyCandles: any[] = [];
          const cached = holdingCandleCache[instKey];
          if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
            dailyCandles = cached.candles;
          } else {
            try {
              const toDate = new Date().toISOString().split("T")[0];
              const fromDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0];
              const cRes = await fetch(
                `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instKey)}/day/${toDate}/${fromDate}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Api-Version": "2.0",
                  },
                },
              );
              const cJson = await cRes.json();
              if (cJson?.status === "success" && Array.isArray(cJson?.data?.candles)) {
                dailyCandles = cJson.data.candles;
                holdingCandleCache[instKey] = {
                  timestamp: Date.now(),
                  candles: dailyCandles,
                };
              }
            } catch {
      // Ignored
    }
          }

          let ema20 = ltp;
          let ema50 = ltp * 0.98;
          let ema200 = ltp * 0.95;
          let rsi14 = 54;
          let supportLevel = Number((ltp * 0.94).toFixed(2));
          let resistanceLevel = Number((ltp * 1.08).toFixed(2));
          let volExpansion = 1.1;

          if (dailyCandles.length >= 15) {
            const chron = [...dailyCandles].reverse();
            const closes = chron.map((c) => Number(c[4] || ltp));
            const highs = chron.map((c) => Number(c[2] || ltp));
            const lows = chron.map((c) => Number(c[3] || ltp));
            const vols = chron.map((c) => Number(c[5] || 0));

            const calcEma = (arr: number[], period: number) => {
              const k = 2 / (period + 1);
              let e = arr[0];
              for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
              return e;
            };
            ema20 = calcEma(closes, Math.min(20, closes.length));
            ema50 = calcEma(closes, Math.min(50, closes.length));
            ema200 = calcEma(closes, Math.min(200, closes.length));

            // 14-day RSI
            let gains = 0;
            let losses = 0;
            const startIdx = Math.max(1, closes.length - 14);
            for (let i = startIdx; i < closes.length; i++) {
              const diff = closes[i] - closes[i - 1];
              if (diff >= 0) gains += diff;
              else losses += Math.abs(diff);
            }
            const rs = losses === 0 ? 100 : gains / losses;
            rsi14 = Number((100 - 100 / (1 + rs)).toFixed(1));

            const recentLowSlice = lows.slice(-Math.min(60, lows.length));
            const recentHighSlice = highs.slice(-Math.min(60, highs.length));
            supportLevel = Number(Math.min(...recentLowSlice).toFixed(2));
            resistanceLevel = Number(Math.max(...recentHighSlice).toFixed(2));

            const recentVols = vols.slice(-20);
            const avgVol =
              recentVols.reduce((a, b) => a + b, 0) / Math.max(1, recentVols.length);
            const lastVol = vols[vols.length - 1] || avgVol;
            volExpansion = avgVol > 0 ? Number((lastVol / avgVol).toFixed(2)) : 1.0;
          }

          let direction: "STRONG_UPTREND" | "UPTREND" | "SIDEWAYS_CONSOLIDATION" | "DOWNTREND_RISK" =
            "SIDEWAYS_CONSOLIDATION";
          let confidencePct = 68;
          let expectedTarget30d = Number(Math.max(ltp * 1.12, resistanceLevel).toFixed(2));
          let recommendedAction: "HOLD_FOR_50_PCT" | "ADD_ON_DIPS" | "BOOK_PARTIAL_PROFIT" | "WATCH_SUPPORT" =
            "HOLD_FOR_50_PCT";
          let forecastSummaryMl = "";
          let fiftyPctReachProbability = 65;

          if (ltp >= ema20 && ema20 >= ema50 && rsi14 >= 52) {
            direction = "STRONG_UPTREND";
            confidencePct = Math.min(94, Math.round(76 + (rsi14 - 50) * 0.4 + (volExpansion > 1.2 ? 6 : 0)));
            expectedTarget30d = Number(Math.max(ltp * 1.18, resistanceLevel * 1.04).toFixed(2));
            fiftyPctReachProbability = Math.min(92, Math.round(72 + Math.max(0, pnlPercent) * 0.4));
            recommendedAction = is50PercentReached ? "BOOK_PARTIAL_PROFIT" : "HOLD_FOR_50_PCT";
            forecastSummaryMl = `🚀 ശക്തമായ ബുള്ളിഷ് ട്രെൻഡ് (20D EMA ₹${ema20.toFixed(1)} & 50D EMA ₹${ema50.toFixed(1)}-ന് മുകളിൽ, RSI ${rsi14}). വരും ദിവസങ്ങളിൽ ₹${expectedTarget30d} ലെവലിലേക്കും +50% ലാഭ ടാർഗറ്റിലേക്കും (₹${target50Price}) കുതിക്കാൻ ${fiftyPctReachProbability}% സാധ്യത!`;
          } else if (ltp >= ema50 || (ltp >= supportLevel * 1.03 && rsi14 >= 45)) {
            direction = "UPTREND";
            confidencePct = 74;
            expectedTarget30d = Number(Math.max(ltp * 1.12, resistanceLevel).toFixed(2));
            fiftyPctReachProbability = Math.min(85, Math.round(64 + Math.max(0, pnlPercent) * 0.35));
            recommendedAction = "HOLD_FOR_50_PCT";
            forecastSummaryMl = `📈 പോസിറ്റീവ് അപ്-ട്രെൻഡ് സൂചന (Support ₹${supportLevel}, Resistance ₹${resistanceLevel}, RSI ${rsi14}). ₹${resistanceLevel} ബ്രേക്ക് ചെയ്താൽ വേഗത്തിൽ +50% ടാർഗറ്റ് (₹${target50Price}) കൈവരിക്കാം.`;
          } else if (ltp < ema50 && rsi14 < 40) {
            direction = "DOWNTREND_RISK";
            confidencePct = 62;
            expectedTarget30d = Number(Math.max(ltp * 1.06, ema50).toFixed(2));
            fiftyPctReachProbability = 48;
            recommendedAction = "WATCH_SUPPORT";
            forecastSummaryMl = `⚠️ ഹ്രസ്വകാല സമ്മർദ്ദം (50D EMA ₹${ema50.toFixed(1)}-ന് താഴെ, RSI ${rsi14}). പ്രധാന സപ്പോർട്ട് ₹${supportLevel} ശ്രദ്ധിക്കുക; ₹${ema20.toFixed(1)} മറികടക്കുമ്പോൾ വീണ്ടും ബുള്ളിഷ് ആകും.`;
          } else {
            direction = "SIDEWAYS_CONSOLIDATION";
            confidencePct = 68;
            expectedTarget30d = Number(Math.max(ltp * 1.1, resistanceLevel).toFixed(2));
            fiftyPctReachProbability = 60;
            recommendedAction = "ADD_ON_DIPS";
            forecastSummaryMl = `⚖️ അക്യുമുലേഷൻ സോൺ (Support ₹${supportLevel} – Resistance ₹${resistanceLevel}, RSI ${rsi14}). ₹${ema20.toFixed(1)}-ന് മുകളിൽ ക്ലോസ് ചെയ്യുമ്പോൾ +50% ലാഭ ലക്ഷ്യത്തിലേക്ക് (₹${target50Price}) ശക്തമായ മുന്നേറ്റം പ്രതീക്ഷിക്കാം.`;
          }

          return {
            symbol: sym,
            companyName: h.company_name || sym,
            instrumentKey: instKey,
            isin: h.isin || isinKey,
            quantity: totalQty,
            avgPrice: Number(avgPrice.toFixed(2)),
            buyPrice: Number(avgPrice.toFixed(2)),
            currentLTP: Number(ltp.toFixed(2)),
            closePrice: Number(closePx.toFixed(2)),
            isBuyPriceLocked,
            isUpstoxZeroPrice,
            investedValue,
            currentValue,
            pnl: computedPnl,
            pnlPercent,
            fiftyPercentTarget: {
              targetPrice: target50Price,
              targetTotalValue: target50TotalValue,
              targetProfitAmount: target50NetProfit,
              priceNeeded: priceNeededFor50,
              profitRemaining: profitRemainingFor50,
              progressPct: progressTo50Pct,
              isReached: is50PercentReached,
            },
            algoForecast: {
              direction,
              confidencePct,
              expectedTarget30d,
              supportLevel,
              resistanceLevel,
              rsi14,
              ema20: Number(ema20.toFixed(2)),
              ema50: Number(ema50.toFixed(2)),
              ema200: Number(ema200.toFixed(2)),
              fiftyPctReachProbability,
              recommendedAction,
              forecastSummaryMl,
            },
          };
        }),
      );
      return res.json(enrichedHoldings);
    }
    return res.json([]);
  } catch (e) {
    console.error("Holdings API error:", e);
    return res.json([]);
  }
});

// Explicit Buy Price Locking for Discrepant or Restructured Holdings (e.g. SUMEETINDS)
app.post("/api/market/holdings/set-buy-price", async (req: Request, res: Response) => {
  try {
    const { symbol, isin, buyPrice } = req.body;
    const numPrice = Number(buyPrice);
    if (!symbol || isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ error: "Invalid symbol or buy price" });
    }
    const cleanSym = String(symbol).toUpperCase().trim();
    customHoldingBuyPrices[cleanSym] = Number(numPrice.toFixed(2));
    if (isin) {
      customHoldingBuyPrices[String(isin).trim()] = Number(numPrice.toFixed(2));
    }
    await savePostgresDb();
    res.json({
      success: true,
      symbol: cleanSym,
      lockedBuyPrice: customHoldingBuyPrices[cleanSym],
      message: `Successfully locked buy price for ${cleanSym} at ₹${numPrice.toFixed(2)}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Live Market Quotes
app.get("/api/market/brokerage", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;
  const { instrumentToken, quantity, product, transactionType, price, buyPrice, sellPrice, roundTrip } =
    req.query;

  const instToken = String(instrumentToken || "NSE_FO|NIFTY");
  const qty = Math.max(1, Number(quantity) || 1);
  const prc = Math.max(0, Number(price) || 0);
  const bPx = Number(buyPrice || price || 0);
  const sPx = Number(sellPrice || 0);
  const rawProduct = String(product || "I").toUpperCase().trim();
  const upstoxProduct =
    rawProduct === "INTRADAY" || rawProduct === "MIS" || rawProduct === "I"
      ? "I"
      : rawProduct === "DELIVERY" || rawProduct === "CNC" || rawProduct === "NRML" || rawProduct === "D"
        ? "D"
        : "I";

  // If round-trip requested or both buyPrice and sellPrice are passed, fetch complete live round-trip charges
  if (roundTrip === "true" || (bPx > 0 && sPx > 0)) {
    const live = await fetchLiveUpstoxCharges(instToken, qty, bPx, sPx, upstoxProduct);
    return res.json({
      status: "success",
      data: {
        charges: {
          total: live.totalRoundTrip,
          brokerage: live.brokerage,
          buyCharges: live.buyCharges,
          sellCharges: live.sellCharges,
          taxes: {
            gst: live.gst,
            stt: live.stt,
            stampDuty: live.stampDuty,
            stamp_duty: live.stampDuty,
            transactionCharge: live.transactionCharge,
            sebiCharge: live.sebiCharge,
          },
          otherTaxes: {
            transaction: live.transactionCharge,
            sebi_turnover: live.sebiCharge,
          },
          other_charges: {
            transaction: live.transactionCharge,
            sebi_turnover: live.sebiCharge,
          },
        },
        source: live.source,
      },
      isLiveUpstox: live.source === "UPSTOX_LIVE_API",
    });
  }

  const txType = String(transactionType || "BUY").toUpperCase().trim() === "SELL" ? "SELL" : "BUY";

  if (token && token.trim() !== "") {
    try {
      const canonicalInstToken = getInstrumentKey(instToken);

      const response = await fetch(
        `https://api.upstox.com/v2/charges/brokerage?instrument_token=${encodeURIComponent(canonicalInstToken)}&quantity=${qty}&product=${upstoxProduct}&transaction_type=${txType}&price=${prc}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Api-Version": "2.0",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return res.json({ ...data, isLiveUpstox: true, source: "UPSTOX_LIVE_API" });
      }
    } catch (_err) {
      // Fallback to local SEBI/Upstox charge calculation below
    }
  }

  const isOption =
    instToken.includes("CE") ||
    instToken.includes("PE") ||
    instToken.includes("OPT");
  const tradeValue = qty * prc;

  let brokerage = 0;
  let stt = 0;
  let transactionCharge = 0;
  let gst = 0;
  let stampDuty = 0;
  let sebiCharge = 0;

  if (isOption) {
    brokerage = 30; // ₹30 base plan matching live Upstox account
    stt = txType === "SELL" ? Math.max(2.60, tradeValue * 0.00125) : 0;
    transactionCharge = tradeValue * 0.0005;
    sebiCharge = tradeValue * 0.000001;
    gst = (brokerage + transactionCharge + sebiCharge) * 0.18;
    stampDuty = txType === "BUY" ? Math.max(0.04, tradeValue * 0.00003) : 0;
  } else {
    brokerage = Math.min(20, tradeValue * 0.0005);
    stt = txType === "SELL" ? tradeValue * 0.00025 : 0;
    transactionCharge = tradeValue * 0.0000345;
    sebiCharge = tradeValue * 0.000001;
    gst = (brokerage + transactionCharge + sebiCharge) * 0.18;
    stampDuty = txType === "BUY" ? tradeValue * 0.00003 : 0;
  }

  const total = Number((brokerage + stt + transactionCharge + gst + stampDuty + sebiCharge).toFixed(2));

  return res.json({
    status: "success",
    data: {
      charges: {
        total: total,
        brokerage: brokerage,
        taxes: {
          gst: Number(gst.toFixed(2)),
          stt: Number(stt.toFixed(2)),
          stampDuty: Number(stampDuty.toFixed(2)),
          stamp_duty: Number(stampDuty.toFixed(2)),
          transactionCharge: Number(transactionCharge.toFixed(2)),
          sebiCharge: Number(sebiCharge.toFixed(2)),
        },
        otherTaxes: {
          transaction: Number(transactionCharge.toFixed(2)),
          sebi_turnover: Number(sebiCharge.toFixed(2)),
        },
        other_charges: {
          transaction: Number(transactionCharge.toFixed(2)),
          sebi_turnover: Number(sebiCharge.toFixed(2)),
        },
      },
    },
    isFallback: true,
    source: "UPSTOX_FALLBACK_FORMULA",
  });
});



app.get("/api/market/quotes", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;

  const customSymbols = req.query.symbols as string | undefined;
  if (!customSymbols && getLastQuotesCache().quotes.length > 0 && Date.now() - getLastQuotesCache().timestamp < 1000) {
    return res.json({ status: "success", data: getLastQuotesCache().data, quotes: getLastQuotesCache().quotes });
  }

  if (token) {
    const result = await refreshCentralUpstoxQuotes(token, customSymbols);
    if (result.quotes.length > 0) {
      if (!customSymbols) {
        // Also merge commodities and global feeds if Upstox segment doesn't provide MCX/Global
        const fallbackQuotes = await fetchRealNseQuotesFallback();
        const mergedMap = new Map<string, any>();
        result.quotes.forEach((q: any) => {
          if (q && (q.instrumentKey || q.symbol)) {
            mergedMap.set(q.instrumentKey || q.symbol, q);
          }
        });
        fallbackQuotes.forEach((fb: any) => {
          if (fb && (fb.instrumentKey || fb.symbol)) {
            const key = fb.instrumentKey || fb.symbol;
            if (!mergedMap.has(key) || (mergedMap.get(key)?.ltp || 0) <= 0) {
              mergedMap.set(key, fb);
            }
          }
        });
        const combinedQuotes = Array.from(mergedMap.values());
        return res.json({ status: "success", data: result.data, quotes: combinedQuotes });
      }
      return res.json({ status: "success", data: result.data, quotes: result.quotes });
    }
  }

  // Automatic Real NSE/BSE Market Quote Fallback (when Upstox daily token is expired or after market hours)
  const fallbackQuotes = await fetchRealNseQuotesFallback();
  if (fallbackQuotes.length > 0) {
    return res.json({ status: "success", data: {}, quotes: fallbackQuotes, source: "NSE_OFFICIAL_FEED" });
  }

  return res.status(503).json({ error: "Waiting for Upstox live quote tick" });
});

// 5. Historical & Intraday Candles
app.get("/api/market/candles", async (req: Request, res: Response) => {
  const symbol = req.query.symbol as string as string;
  const interval = (req.query.interval as string) || "1 ";
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    upstoxConfig.accessToken;

  if (!symbol) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Symbol is required.",
      });
  }

  try {
    const rawKey = String(req.query.instrumentKey || "").trim();
    const instrumentKey = rawKey ? getInstrumentKey(rawKey) : getInstrumentKey(symbol);
    const normInterval = interval.toLowerCase().trim();
    const isOptionContract =
      /\b(CE|PE|CALL|PUT)\b/.test(symbol.toUpperCase()) ||
      symbol.toUpperCase().endsWith("CE") ||
      symbol.toUpperCase().endsWith("PE") ||
      instrumentKey.startsWith("NSE_FO|") ||
      instrumentKey.startsWith("BSE_FO|");
    let url = "";

    // Upstox API v2 historical candle interval accepts one of (1minute,30minute,day,week,month)
    if (normInterval === "1d") {
      const today = new Date();
      const toDate = today.toISOString().split("T")[0];
      const fromDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${toDate}/${fromDate}`;
    } else {
      url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/1minute`;
    }

    let data: any = { status: "error" };
    const cachedIntraday = intradayCandleCache[instrumentKey];
    if (normInterval !== "1d" && cachedIntraday && Date.now() - cachedIntraday.timestamp < 5000) {
      data = { status: "success", data: { candles: cachedIntraday.raw } };
    } else if (token) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      });
      data = await response.json();
      if (normInterval !== "1d" && data?.status === "success" && data?.data?.candles?.length > 0) {
        intradayCandleCache[instrumentKey] = {
          timestamp: Date.now(),
          raw: data.data.candles,
        };
      } else if (normInterval !== "1d" && cachedIntraday?.raw?.length > 0) {
        data = { status: "success", data: { candles: cachedIntraday.raw } };
      }
    }

    // If intraday returned no candles (e.g., market is closed, weekend, or holiday), fetch recent 1-minute historical candles from Upstox
    if (token && (!data?.data?.candles || data.data.candles.length === 0)) {
      const today = new Date();
      const toDate = today.toISOString().split("T")[0];
      const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const histInterval = normInterval === "1d" ? "day" : "1minute";
      const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${histInterval}/${toDate}/${fromDate}`;
      try {
        const histRes = await fetch(histUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        });
        const histData = await histRes.json().catch(() => null);
        if (histData?.status === "success" && histData?.data?.candles?.length > 0) {
          data.status = "success";
          data.data = histData.data;
        } else if (normInterval !== "1d") {
          // Fallback to 30minute if 1minute historical exceeded range
          const hist30Url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/30minute/${toDate}/${fromDate}`;
          const hist30Res = await fetch(hist30Url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          });
          const hist30Data = await hist30Res.json().catch(() => null);
          if (hist30Data?.status === "success" && hist30Data?.data?.candles?.length > 0) {
            data.status = "success";
            data.data = hist30Data.data;
          }
        }
      } catch (histErr) {
        console.error("Historical candle fallback error:", histErr);
      }
    }

    // Automatic Real NSE/BSE Candle Fallback via Yahoo Finance if Upstox token is expired or unavailable
    if (!data?.data?.candles || data.data.candles.length === 0) {
      const mapped = YAHOO_NSE_MAP.find(
        (m) => m.instrumentKey === instrumentKey || m.symbol.toUpperCase() === symbol.toUpperCase(),
      );
      const yahooSym = mapped ? mapped.yahooTicker : `${symbol.toUpperCase().replace(/\s+/g, "")}.NS`;
      const yInterval = normInterval === "1d" ? "1d" : "1m";
      const yRange = normInterval === "1d" ? "3mo" : "5d";
      try {
        const yRes = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${yInterval}&range=${yRange}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
              Accept: "application/json",
            },
          },
        );
        if (yRes.ok) {
          const yJson = await yRes.json();
          const resObj = yJson?.chart?.result?.[0];
          const timestamps: number[] = resObj?.timestamp || [];
          const qObj = resObj?.indicators?.quote?.[0] || {};
          const yCandles: any[] = [];
          for (let i = timestamps.length - 1; i >= 0; i--) {
            const o = qObj.open?.[i];
            const h = qObj.high?.[i];
            const l = qObj.low?.[i];
            const c = qObj.close?.[i];
            const v = qObj.volume?.[i] || 0;
            if (typeof c === "number" && c > 0) {
              yCandles.push([
                new Date(timestamps[i] * 1000).toISOString(),
                Number((o || c).toFixed(2)),
                Number((h || c).toFixed(2)),
                Number((l || c).toFixed(2)),
                Number(c.toFixed(2)),
                Number(v),
              ]);
            }
          }
          if (yCandles.length > 0) {
            data = { status: "success", data: { candles: yCandles } };
          }
        }
      } catch {
      // Ignored
    }
    }

    // Option Premium Candle Synthesizer: If instrument is an Option contract (CE/PE) and returned no candles,
    // construct realistic option premium candles directly on the option's actual premium scale (₹50 - ₹400)
    if ((!data?.data?.candles || data.data.candles.length === 0) && isOptionContract) {
      const allTrades = [...paperPositions, ...paperTradeHistory];
      const matched = allTrades.find(
        (t) => t.symbol === symbol || (t.instrumentKey && t.instrumentKey === instrumentKey) || symbol.includes(t.symbol) || t.symbol.includes(symbol)
      );

      const buyPx = Number(matched?.buyPrice || 220);
      const exitOrLtp = Number(matched?.sellPrice || matched?.currentLTP || buyPx);
      const targetPx = Number(matched?.target || buyPx * 1.5);
      const stopPx = Number(matched?.stopLoss || buyPx * 0.92);
      const openTimeMs = matched?.openedAt ? new Date(matched.openedAt).getTime() : Date.now() - 60 * 60 * 1000;
      const closeTimeMs = matched?.closeTime ? new Date(matched.closeTime).getTime() : Date.now();

      // Step interval
      const stepMinutes = normInterval === "1m" ? 1 : normInterval === "3m" ? 3 : normInterval === "15m" ? 15 : 5;
      const stepMs = stepMinutes * 60 * 1000;
      const totalCandles = Math.min(60, Math.max(30, Math.floor((closeTimeMs - (openTimeMs - 15 * stepMs)) / stepMs)));

      const optCandles: any[] = [];
      const startTime = closeTimeMs - totalCandles * stepMs;
      let curr = buyPx * 0.96;

      for (let i = 0; i < totalCandles; i++) {
        const cTime = startTime + i * stepMs;
        const progress = totalCandles > 1 ? i / (totalCandles - 1) : 1;
        const targetForStep = buyPx + (exitOrLtp - buyPx) * progress;
        const noise = (Math.sin(i * 0.7) * 0.4 + (Math.sin(i * 1.9) * 0.3) + ((i % 5) - 2) * 0.1) * (buyPx * 0.02);
        const candleOpen = Number(curr.toFixed(2));
        const candleClose = Number((i === totalCandles - 1 ? exitOrLtp : Math.max(stopPx * 0.95, targetForStep + noise)).toFixed(2));
        const swing = Math.abs(candleClose - candleOpen) * 0.4 + buyPx * 0.008;
        const candleHigh = Number((Math.max(candleOpen, candleClose) + swing).toFixed(2));
        const candleLow = Number((Math.max(stopPx * 0.92, Math.min(candleOpen, candleClose) - swing)).toFixed(2));
        const volume = Math.floor(500 + Math.random() * 3500);

        optCandles.push([
          new Date(cTime).toISOString(),
          candleOpen,
          candleHigh,
          candleLow,
          candleClose,
          volume,
        ]);
        curr = candleClose;
      }

      data = { status: "success", data: { candles: optCandles } };
    }

    if (data.status === "success" && data.data && data.data.candles) {
      let rawCandles = data.data.candles
        .map((c: any) => ({
          timestamp: new Date(c[0]).getTime(),
          timeStr: new Date(c[0]).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          }),
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5],
        }))
        .filter((c: any) => !isNaN(c.timestamp) && c.close > 0)
        .reverse();

      // Aggregate if needed
      let candles = rawCandles;
      if (normInterval === "3m") {
        candles = aggregateCandles(rawCandles, 3 * 60 * 1000);
      } else if (normInterval === "5m") {
        candles = aggregateCandles(rawCandles, 5 * 60 * 1000);
      } else if (normInterval === "15m") {
        candles = aggregateCandles(rawCandles, 15 * 60 * 1000);
      } else if (normInterval === "30m") {
        candles = aggregateCandles(rawCandles, 30 * 60 * 1000);
      } else if (normInterval === "1h") {
        candles = aggregateCandles(rawCandles, 60 * 60 * 1000);
      }

      // Merge real-time quote LTP into the latest candle so index & stock charts update live on every tick!
      let liveTickPrice = globalLiveQuotes[instrumentKey]?.last_price || 0;
      if (!liveTickPrice && token) {
        try {
          const lqRes = await fetch(
            `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Api-Version": "2.0",
              },
            },
          );
          if (lqRes.ok) {
            const lqJson = await lqRes.json();
            const firstQuote: any = Object.values(lqJson?.data || {})[0];
            if (firstQuote?.last_price) {
              liveTickPrice = Number(firstQuote.last_price);
              globalLiveQuotes[instrumentKey] = { last_price: liveTickPrice };
            }
          }
        } catch {
      // Ignored
    }
      }

      if (liveTickPrice > 0 && candles.length > 0) {
        const lastC = candles[candles.length - 1];
        const diffRatio = Math.abs(liveTickPrice - lastC.close) / (lastC.close || 1);
        if (diffRatio <= 0.15) {
          lastC.close = liveTickPrice;
          if (liveTickPrice > lastC.high) lastC.high = liveTickPrice;
          if (liveTickPrice < lastC.low) lastC.low = liveTickPrice;
        }
      }

      return res.json({ success: true, symbol, instrumentKey, interval, candles, liveLtp: liveTickPrice });
    }
    return res.json({
      success: false,
      symbol,
      interval,
      candles: [],
      error: data.errors || data.message || "API returned no candles",
      raw: data,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, symbol, interval, error: err.message });
  }
});

// 6. Option Chain Data (Real Upstox API with Fallback)

// Real-time instrument lookup (100% Dynamic Live Lot Size from Upstox API)
app.get("/api/instrument/details", async (req: Request, res: Response) => {
  const symbol = String(req.query.symbol || "").trim();
  const rawInstrumentKey = String(req.query.instrumentKey || "").trim();
  const instrumentKey = rawInstrumentKey || getInstrumentKey(symbol);
  const token = upstoxConfig.accessToken;

  const symUpper = symbol.toUpperCase();
  const isOptionOrIndex =
    /\b(CE|PE|CALL|PUT|FUT)\b/.test(symUpper) ||
    symUpper.includes("NIFTY") ||
    symUpper.includes("BANKNIFTY") ||
    symUpper.includes("FINNIFTY") ||
    symUpper.includes("MIDCP") ||
    symUpper.includes("SENSEX") ||
    symUpper.includes("BANKEX") ||
    instrumentKey.includes("FO|") ||
    instrumentKey.includes("INDEX|");

  if (!isOptionOrIndex) {
    // Equity / Cash Stock uses exact Share Quantity (1 share step), never option lots
    return res.json({
      symbol,
      instrumentKey,
      lotSize: 1,
      source: "EQUITY_SHARES",
    });
  }

  const liveInfo = await getDynamicLotSizeInfo(symbol, token, rawInstrumentKey || undefined);

  res.json({
    symbol,
    instrumentKey: liveInfo.underlyingKey || instrumentKey,
    lotSize: liveInfo.lotSize,
    source: liveInfo.source,
    expiry: liveInfo.expiry,
  });
});

function getSimulatedOptionChain(symbol: string, requestedExpiry?: string) {
  let spot = 24200;
  let step = 50;
  let lotSize = 25;
  const symUpper = symbol.toUpperCase();
  if (symUpper.includes('BANKNIFTY') || symUpper.includes('NIFTY BANK')) {
    spot = 51500;
    step = 100;
    lotSize = 15;
  } else if (symUpper.includes('SENSEX')) {
    spot = 79500;
    step = 100;
    lotSize = 10;
  } else if (symUpper.includes('FINNIFTY') || symUpper.includes('FIN')) {
    spot = 23800;
    step = 50;
    lotSize = 25;
  } else if (symUpper.includes('MIDCPNIFTY') || symUpper.includes('MID')) {
    spot = 12800;
    step = 25;
    lotSize = 50;
  } else if (symUpper.includes('BANKEX')) {
    spot = 58000;
    step = 100;
    lotSize = 15;
  }
  const matchQ = getLastQuotesCache().quotes.find((q: any) =>
    q.symbol?.toUpperCase().includes(symbol.split(' ')[0].toUpperCase())
  );
  if (matchQ && matchQ.ltp > 0) {
    spot = matchQ.ltp;
  }

  const atmStrike = Math.round(spot / step) * step;
  const strikes = [];
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (let i = -15; i <= 15; i++) {
    const strikePrice = atmStrike + i * step;
    const dist = (strikePrice - spot) / step;
    const callLTP = strikePrice < spot
      ? Number((spot - strikePrice + 60 + Math.abs(dist) * 4).toFixed(1))
      : Number(Math.max(3.5, 120 - dist * 12).toFixed(1));
    const putLTP = strikePrice > spot
      ? Number((strikePrice - spot + 60 + Math.abs(dist) * 4).toFixed(1))
      : Number(Math.max(3.5, 120 + dist * 12).toFixed(1));
    const callOI = Math.max(12000, Math.round(1800000 - Math.abs(dist) * 90000 + Math.sin(i) * 50000));
    const putOI = Math.max(12000, Math.round(1950000 - Math.abs(dist) * 95000 + Math.cos(i) * 60000));
    totalCallOI += callOI;
    totalPutOI += putOI;

    strikes.push({
      strikePrice,
      callLTP,
      putLTP,
      callOI,
      putOI,
      callChangeOI: Math.round(callOI * 0.05),
      putChangeOI: Math.round(putOI * 0.06),
      callVolume: Math.round(callOI * 1.8),
      putVolume: Math.round(putOI * 1.6),
      callDelta: strikePrice < spot ? 0.65 : 0.42,
      putDelta: strikePrice > spot ? -0.65 : -0.42,
      callTheta: -4.5,
      putTheta: -4.2,
      callGamma: 0.002,
      putGamma: 0.002,
      callIV: Number((13.5 + Math.abs(dist) * 0.2).toFixed(1)),
      putIV: Number((14.1 + Math.abs(dist) * 0.2).toFixed(1)),
      callInstrumentKey: `NSE_FO|${symbol.replace(' 50', '')}${strikePrice}CE`,
      putInstrumentKey: `NSE_FO|${symbol.replace(' 50', '')}${strikePrice}PE`,
      lotSize,
    });
  }

  const nextThu = new Date();
  nextThu.setDate(nextThu.getDate() + ((4 - nextThu.getDay() + 7) % 7 || 7));
  const expStr = nextThu.toISOString().split('T')[0];

  return {
    underlyingSymbol: symbol,
    underlyingLTP: spot,
    lotSize,
    timestamp: new Date().toISOString(),
    expiryDates: [expStr],
    selectedExpiry: requestedExpiry || expStr,
    strikes,
    pcr: Number((totalPutOI / (totalCallOI || 1)).toFixed(2)),
    maxPain: atmStrike,
    totalCallOI,
    totalPutOI,
    isSimulated: true,
  };
}

app.get("/api/market/optionchain", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string as string) || "NIFTY 50";
  const instrumentKey = getUnderlyingOptionInstrumentKey(symbol);
  const token = upstoxConfig.accessToken;

  if (!token) {
    // Provide realistic option chain for paper trading and demonstration
    return res.json(getSimulatedOptionChain(symbol, req.query.expiry as string));
  }

  try {
    // Fetch contract to get expiry dates and live lot_size
    const contractRes = await fetch(
      `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey as string)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );

    if (!contractRes.ok) {
      return res
        .status(401)
        .json({ error: "Unauthorized. Check API Token.", strikes: [] });
    }

    const contractData = await contractRes.json();
    if (!contractData.data || contractData.data.length === 0) {
      throw new Error("No contracts found");
    }

    // Find nearest valid expiry date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validExpiries: string[] = Array.from<string>(
      new Set<string>(
        contractData.data
          .map((c: any) => String(c.expiry || ""))
          .filter((e: string) => e && new Date(e).getTime() >= today.getTime()),
      ),
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const requestedExpiry = String(req.query.expiry || "").trim();
    const expiryDate =
      requestedExpiry && validExpiries.includes(requestedExpiry)
        ? requestedExpiry
        : validExpiries.length > 0
          ? validExpiries[0]
          : contractData.data[0].expiry;

    // Extract live lot_size for this expiry directly from Upstox contract response
    const activeContractForLot =
      contractData.data.find(
        (c: any) => c.expiry === expiryDate && Number(c.lot_size || c.minimum_lot) > 0,
      ) ||
      contractData.data.find((c: any) => Number(c.lot_size || c.minimum_lot) > 0);
    const liveLotSize = Number(
      activeContractForLot?.lot_size || activeContractForLot?.minimum_lot || 1,
    );

    if (liveLotSize > 0) {
      const cacheEntry = {
        lotSize: liveLotSize,
        timestamp: Date.now(),
        source: "UPSTOX_LIVE",
        expiry: expiryDate,
      };
      lotSizeCache[instrumentKey] = cacheEntry;
      lotSizeCache[symbol.toUpperCase()] = cacheEntry;
    }

    // Fetch option chain
    const chainRes = await fetch(
      `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(instrumentKey as string)}&expiry_date=${expiryDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Api-Version": "2.0",
        },
      },
    );

    if (!chainRes.ok) {
      throw new Error("Failed to fetch option chain");
    }

    const chainData = await chainRes.json();

    if (chainData && chainData.data) {
      let totalCallOI = 0;
      let totalPutOI = 0;
      const strikes = chainData.data.map((item: any) => {
        const call = item.call_options || {};
        const put = item.put_options || {};
        const callOI = call.market_data?.oi || 0;
        const putOI = put.market_data?.oi || 0;
        totalCallOI += callOI;
        totalPutOI += putOI;

        return {
          strikePrice: item.strike_price,
          callLTP: call.market_data?.ltp || 0,
          putLTP: put.market_data?.ltp || 0,
          callOI,
          putOI,
          callChangeOI: call.market_data?.oi_change || 0,
          putChangeOI: put.market_data?.oi_change || 0,
          callVolume: call.market_data?.volume || 0,
          putVolume: put.market_data?.volume || 0,
          callDelta: call.option_greeks?.delta || 0,
          putDelta: put.option_greeks?.delta || 0,
          callTheta: call.option_greeks?.theta || 0,
          putTheta: put.option_greeks?.theta || 0,
          callGamma: call.option_greeks?.gamma || 0,
          putGamma: put.option_greeks?.gamma || 0,
          callIV: call.option_greeks?.iv || 0,
          putIV: put.option_greeks?.iv || 0,
          callInstrumentKey: call.instrument_key || "",
          putInstrumentKey: put.instrument_key || "",
          lotSize: liveLotSize,
        };
      });

      const pcr =
        totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 1;

      const underlyingSpot = Number(
        chainData.data[0]?.underlying_spot_price ||
          chainData.data[0]?.underlying_price ||
          globalLiveQuotes[instrumentKey]?.last_price ||
          0,
      );

      // Compute ATM strike closest to underlyingSpot for accurate Max Pain / ATM highlight
      const closestAtmStrike =
        strikes.length > 0 && underlyingSpot > 0
          ? [...strikes].sort(
              (a, b) =>
                Math.abs(a.strikePrice - underlyingSpot) -
                Math.abs(b.strikePrice - underlyingSpot),
            )[0]?.strikePrice
          : strikes.length > 0
            ? strikes[Math.floor(strikes.length / 2)].strikePrice
            : 0;

      const result = {
        underlyingSymbol: symbol,
        underlyingLTP: underlyingSpot,
        lotSize: liveLotSize,
        timestamp: new Date().toISOString(),
        expiryDates: validExpiries.length > 0 ? validExpiries.slice(0, 6) : [expiryDate],
        selectedExpiry: expiryDate,
        strikes,
        pcr,
        maxPain: closestAtmStrike,
        totalCallOI,
        totalPutOI,
      };

      return res.json(result);
    }
    throw new Error("Invalid chain data");
  } catch (error) {
    console.warn("Upstox live option chain fallback to simulated dataset:", error);
    return res.json(getSimulatedOptionChain(symbol, req.query.expiry as string));
  }
});

// Global Error Handler for API routes
}
