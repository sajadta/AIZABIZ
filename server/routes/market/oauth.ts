// Upstox V3 token request, auth-url, token exchange and OAuth callback routes.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, botConfig, invalidTokens, setCachedUpstoxLivePositions } from "../../state";
import { saveTokenBackupToDisk } from "../../lib/tokens";
import { savePostgresDb } from "../../services/persistence";
import { publishTokenToCloudRelay, resetVerifiedTokenCache } from "../../services/tokenSync";

export function registerOauthRoutes(app: express.Application) {
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

      const rawText = await response.text().catch(() => "");
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { message: rawText.slice(0, 200) };
      }
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
          `Upstox V3 Token Request അയക്കാൻ കഴിഞ്ഞില്ല (HTTP ${response.status} — Upstox Developer App-ൽ Notifier Webhook URL സജ്ജീകരിച്ചിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക).`;
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
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.headers.host || "localhost:3000";
    const redirectUri =
      (req.query.redirectUri as string) || upstoxConfig.redirectUri || `${protocol}://${host}/api/market/callback`;

    if (!apiKey) {
      return res.status(400).json({
        error: "API Key is required to generate Upstox login dialog URL",
      });
    }

    const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json({ loginUrl, redirectUri });
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
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.headers.host || "localhost:3000";
    const uri = (redirectUri || detectedRedirectUri || upstoxConfig.redirectUri || `${protocol}://${host}/api/market/callback`).trim();

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
        if (!botConfig.userExplicitlySelectedMode) {
          botConfig.mode = "UPSTOX_LIVE";
        }
        invalidTokens.delete(data.access_token);
        resetVerifiedTokenCache();
        setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
        saveTokenBackupToDisk(data.access_token, upstoxConfig);
        savePostgresDb().catch(() => { /* ignore */ });
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
        upstoxConfig.userEmail = data.email || upstoxConfig.userEmail || "";
        upstoxConfig.userClientCode = data.user_id || "";
        upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
        upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
        if (!botConfig.userExplicitlySelectedMode) {
          botConfig.mode = "UPSTOX_LIVE";
        }
        invalidTokens.delete(data.access_token);
        resetVerifiedTokenCache();
        setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
        saveTokenBackupToDisk(data.access_token, upstoxConfig);
        savePostgresDb().catch(() => { /* ignore */ });
        publishTokenToCloudRelay(data.access_token).catch(() => { /* ignore */ });

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
}
