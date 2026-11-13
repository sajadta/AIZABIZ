// Upstox postback / notifier webhook and OAuth callback handler.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, botConfig, botLogs, invalidTokens, setLastWebhookDiagnostic, setCachedUpstoxLivePositions } from "../../state";
import { saveTokenBackupToDisk } from "../../lib/tokens";
import { savePostgresDb } from "../../services/persistence";
import { publishTokenToCloudRelay, resetVerifiedTokenCache } from "../../services/tokenSync";

export function registerWebhookRoutes(app: express.Application) {
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
          if (!botConfig.userExplicitlySelectedMode) {
            botConfig.mode = "UPSTOX_LIVE";
          }
          invalidTokens.delete(data.access_token);
          resetVerifiedTokenCache();
          setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
          saveTokenBackupToDisk(data.access_token, upstoxConfig);
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
        if (!botConfig.userExplicitlySelectedMode) {
          botConfig.mode = "UPSTOX_LIVE";
        }
        invalidTokens.delete(cleanToken);
        resetVerifiedTokenCache();
        setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
        saveTokenBackupToDisk(cleanToken, upstoxConfig);
        await savePostgresDb().catch(() => { /* ignore */ });
        publishTokenToCloudRelay(cleanToken).catch(() => { /* ignore */ });
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
}
