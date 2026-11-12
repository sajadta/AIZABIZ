import express from 'express';
import fsSync from 'fs';
import { 
  upstoxConfig, setUpstoxConfig, invalidTokens, cachedUpstoxLivePositions, 
  activeAutoOtpSession, setActiveAutoOtpSession, customHoldingBuyPrices,
  PERSISTENT_TOKEN_BACKUP_PATH
} from '../state';
import { 
  resilientFetchJson, isUpstoxAuthFailureError, isJwtTokenActuallyExpired, 
  saveTokenBackupToDisk, publishTokenToCloudRelay, getLiveOutboundIp
} from '../utils';
import { savePostgresDb } from '../services/persistence';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { testProxyConnectivity, getProxyStatusSummary } from '../services/upstoxTransport';

const router = express.Router();

// Middleware for token sync
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (
      token &&
      token.length > 30 &&
      !invalidTokens.has(token) &&
      !isJwtTokenActuallyExpired(token)
    ) {
      const currentToken = upstoxConfig.accessToken;
      if (!currentToken || isJwtTokenActuallyExpired(currentToken) || invalidTokens.has(currentToken)) {
        if (currentToken !== token) {
          setUpstoxConfig({ accessToken: token });
          saveTokenBackupToDisk(token);
          savePostgresDb();
        }
      }
    }
  } else if (!upstoxConfig.accessToken) {
    // If memory accessToken is lost, try reading disk backup
    try {
      if (fsSync.existsSync(PERSISTENT_TOKEN_BACKUP_PATH)) {
        const raw = fsSync.readFileSync(PERSISTENT_TOKEN_BACKUP_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        const tok = parsed.token || parsed.accessToken;
        if (tok && !isJwtTokenActuallyExpired(tok)) {
          setUpstoxConfig({ accessToken: tok });
        }
      }
    } catch {
      // Ignored
    }
  }

  next();
});


router.get('/config', (req, res) => {
  res.json(upstoxConfig);
});

router.post('/config', async (req, res) => {
  const { apiKey, apiSecret, redirectUri, accessToken, mobile, pin } = req.body;
  const updates: any = {};
  if (apiKey !== undefined) updates.apiKey = apiKey.trim();
  if (apiSecret !== undefined && apiSecret !== "••••••••" && apiSecret.trim() !== "") {
    updates.apiSecret = apiSecret.trim();
  }
  if (redirectUri !== undefined) updates.redirectUri = redirectUri.trim();
  if (mobile !== undefined && String(mobile).trim()) updates.mobile = String(mobile).trim();
  if (pin !== undefined && String(pin).trim()) updates.pin = String(pin).trim();

  if (typeof accessToken === "string") {
    let token = accessToken.trim();
    if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();
    if (token) {
      if (invalidTokens.has(token)) {
        setUpstoxConfig({ accessToken: "" });
        return res.status(401).json({
          success: false,
          error: "Upstox token has expired or is invalid. Please generate a new daily token.",
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
          updates.accessToken = token;
          updates.userName = data.data.user_name || "Live Trader";
          updates.userEmail = data.data.email || "trader@upstox.com";
          updates.userClientCode = data.data.user_id || "UPSTOX_USER";
          updates.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
          updates.tokenExpiresAt = "03:30 AM (Next Day) ";
          publishTokenToCloudRelay(token).catch(() => {});
        } else if (isUpstoxAuthFailureError(response.status, data)) {
          invalidTokens.add(token);
          setUpstoxConfig({ accessToken: "" });
          return res.status(401).json({
            success: false,
            error: data.errors?.[0]?.message || "Invalid or expired Upstox token provided",
          });
        }
      } catch (err) {
        // Fallback or error
      }
    }
  }

  setUpstoxConfig(updates);
  await savePostgresDb();
  res.json(upstoxConfig);
});

router.get("/proxy-status", async (_req, res) => {
  const summary = getProxyStatusSummary();
  res.json({ success: true, ...summary });
});

router.post("/proxy-config", async (req, res) => {
  const { proxyUrl } = req.body;
  const targetProxy = typeof proxyUrl === "string" ? proxyUrl.trim() : "";
  if (!targetProxy) {
    setUpstoxConfig({ outboundProxyUrl: "" });
    await savePostgresDb();
    const fallbackIp = await getLiveOutboundIp();
    return res.json({
      success: true,
      message: "Proxy removed. Reverted to standard direct connection.",
      isFixedProxy: false,
      serverOutboundIp: fallbackIp.ip,
    });
  }

  const result = await testProxyConnectivity(targetProxy, 4000);
  if (result.online && result.detectedIp) {
    setUpstoxConfig({ outboundProxyUrl: targetProxy });
    await savePostgresDb();
    return res.json({
      success: true,
      message: `✅ Fixed IP Proxy connected! Outbound Static IP: ${result.detectedIp}`,
      serverOutboundIp: result.detectedIp,
      isFixedProxy: true,
    });
  } else {
    return res.status(400).json({
      success: false,
      error: `Proxy test failed: ${result.error || "Could not reach proxy"}`,
      suggestedFix: "Please run on your VM: sudo sed -i 's/^Listen /#Listen /' /etc/tinyproxy/tinyproxy.conf && sudo sed -i 's/^Allow /#Allow /' /etc/tinyproxy/tinyproxy.conf && sudo systemctl restart tinyproxy",
    });
  }
});

router.get("/profile", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || upstoxConfig.accessToken;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [profileData, fundsData] = await Promise.all([
      resilientFetchJson("https://api.upstox.com/v2/user/profile", {
        headers: { Authorization: `Bearer ${token}`, "Api-Version": "2.0" }
      }),
      resilientFetchJson("https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC", {
        headers: { Authorization: `Bearer ${token}`, "Api-Version": "2.0" }
      })
    ]);

    let availableMargin = 0;
    let usedMargin = 0;
    if (fundsData.status === "success" && fundsData.data?.equity) {
      availableMargin = fundsData.data.equity.available_margin || 0;
      usedMargin = fundsData.data.equity.used_margin || 0;
    }

    if (profileData.status === "success" && profileData.data) {
      res.json({
        isConnected: true,
        userName: profileData.data.user_name,
        userEmail: profileData.data.email,
        availableMargin,
        usedMargin,
      });
    } else {
      res.status(401).json({ error: "Failed to fetch profile", details: profileData });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/positions", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || upstoxConfig.accessToken;
  if (!token) return res.json([]);

  if (Date.now() - cachedUpstoxLivePositions.timestamp < 3500) {
    return res.json(cachedUpstoxLivePositions.list);
  }

  try {
    const data = await resilientFetchJson("https://api.upstox.com/v2/portfolio/short-term-positions", {
      headers: { Authorization: `Bearer ${token}`, "Api-Version": "2.0" }
    });
    if (data.status === "success" && data.data) {
      const positions = data.data
        .filter((p: any) => Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)) > 0)
        .map((p: any) => ({
          id: p.trading_symbol || p.instrument_token,
          symbol: p.trading_symbol || p.instrument_token,
          instrumentKey: p.instrument_token,
          productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
          quantity: Math.abs(Number(p.quantity ?? p.net_quantity ?? 0)),
          type: Number(p.quantity ?? p.net_quantity ?? 0) < 0 ? "SELL" : "BUY",
          buyPrice: Number(p.day_buy_price || p.buy_price || p.average_price || 0),
          currentLTP: Number(p.last_price || 0),
          pnl: Number(p.pnl || p.unrealised || p.realised || 0),
          mode: "UPSTOX_LIVE",
          openedAt: new Date().toLocaleTimeString("en-IN"),
        }));
      cachedUpstoxLivePositions.timestamp = Date.now();
      cachedUpstoxLivePositions.list = positions;
      return res.json(positions);
    }
    res.json([]);
  } catch {
    res.json([]);
  }
});

router.get("/orders", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || upstoxConfig.accessToken;
  if (!token) return res.json([]);
  try {
    const data = await resilientFetchJson("https://api.upstox.com/v2/order/retrieve-all", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (data.status === "success" && Array.isArray(data.data)) {
      res.json(data.data.map((o: any) => ({
        id: o.order_id,
        symbol: o.trading_symbol,
        type: o.transaction_type,
        status: o.status,
        quantity: o.quantity,
        price: o.average_price || o.price,
        timestamp: o.order_timestamp,
        mode: "UPSTOX_LIVE"
      })));
    } else {
      res.json([]);
    }
  } catch {
    res.json([]);
  }
});

export default router;
