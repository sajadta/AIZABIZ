// Upstox market configuration, authentication, holdings and market-data routes.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, botLogs, invalidTokens, FIXED_PRIMARY_IP, FIXED_SECONDARY_IP } from "../state";
import { isJwtTokenActuallyExpired, saveTokenBackupToDisk } from "../lib/tokens";
import { isUpstoxAuthFailureError } from "../utils";
import { syncTokenFromRenderWebhookBridge, getLiveOutboundIp, lastVerifiedTokenStatus, setLastVerifiedTokenStatus } from "../services/tokenSync";
import { getLastWebhookDiagnostic } from "../state";
import { registerOtpRoutes } from "./market/otp";
import { registerAuthConfigRoutes } from "./market/auth";
import { registerWebhookRoutes } from "./market/webhook";
import { registerOauthRoutes } from "./market/oauth";
import { registerPositionRoutes } from "./market/positions";
import { registerHoldingsRoutes } from "./market/holdings";
import { registerMarketDataRoutes } from "./market/dataRoutes";
import { registerOptionChainRoutes } from "./market/optionChain";

export function registerMarketRoutes(app: express.Application) {
  registerOtpRoutes(app);
  registerAuthConfigRoutes(app);
  registerWebhookRoutes(app);
  registerOauthRoutes(app);
  registerPositionRoutes(app);
  registerHoldingsRoutes(app);
  registerMarketDataRoutes(app);
  registerOptionChainRoutes(app);
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

// 3. User Profile & Margin
// Profile route moved to server/routes/upstox.ts

// Global Error Handler for API routes
}
