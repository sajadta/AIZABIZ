import { FIXED_PRIMARY_IP, FIXED_SECONDARY_IP, upstoxConfig, PUBLIC_WEBHOOK_RELAY_URL } from "./state";
import { isJwtTokenActuallyExpired, saveTokenBackupToDisk } from "./lib/tokens";
import { getDetectedContainerIp, getProxyStatusSummary } from "./services/upstoxTransport";

export { isJwtTokenActuallyExpired, saveTokenBackupToDisk };

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

export async function getLiveOutboundIp(): Promise<{ 
  ip: string; 
  secondaryIp: string; 
  isFixedProxy: boolean; 
  actualDetectedIp: string; 
  mismatch: boolean 
}> {
  const summary = getProxyStatusSummary();
  const containerIp = await getDetectedContainerIp();
  const actualIp = summary.isProxyActive
    ? summary.activeIp
    : (containerIp || summary.containerIp || "Unknown");
  const secondaryIp = containerIp || FIXED_SECONDARY_IP;
  const mismatch = actualIp !== FIXED_PRIMARY_IP && actualIp !== FIXED_SECONDARY_IP;

  return {
    ip: FIXED_PRIMARY_IP,
    secondaryIp,
    isFixedProxy: summary.isProxyActive,
    actualDetectedIp: actualIp,
    mismatch,
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
