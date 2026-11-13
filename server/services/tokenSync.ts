// Token synchronization service.
// Publishes freshly minted Upstox access tokens to the public relay, discovers
// tokens from the relay / Render bridges / disk backup, and reports the live
// outbound IP used for Upstox's IP whitelisting.
import {
  upstoxConfig, botConfig, invalidTokens, setUpstoxConfig, setLastWebhookDiagnostic,
  FIXED_PRIMARY_IP, FIXED_SECONDARY_IP,
} from "../state";
import { isJwtTokenActuallyExpired, saveTokenBackupToDisk, loadTokenBackupFromDisk } from "../lib/tokens";
import { isUpstoxAuthFailureError } from "../utils";
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
  } catch (e) {}
}

export type VerifiedTokenStatus = {
  token: string;
  verifiedAt: number;
  availableMargin: number;
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
  try {
    const pRes = await fetch("https://api.upstox.com/v2/user/profile", {
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
        botConfig.mode = "PAPER_TRADING";
      }
      setLastWebhookDiagnostic(`✅ Token auto-activated via ${sourceLabel} at ${upstoxConfig.tokenGeneratedAt}`);
      saveTokenBackupToDisk(cleanToken, upstoxConfig);
      await savePostgresDb().catch(() => { /* ignore */ });
      return true;
    } else if (isUpstoxAuthFailureError(pRes.status, pData) && isJwtTokenActuallyExpired(cleanToken)) {
      invalidTokens.add(cleanToken);
    }
  } catch (e) {}
  return false;
}

export async function syncTokenFromRenderWebhookBridge() {
  if (
    upstoxConfig.accessToken &&
    !invalidTokens.has(upstoxConfig.accessToken) &&
    !isJwtTokenActuallyExpired(upstoxConfig.accessToken)
  ) {
    return true;
  }

  // 0. Check local persistent disk backup first
  const diskTok = loadTokenBackupFromDisk();
  if (diskTok) {
    const ok = await activateDiscoveredToken(diskTok, "Local Persistent Disk Backup");
    if (ok) return true;
  }

  // 1. Check Public 24x7 Webhook Relay (https://ntfy.sh/upstox_live_sajad_5vcabx_3ab5711d)
  try {
    const relayCtrl = new AbortController();
    const relayTimeout = setTimeout(() => relayCtrl.abort(), 3000);
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
        // Extract any JWT token (eyJ...) from the webhook message
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
  } catch (e) {}

  // 2. Also check Render Servers (https://aizabiz.onrender.com and configured redirect URI) if awake
  for (const renderBase of [
    "https://aizabiz.onrender.com",
    process.env.UPSTOX_REDIRECT_URI || "",
  ]) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${renderBase}/api/market/config`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const remoteToken = (data.accessToken || data.access_token || "").trim();
        if (remoteToken) {
          const ok = await activateDiscoveredToken(remoteToken, `Render Server (${renderBase})`);
          if (ok) return true;
        }
      }
    } catch (e) {
      // Ignored
    }
  }
  return false;
}

let lastIpCheckResult: { detectedIp: string; isProxy: boolean } | null = null;
let lastIpCheckTimestamp = 0;

export async function getLiveOutboundIp(): Promise<{ ip: string; secondaryIp: string; isFixedProxy: boolean; actualDetectedIp: string; mismatch: boolean }> {
  const proxyUrl = process.env.UPSTOX_PROXY_URL;
  const now = Date.now();
  
  // Cache for 5 minutes
  if (lastIpCheckResult && (now - lastIpCheckTimestamp < 5 * 60 * 1000)) {
    const mismatch = lastIpCheckResult.detectedIp !== FIXED_PRIMARY_IP && lastIpCheckResult.detectedIp !== FIXED_SECONDARY_IP;
    return { 
      ip: FIXED_PRIMARY_IP, 
      secondaryIp: FIXED_SECONDARY_IP, 
      isFixedProxy: lastIpCheckResult.isProxy, 
      actualDetectedIp: lastIpCheckResult.detectedIp || "Unknown",
      mismatch: mismatch
    };
  }

  let detectedIp = "";
  let isProxy = false;

  try {
    const controller = new AbortController();
    // Increase timeout to 8 seconds for slow proxy/network
    const timeout = setTimeout(() => controller.abort(), 8000);
    const options: any = { signal: controller.signal };
    
    const res = await fetch("https://api.ipify.org?format=json", options);
    clearTimeout(timeout);
    
    if (res.ok) {
      const data = await res.json();
      detectedIp = data.ip;
      isProxy = !!proxyUrl;
      
      // Update cache
      lastIpCheckResult = { detectedIp, isProxy };
      lastIpCheckTimestamp = now;
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.warn("[IP Check Timeout] api.ipify.org took too long (>8s)");
    } else {
      console.error("[IP Check Error]", e);
    }
    // Use fallback from previous check if available even if expired
    if (lastIpCheckResult) {
       detectedIp = lastIpCheckResult.detectedIp;
       isProxy = lastIpCheckResult.isProxy;
    }
  }

  const mismatch = detectedIp !== FIXED_PRIMARY_IP && detectedIp !== FIXED_SECONDARY_IP;

  return { 
    ip: FIXED_PRIMARY_IP, 
    secondaryIp: FIXED_SECONDARY_IP, 
    isFixedProxy: isProxy, 
    actualDetectedIp: detectedIp || "Unknown",
    mismatch: mismatch
  };
}
