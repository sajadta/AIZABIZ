// Token synchronization service.
// Publishes freshly minted Upstox access tokens to the public relay, discovers
// tokens from the relay / Render bridges / disk backup, and reports the live
// outbound IP used for Upstox's IP whitelisting.
import {
  upstoxConfig, botConfig, invalidTokens, setLastWebhookDiagnostic,
  FIXED_PRIMARY_IP, FIXED_SECONDARY_IP,
} from "../state";
import { isJwtTokenActuallyExpired, saveTokenBackupToDisk, loadTokenBackupFromDisk } from "../lib/tokens";
import { isUpstoxAuthFailureError } from "../utils";
import { getDetectedContainerIp, getProxyStatusSummary } from "./upstoxTransport";
import { savePostgresDb } from "./persistence";

// Auto-Sync Approved Token from Public Webhook Relay (ntfy.sh) & Render Bridge
const PUBLIC_WEBHOOK_RELAY_TOPIC = "upstox_live_sajad_5vcabx_3ab5711d";
const PUBLIC_WEBHOOK_RELAY_URL = `https://ntfy.sh/${PUBLIC_WEBHOOK_RELAY_TOPIC}`;
let lastPublishedRelayToken = "";

export async function publishTokenToCloudRelay(tokenToSave: string) {
  const clean = (tokenToSave || "").trim();
  if (!clean || clean.length < 30 || clean === lastPublishedRelayToken) return;
  lastPublishedRelayToken = clean;
  try {
    await fetch(PUBLIC_WEBHOOK_RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Title: "Upstox Daily Token Backup",
      },
      body: JSON.stringify({
        access_token: clean,
        user_id: upstoxConfig.userClientCode || process.env.UPSTOX_CLIENT_CODE || "",
        user_name: upstoxConfig.userName || process.env.UPSTOX_USER_NAME || "",
        saved_at: new Date().toISOString(),
      }),
    });
  } catch {
    /* ignore */
  }
}

export type VerifiedTokenStatus = {
  token: string;
  verifiedAt: number;
  availableMargin: number;
  settledCash?: number;
  deliverySellCredit?: number;
  usedMargin: number;
  utilizedMargin: number;
  payin: number;
  payout: number;
  holdingsCount: number;
  userName: string;
  userEmail: string;
  userClientCode: string;
};

export let lastVerifiedTokenStatus: VerifiedTokenStatus = {
  token: "",
  verifiedAt: 0,
  availableMargin: 0,
  settledCash: 0,
  deliverySellCredit: 0,
  usedMargin: 0,
  utilizedMargin: 0,
  payin: 0,
  payout: 0,
  holdingsCount: 0,
  userName: process.env.UPSTOX_USER_NAME || "",
  userEmail: process.env.UPSTOX_USER_EMAIL || "",
  userClientCode: process.env.UPSTOX_CLIENT_CODE || "",
};

export const setLastVerifiedTokenStatus = (v: VerifiedTokenStatus) => { lastVerifiedTokenStatus = v; };

export const resetVerifiedTokenCache = () => {
  lastVerifiedTokenStatus = {
    ...lastVerifiedTokenStatus,
    token: "",
    verifiedAt: 0,
    availableMargin: 0,
    usedMargin: 0,
    utilizedMargin: 0,
    payin: 0,
    payout: 0,
    holdingsCount: 0,
  };
};

let inFlightBridgeSync: Promise<boolean> | null = null;
let lastBridgeSyncAttemptMs = 0;

export async function activateDiscoveredToken(tokenCandidate: string, sourceLabel: string) {
  const cleanToken = (tokenCandidate || "").trim();
  if (
    !cleanToken ||
    cleanToken.length < 30 ||
    invalidTokens.has(cleanToken) ||
    isJwtTokenActuallyExpired(cleanToken)
  ) {
    return false;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const pRes = await fetch("https://api.upstox.com/v2/user/profile", {
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    const pData = await pRes.json();
    if (pData.status === "success" && pData.data) {
      upstoxConfig.accessToken = cleanToken;
      upstoxConfig.userName = pData.data.user_name || process.env.UPSTOX_USER_NAME || "";
      upstoxConfig.userEmail = pData.data.email || upstoxConfig.userEmail || "";
      upstoxConfig.userClientCode = pData.data.user_id || process.env.UPSTOX_CLIENT_CODE || "";
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString("en-IN");
      upstoxConfig.tokenExpiresAt = "Tomorrow 03:30 AM";
      if (!botConfig.userExplicitlySelectedMode) {
        botConfig.mode = "UPSTOX_LIVE";
      }
      resetVerifiedTokenCache();
      setLastWebhookDiagnostic(`✅ Token auto-activated via ${sourceLabel} at ${upstoxConfig.tokenGeneratedAt}`);
      saveTokenBackupToDisk(cleanToken, upstoxConfig);
      await savePostgresDb().catch(() => { /* ignore */ });
      return true;
    } else if (isUpstoxAuthFailureError(pRes.status, pData) && isJwtTokenActuallyExpired(cleanToken)) {
      invalidTokens.add(cleanToken);
    }
  } catch {
    /* ignore */
  }
  finally {
    clearTimeout(timer);
  }
  return false;
}

export async function syncTokenFromRenderWebhookBridge(force = false) {
  if (
    upstoxConfig.accessToken &&
    !invalidTokens.has(upstoxConfig.accessToken) &&
    !isJwtTokenActuallyExpired(upstoxConfig.accessToken)
  ) {
    return true;
  }

  if (inFlightBridgeSync) {
    return inFlightBridgeSync;
  }
  if (!force && Date.now() - lastBridgeSyncAttemptMs < 15000) {
    return false;
  }
  lastBridgeSyncAttemptMs = Date.now();

  inFlightBridgeSync = (async () => {
    try {
      // 0. Check local persistent disk backup first
      const diskTok = loadTokenBackupFromDisk();
      if (diskTok) {
        const ok = await activateDiscoveredToken(diskTok, "Local Persistent Disk Backup");
        if (ok) return true;
      }

      // 1. Check Public 24x7 Webhook Relay
      try {
        const relayCtrl = new AbortController();
        const relayTimeout = setTimeout(() => relayCtrl.abort(), 2200);
        const relayRes = await fetch(
          `https://ntfy.sh/${PUBLIC_WEBHOOK_RELAY_TOPIC}/json?poll=1&since=18h`,
          {
            signal: relayCtrl.signal,
            headers: { Accept: "application/x-ndjson, application/json, text/plain" },
          },
        );
        clearTimeout(relayTimeout);
        if (relayRes.ok) {
          const text = await relayRes.text();
          const lines = text.trim().split("\n").reverse();
          for (const line of lines) {
            if (!line.trim()) continue;
            const jwtMatch = line.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
            if (jwtMatch && jwtMatch[0]) {
              const ok = await activateDiscoveredToken(jwtMatch[0], "Cloud Token Backup Relay");
              if (ok) return true;
            }
            try {
              const wrapper = JSON.parse(line);
              const innerStr = typeof wrapper.message === "string" ? wrapper.message : JSON.stringify(wrapper);
              const innerJwt = innerStr.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
              if (innerJwt && innerJwt[0]) {
                const ok = await activateDiscoveredToken(innerJwt[0], "Cloud Token Backup Relay");
                if (ok) return true;
              }
            } catch {
              // Ignored
            }
          }
        }
      } catch {
        /* ignore */
      }

      // 2. Also check Render Server if configured and not localhost
      const candidates = ["https://aizabiz.onrender.com", process.env.UPSTOX_REDIRECT_URI || ""]
        .map((u) => {
          try {
            return u ? new URL(u).origin : "";
          } catch {
            return "";
          }
        })
        .filter((origin) => origin && !origin.includes("localhost") && !origin.includes("127.0.0.1"));

      for (const renderOrigin of Array.from(new Set(candidates))) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`${renderOrigin}/api/market/config`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json();
            const remoteToken = (data.accessToken || data.access_token || "").trim();
            if (remoteToken) {
              const ok = await activateDiscoveredToken(remoteToken, `Remote Server (${renderOrigin})`);
              if (ok) return true;
            }
          }
        } catch {
          // Ignored
        }
      }
      return false;
    } finally {
      inFlightBridgeSync = null;
    }
  })();

  return inFlightBridgeSync;
}

export async function getLiveOutboundIp(): Promise<{ ip: string; secondaryIp: string; isFixedProxy: boolean; actualDetectedIp: string; mismatch: boolean }> {
  const summary = getProxyStatusSummary();
  const containerIp = summary.isProxyActive
    ? await Promise.race([
        getDetectedContainerIp(),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 250)),
      ])
    : await getDetectedContainerIp();
  const actualDetectedIp = summary.isProxyActive
    ? summary.activeIp
    : (containerIp || "Unknown");
  const secondaryIp = containerIp || FIXED_SECONDARY_IP;
  const mismatch = actualDetectedIp !== FIXED_PRIMARY_IP && actualDetectedIp !== FIXED_SECONDARY_IP;

  return {
    ip: FIXED_PRIMARY_IP,
    secondaryIp,
    isFixedProxy: summary.isProxyActive,
    actualDetectedIp,
    mismatch,
  };
}
