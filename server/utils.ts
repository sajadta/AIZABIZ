import { FIXED_PRIMARY_IP, FIXED_SECONDARY_IP, upstoxConfig, PUBLIC_WEBHOOK_RELAY_URL, PERSISTENT_TOKEN_BACKUP_PATH } from "./state";
import fsSync from "fs";
import path from "path";
import os from "os";

let lastPublishedRelayToken = "";

export function isUpstoxAuthFailureError(resStatus: number, data: any): boolean {
  if (resStatus === 401) return true;
  const errCode = String(data?.errors?.[0]?.errorCode || data?.errors?.[0]?.code || "");
  if (
    errCode === "UDAPI100050" ||
    errCode === "UDAPI100057" ||
    errCode === "UDAPI100068" ||
    errCode === "UDAPI100016"
  ) {
    return true;
  }
  const msg = String(data?.errors?.[0]?.message || data?.message || "").toLowerCase();
  return msg.includes("invalid token") || msg.includes("token has expired") || msg.includes("unauthorized");
}

export function isJwtTokenActuallyExpired(tokenStr: string): boolean {
  if (!tokenStr || tokenStr.split(".").length < 3) return true;
  try {
    const payload = JSON.parse(Buffer.from(tokenStr.split(".")[1], "base64").toString());
    const exp = payload.exp;
    if (!exp) return false;
    return Date.now() / 1000 > exp - 30; // 30s buffer
  } catch {
    return true;
  }
}

export function saveTokenBackupToDisk(tokenStr: string, meta?: Record<string, any>) {
  try {
    fsSync.writeFileSync(PERSISTENT_TOKEN_BACKUP_PATH, JSON.stringify({ token: tokenStr, accessToken: tokenStr, ...meta, savedAt: new Date().toISOString() }));
  } catch {
    // Ignored
  }
}


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
    // Ignored
  }
}

let lastIpCheckResult: { detectedIp: string; isProxy: boolean } | null = null;
let lastIpCheckTimestamp = 0;

export async function getLiveOutboundIp(): Promise<{ 
  ip: string; 
  secondaryIp: string; 
  isFixedProxy: boolean; 
  actualDetectedIp: string; 
  mismatch: boolean 
}> {
  const proxyUrl = process.env.UPSTOX_PROXY_URL;
  const now = Date.now();
  
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
    const timeout = setTimeout(() => controller.abort(), 8000);
    const options: any = { signal: controller.signal };
    
    const res = await fetch("https://api.ipify.org?format=json", options);
    clearTimeout(timeout);
    
    if (res.ok) {
      const data = await res.json();
      detectedIp = data.ip;
      isProxy = !!proxyUrl;
      
      lastIpCheckResult = { detectedIp, isProxy };
      lastIpCheckTimestamp = now;
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.warn("[IP Check Timeout] api.ipify.org took too long (>8s)");
    } else {
      console.error("[IP Check Error]", e);
    }
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

export async function resilientFetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  retries = 2,
  timeout = 12000
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) {
      const text = await res.text();
      const err: any = new Error(`HTTP ${res.status}: ${text}`);
      err.status = res.status;
      // Do NOT retry 401/403 auth failures - fast fail immediately
      if (res.status === 401 || res.status === 403) {
        throw err;
      }
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 400));
        return resilientFetchJson<T>(url, options, retries - 1, timeout);
      }
      throw err;
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(id);
    if (err.status === 401 || err.status === 403) {
      throw err;
    }
    if (retries > 0 && !err?.message?.includes("aborted")) {
      await new Promise(r => setTimeout(r, 400));
      return resilientFetchJson<T>(url, options, retries - 1, timeout);
    }
    throw err;
  }
}

export function getIstDateString() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getIstTimeString() {
  return new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
}
