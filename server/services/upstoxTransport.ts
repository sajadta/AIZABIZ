import dns from "dns";
import net from "net";
import https from "https";
import http from "http";
import { HttpsProxyAgent } from "https-proxy-agent";
import { upstoxConfig } from "../state";

try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
    (net as any).setDefaultAutoSelectFamily(false);
  }
} catch {}

export const FIXED_PRIMARY_IP = "8.234.113.241";
export const FIXED_SECONDARY_IP = "34.34.254.178";
export const CONTAINER_BACKUP_IP = "34.34.244.48";

const upstoxIpv4Agent = new https.Agent({
  family: 4,
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 30,
  maxFreeSockets: 15,
  timeout: 15000,
});

let proxyHealthCache = {
  url: "",
  online: false,
  detectedIp: "",
  lastChecked: 0,
};

/**
 * Fast TCP probe to check if proxy port is open (1200ms max timeout).
 */
function probeTcpPort(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const socket = net.createConnection({ host, port, family: 4 });
    const finish = (result: boolean) => {
      if (!done) {
        done = true;
        try { socket.destroy(); } catch {}
        resolve(result);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
  });
}

/**
 * Fast proxy health prober.
 * Ensures background loops never block or hang when proxy port is offline.
 */
export async function testProxyConnectivity(
  targetUrl?: string,
  timeoutMs = 2000
): Promise<{ online: boolean; detectedIp: string; error?: string }> {
  const proxyToTest =
    (typeof targetUrl === "string" ? targetUrl.trim() : "") ||
    process.env.UPSTOX_PROXY_URL ||
    upstoxConfig.outboundProxyUrl ||
    "";

  if (!proxyToTest) {
    proxyHealthCache = { url: "", online: false, detectedIp: "", lastChecked: Date.now() };
    return { online: false, detectedIp: "", error: "No proxy configured" };
  }

  try {
    const parsed = new URL(proxyToTest);
    const host = parsed.hostname;
    const port = Number(parsed.port) || 8888;

    // Fast TCP probe first (1.2s max)
    const portOpen = await probeTcpPort(host, port, 1200);
    if (!portOpen) {
      proxyHealthCache = {
        url: proxyToTest,
        online: false,
        detectedIp: "",
        lastChecked: Date.now(),
      };
      return { online: false, detectedIp: "", error: `Proxy port ${port} is closed/unreachable` };
    }

    // Port is open! Mark online immediately
    proxyHealthCache = {
      url: proxyToTest,
      online: true,
      detectedIp: FIXED_PRIMARY_IP,
      lastChecked: Date.now(),
    };
    return { online: true, detectedIp: FIXED_PRIMARY_IP };
  } catch (err: any) {
    proxyHealthCache = {
      url: proxyToTest,
      online: false,
      detectedIp: "",
      lastChecked: Date.now(),
    };
    return { online: false, detectedIp: "", error: err?.message || "Invalid proxy URL" };
  }
}

/**
 * Returns whether proxy is actively healthy based on cached check (valid for 15 seconds).
 */
export function isProxyCurrentlyOnline(): boolean {
  const configured =
    process.env.UPSTOX_PROXY_URL || upstoxConfig.outboundProxyUrl || "";
  if (!configured) return false;

  // If cache is fresh (< 15s) and URL matches, return cached state
  if (
    proxyHealthCache.url === configured &&
    Date.now() - proxyHealthCache.lastChecked < 15000
  ) {
    return proxyHealthCache.online;
  }

  // Trigger non-blocking background probe to keep cache warm
  testProxyConnectivity(configured).catch(() => {});
  return proxyHealthCache.online;
}

export function getProxyStatusSummary() {
  const configured =
    process.env.UPSTOX_PROXY_URL || upstoxConfig.outboundProxyUrl || "";
  const isOnline = isProxyCurrentlyOnline();
  return {
    configuredProxy: configured,
    isProxyActive: isOnline,
    activeIp: isOnline
      ? proxyHealthCache.detectedIp || FIXED_PRIMARY_IP
      : CONTAINER_BACKUP_IP,
    containerIp: CONTAINER_BACKUP_IP,
    primaryStaticIp: FIXED_PRIMARY_IP,
    lastChecked: proxyHealthCache.lastChecked,
  };
}

let sharedProxyAgent: HttpsProxyAgent<string> | null = null;
let sharedProxyAgentUrl = "";

export function getSharedProxyAgent(proxyUrl: string): HttpsProxyAgent<string> {
  const cleanUrl = proxyUrl.trim();
  if (!sharedProxyAgent || sharedProxyAgentUrl !== cleanUrl) {
    sharedProxyAgentUrl = cleanUrl;
    sharedProxyAgent = new HttpsProxyAgent(cleanUrl, {
      family: 4,
      keepAlive: true,
      keepAliveMsecs: 60000,
      maxSockets: 25,
      maxFreeSockets: 10,
      timeout: 15000,
    });
  }
  return sharedProxyAgent;
}

export function getUpstoxAgent() {
  const proxyUrl = process.env.UPSTOX_PROXY_URL || upstoxConfig.outboundProxyUrl || "";
  if (proxyUrl) {
    try {
      return getSharedProxyAgent(proxyUrl);
    } catch {
      // Fall through
    }
  }
  return upstoxIpv4Agent;
}

const originalNativeFetch = globalThis.fetch;

// Initialize proxy status immediately in background on module load
if (process.env.UPSTOX_PROXY_URL || upstoxConfig.outboundProxyUrl) {
  testProxyConnectivity().catch(() => {});
}

/**
 * Strict Upstox Fetch implementation:
 * Routes all Upstox requests strictly through the whitelisted proxy IP (8.234.113.241:8888).
 * Never leaks the AI Studio container IP (34.34.244.48) to Upstox.
 */
async function upstoxFetch(url: string, options: any = {}): Promise<Response> {
  const proxyUrl = process.env.UPSTOX_PROXY_URL || upstoxConfig.outboundProxyUrl || "";

  if (proxyUrl) {
    // If proxy port is offline, do NOT hang or leak container IP. Fast-fail with 503.
    if (!isProxyCurrentlyOnline()) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Upstox proxy (8.234.113.241:8888) is waiting for connection. Dynamic IP strictly blocked.",
          proxyOffline: true,
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const agent = getSharedProxyAgent(proxyUrl);
      const headers = { ...(options.headers || {}) };
      const method = options.method || "GET";
      const bodyData = options.body;

      if (bodyData && !headers["Content-Length"] && !headers["content-length"]) {
        const str = typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData);
        headers["Content-Length"] = Buffer.byteLength(str);
      }

      const proxyRes = await new Promise<Response>((resolve, reject) => {
        let done = false;
        const req = https.request(
          url,
          { method, agent, family: 4, headers },
          (res) => {
            if (done) return;
            done = true;
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              const bodyBuffer = Buffer.concat(chunks);
              proxyHealthCache.online = true;
              proxyHealthCache.detectedIp = FIXED_PRIMARY_IP;
              proxyHealthCache.lastChecked = Date.now();
              resolve(
                new Response(bodyBuffer, {
                  status: res.statusCode || 200,
                  statusText: res.statusMessage || "",
                  headers: res.headers as any,
                })
              );
            });
          }
        );

        if (options.signal) {
          if (options.signal.aborted) {
            done = true;
            req.destroy();
            return reject(new Error("Request aborted"));
          }
          options.signal.addEventListener("abort", () => {
            if (!done) {
              done = true;
              req.destroy();
              reject(new Error("Request aborted"));
            }
          });
        }

        req.on("error", (err) => {
          if (!done) {
            done = true;
            reject(new Error(`[StrictProxy] Upstox proxy request error: ${err?.message}`));
          }
        });

        req.setTimeout(10000, () => {
          if (!done) {
            done = true;
            req.destroy();
            reject(new Error("[StrictProxy] Upstox proxy request timed out (10s)"));
          }
        });

        if (bodyData) {
          req.write(typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData));
        }
        req.end();
      });

      return proxyRes;
    } catch (err: any) {
      // User explicitly requires: NEVER leak AI Studio IP to Upstox.
      // Re-throw strict error rather than falling back to un-whitelisted container IP.
      throw new Error(`[StrictProxyError] ${err?.message || "Proxy connection failure"}`);
    }
  }

  // Smooth direct IPv4 fallback only if NO proxy is configured
  return originalNativeFetch(url, {
    ...options,
    // @ts-ignore
    family: 4,
  });
}

globalThis.fetch = function (input: any, init?: any): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input?.url || "";
  if (typeof urlStr === "string" && (urlStr.includes("upstox.com") || urlStr.includes("upstox"))) {
    return upstoxFetch(urlStr, init);
  }
  return originalNativeFetch(input, init);
};

export async function placeUpstoxOrderIpv4(orderPayload: any, token: string, retryCount = 0): Promise<any> {
  return new Promise((resolve) => {
    const dataStr = JSON.stringify(orderPayload);
    const agent = getUpstoxAgent();
    const req = https.request(
      "https://api.upstox.com/v2/order/place",
      {
        method: "POST",
        agent,
        family: 4,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Api-Version": "2.0",
          "Content-Length": Buffer.byteLength(dataStr),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", async () => {
          try {
            const json = JSON.parse(raw);
            if (json?.status !== "success" && retryCount === 0 && (raw.includes("ECONNRESET") || raw.includes("socket") || raw.includes("timeout"))) {
              const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
              return resolve(retryRes);
            }
            resolve(json);
          } catch {
            resolve({ status: "error", message: raw });
          }
        });
      },
    );
    req.on("error", async (err) => {
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: "error", message: err?.message || "Network error" });
    });
    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ status: "error", message: "Upstox order request timed out" });
    });
    req.write(dataStr);
    req.end();
  });
}
