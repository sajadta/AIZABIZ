import express from 'express';
import fsSync from 'fs';
import {
  upstoxConfig, setUpstoxConfig, invalidTokens,
  PERSISTENT_TOKEN_BACKUP_PATH
} from '../state';
import {
  resilientFetchJson, isJwtTokenActuallyExpired,
  saveTokenBackupToDisk
} from '../utils';
import { savePostgresDb } from '../services/persistence';
import { getProxyStatusSummary, getDetectedContainerIp, parseUpstoxFundsData, ensureProxyHealthVerified } from '../services/upstoxTransport';

const router = express.Router();

// Middleware for token sync
router.use((req, _res, next) => {
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
          savePostgresDb().catch(() => { /* ignore */ });
        }
      }
    }
  } else if (!upstoxConfig.accessToken) {
    try {
      if (fsSync.existsSync(PERSISTENT_TOKEN_BACKUP_PATH)) {
        const raw = fsSync.readFileSync(PERSISTENT_TOKEN_BACKUP_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        const tok = parsed.accessToken || parsed.token;
        if (tok && !isJwtTokenActuallyExpired(tok) && !invalidTokens.has(tok)) {
          setUpstoxConfig({ accessToken: tok });
        }
      }
    } catch {
      // Ignored
    }
  }

  next();
});

router.get("/proxy-status", async (_req, res) => {
  const [detectedContainerIp] = await Promise.all([
    getDetectedContainerIp(),
    ensureProxyHealthVerified(4500),
  ]);
  const summary = getProxyStatusSummary();
  res.json({
    success: true,
    ...summary,
    containerIp: detectedContainerIp || summary.containerIp,
  });
});

router.get("/profile", async (req, res) => {
  const headerToken = req.headers.authorization?.replace("Bearer ", "").trim() || "";
  const token =
    headerToken && headerToken.length > 30 && !invalidTokens.has(headerToken) && !isJwtTokenActuallyExpired(headerToken)
      ? headerToken
      : upstoxConfig.accessToken;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [profileData, fundsData, holdingsData] = await Promise.all([
      resilientFetchJson("https://api.upstox.com/v2/user/profile", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" }
      }, 1, 6000),
      resilientFetchJson("https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" }
      }, 1, 6000).catch(() => null),
      resilientFetchJson("https://api.upstox.com/v2/portfolio/long-term-holdings", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" }
      }, 1, 6000).catch(() => null),
    ]);

    const funds = parseUpstoxFundsData(fundsData);
    const holdingsCount =
      holdingsData?.status === "success" && Array.isArray(holdingsData?.data)
        ? holdingsData.data.length
        : 0;

    if (profileData?.status === "success" && profileData?.data) {
      res.json({
        isConnected: true,
        userName: profileData.data.user_name,
        userEmail: profileData.data.email,
        userClientCode: profileData.data.user_id,
        availableMargin: funds.availableMargin,
        settledCash: funds.settledCash,
        deliverySellCredit: funds.deliverySellCredit,
        usedMargin: funds.usedMargin,
        utilizedMargin: funds.utilizedMargin,
        payin: funds.payin,
        payout: funds.payout,
        totalBalance: Number((funds.availableMargin + funds.utilizedMargin).toFixed(2)),
        holdingsCount,
      });
    } else {
      res.status(401).json({ error: "Failed to fetch profile", details: profileData });
    }
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Profile fetch failed" });
  }
});

export default router;
