// Upstox configuration, proxy, daily-token, clear-token and validate-token routes.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, botConfig, invalidTokens, setCachedUpstoxLivePositions } from "../../state";
import { isUpstoxAuthFailureError } from "../../utils";
import { saveTokenBackupToDisk } from "../../lib/tokens";
import { savePostgresDb } from "../../services/persistence";
import { testProxyConnectivity, markProxyUnhealthy } from "../../services/upstoxTransport";
import { publishTokenToCloudRelay, getLiveOutboundIp, resetVerifiedTokenCache } from "../../services/tokenSync";

export function registerAuthConfigRoutes(app: express.Application) {
  app.post("/api/market/proxy-config", async (req: Request, res: Response) => {
    const { proxyUrl } = req.body;
    const targetProxy = typeof proxyUrl === "string" ? proxyUrl.trim() : "";
    if (!targetProxy) {
      upstoxConfig.outboundProxyUrl = "";
      markProxyUnhealthy("Proxy removed by user");
      await savePostgresDb().catch(() => { /* ignore */ });
      const fallbackIp = await getLiveOutboundIp();
      return res.json({
        success: true,
        message: "Proxy removed. Reverted to direct IPv4 connection.",
        isFixedProxy: false,
        serverOutboundIp: fallbackIp.actualDetectedIp || fallbackIp.secondaryIp,
      });
    }

    const testRes = await testProxyConnectivity(targetProxy, 7500);
    if (testRes.online && testRes.detectedIp) {
      upstoxConfig.outboundProxyUrl = targetProxy;
      await savePostgresDb().catch(() => { /* ignore */ });

      return res.json({
        success: true,
        message: `✅ Fixed IP Proxy connected! Outbound Static IP: ${testRes.detectedIp}`,
        serverOutboundIp: testRes.detectedIp,
        isFixedProxy: true,
        tcpOpen: true,
      });
    }

    const fallbackIp = await getLiveOutboundIp();
    const currentContainerIp = fallbackIp.actualDetectedIp || fallbackIp.secondaryIp;
    const isSocks = targetProxy.toLowerCase().startsWith("socks");
    const suggestedFix = testRes.tcpOpen
      ? isSocks
        ? "Verify SOCKS5 proxy credentials (username/password) and IPv4 outbound access on 34.180.11.27:1080."
        : "Run in GCP SSH: sudo systemctl restart tinyproxy"
      : isSocks
        ? "Ensure GCP Firewall allows TCP port 1080 (allow-socks5-1080) and dante/socks5 service is running."
        : "Ensure GCP Firewall allows TCP port 8888 and HTTP proxy service is running.";

    return res.status(400).json({
      success: false,
      tcpOpen: testRes.tcpOpen,
      containerIp: currentContainerIp,
      suggestedFix,
      error: `Proxy HTTPS test failed: ${testRes.error || "Could not reach proxy"}. Direct IPv4 fallback stays active.`,
    });
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
            if (!botConfig.userExplicitlySelectedMode) {
              botConfig.mode = "UPSTOX_LIVE";
            }
            resetVerifiedTokenCache();
            setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
            saveTokenBackupToDisk(token, upstoxConfig);
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
      const cleanToken = accessToken.replace(/^Bearer\s+/i, "").trim();
      upstoxConfig.accessToken = cleanToken;
      invalidTokens.delete(cleanToken);
      resetVerifiedTokenCache();
      setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
      saveTokenBackupToDisk(cleanToken, upstoxConfig);
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
        resetVerifiedTokenCache();
        setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
        saveTokenBackupToDisk(token, upstoxConfig);
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
        resetVerifiedTokenCache();
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
    resetVerifiedTokenCache();
    setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
    saveTokenBackupToDisk("", upstoxConfig);
    savePostgresDb().catch(() => { /* ignore */ });
    res.json({
      success: true,
      message: "Daily Upstox token cleared. Switched to Paper Trading Mode.",
    });
  });

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
}
