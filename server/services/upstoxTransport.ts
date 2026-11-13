import dns from "dns";
import net from "net";
import https from "https";
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

const upstoxIpv4Agent = new https.Agent({
  family: 4,
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 30,
  maxFreeSockets: 15,
  timeout: 15000,
});

const originalNativeFetch = globalThis.fetch;

export interface ProxyHealthState {
  url: string;
  online: boolean;
  detectedIp: string;
  tcpOpen: boolean;
  lastError: string;
  lastChecked: number;
}

let proxyHealthCache: ProxyHealthState = {
  url: "",
  online: false,
  detectedIp: "",
  tcpOpen: false,
  lastError: "",
  lastChecked: 0,
};

let containerIpCache: { ip: string; checkedAt: number } = {
  ip: "",
  checkedAt: 0,
};

let sharedProxyAgent: HttpsProxyAgent<string> | null = null;
let sharedProxyAgentUrl = "";

export function shouldUseProxyForUrl(urlStr: string): boolean {
  const clean = String(urlStr || "");
  if (!clean) return false;
  // High-frequency read-only market polling does not require Upstox Static IP and can run 100ms faster direct,
  // preserving Tinyproxy VM workers exclusively for orders, portfolio, funds, and auth calls.
  if (
    clean.includes("/market-quote/") ||
    clean.includes("/historical-candle/") ||
    clean.includes("/option/chain") ||
    clean.includes("/option/contract") ||
    clean.includes("/charges/brokerage")
  ) {
    return false;
  }
  return true;
}

export function evaluateProxyHealthCacheState(
  cache: Pick<ProxyHealthState, "url" | "online" | "lastChecked">,
  configuredUrl: string,
  nowMs: number,
): { online: boolean; shouldRefresh: boolean } {
  if (!configuredUrl) return { online: false, shouldRefresh: false };
  if (cache.url !== configuredUrl || cache.lastChecked <= 0) {
    return { online: false, shouldRefresh: true };
  }
  const ttlMs = cache.online ? 30000 : 45000;
  const isFresh = nowMs - cache.lastChecked < ttlMs;
  if (isFresh) {
    return { online: cache.online, shouldRefresh: false };
  }
  // Stale-while-revalidate: keep routing through last-verified online proxy while background probe refreshes.
  return { online: cache.online, shouldRefresh: true };
}

export function parseUpstoxFundsData(fundsData: any): {
  availableMargin: number;
  usedMargin: number;
  utilizedMargin: number;
  payin: number;
  payout: number;
} {
  const eq = fundsData?.data?.equity || {};
  const com = fundsData?.data?.commodity || {};
  const availableMargin = Number(eq.available_margin ?? 0) || (Number(eq.available_margin ?? 0) === 0 ? Number(com.available_margin ?? 0) : 0);
  const usedMargin = Number(eq.used_margin ?? eq.utilized_margin ?? 0);
  const payin = Number(eq.payin_amount ?? eq.payin ?? 0);
  const payout = Number(eq.payout_amount ?? eq.payout ?? 0);
  return {
    availableMargin,
    usedMargin,
    utilizedMargin: usedMargin,
    payin,
    payout,
  };
}

export function getConfiguredProxyUrl(): string {
  const cfgVal = typeof upstoxConfig.outboundProxyUrl === "string" ? upstoxConfig.outboundProxyUrl.trim() : "";
  if (upstoxConfig.outboundProxyUrl !== undefined) {
    return cfgVal;
  }
  return (process.env.UPSTOX_PROXY_URL || "").trim();
}

export async function getDetectedContainerIp(forceRefresh = false): Promise<string> {
  if (!forceRefresh && containerIpCache.ip && Date.now() - containerIpCache.checkedAt < 5 * 60 * 1000) {
    return containerIpCache.ip;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await originalNativeFetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
      // @ts-ignore
      family: 4,
    });
    clearTimeout(timer);
    if (res.ok) {
      const json: any = await res.json().catch(() => null);
      const ip = String(json?.ip || "").trim();
      if (ip && ip.length <= 45) {
        containerIpCache = { ip, checkedAt: Date.now() };
        return ip;
      }
    }
  } catch {
    // Ignore transient ipify lookup error
  }
  return containerIpCache.ip || "";
}

/**
 * Fast TCP probe to check if proxy port accepts connections (3800ms max for slow GCP micro-VMs).
 */
function probeTcpPort(host: string, port: number, timeoutMs = 3800): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const socket = net.createConnection({ host, port, family: 4 });
    const hardTimer = setTimeout(() => finish(false), timeoutMs + 100);
    const finish = (result: boolean) => {
      if (!done) {
        done = true;
        clearTimeout(hardTimer);
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
 * Verifies actual HTTPS CONNECT tunneling through the HTTP proxy.
 * A proxy that accepts TCP SYN but hangs CONNECT will cleanly fail here instead of freezing live API calls.
 */
function probeHttpsViaProxy(proxyUrl: string, timeoutMs = 7500): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    const probeAgent = new HttpsProxyAgent(proxyUrl, {
      family: 4,
      keepAlive: false,
      timeout: timeoutMs,
    });

    let req: ReturnType<typeof https.get> | null = null;
    const hardTimer = setTimeout(() => {
      try { req?.destroy(); } catch {}
      finishErr(`HTTPS CONNECT timed out (${Math.round(timeoutMs / 1000)}s)`);
    }, timeoutMs + 200);

    const finishErr = (msg: string) => {
      if (!done) {
        done = true;
        clearTimeout(hardTimer);
        try { probeAgent.destroy(); } catch {}
        reject(new Error(msg));
      }
    };

    req = https.get(
      "https://api.ipify.org?format=json",
      { agent: probeAgent, timeout: timeoutMs },
      (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          if (done) return;
          done = true;
          clearTimeout(hardTimer);
          try { probeAgent.destroy(); } catch {}
          if ((res.statusCode || 500) >= 400) {
            return reject(new Error(`Proxy HTTP ${res.statusCode}`));
          }
          try {
            const parsed = JSON.parse(body);
            const ip = String(parsed?.ip || "").trim();
            if (ip && ip.length <= 45) return resolve(ip);
          } catch {}
          const plain = body.trim();
          if (/^\d{1,3}(\.\d{1,3}){3}$/.test(plain)) return resolve(plain);
          reject(new Error("Invalid IP response through proxy"));
        });
      }
    );

    req.on("error", (err: any) => finishErr(err?.message || "HTTPS CONNECT failed"));
    req.setTimeout(timeoutMs, () => {
      try { req?.destroy(); } catch {}
      finishErr(`HTTPS CONNECT timed out (${Math.round(timeoutMs / 1000)}s)`);
    });
  });
}

let activeProbePromise: Promise<{ online: boolean; detectedIp: string; tcpOpen: boolean; error?: string }> | null = null;

/**
 * Full proxy health prober (TCP + real HTTPS CONNECT verification).
 */
export async function testProxyConnectivity(
  targetUrl?: string,
  timeoutMs = 7500
): Promise<{ online: boolean; detectedIp: string; tcpOpen: boolean; error?: string }> {
  const proxyToTest =
    (typeof targetUrl === "string" ? targetUrl.trim() : "") ||
    getConfiguredProxyUrl();

  if (!proxyToTest) {
    proxyHealthCache = { url: "", online: false, detectedIp: "", tcpOpen: false, lastError: "No proxy configured", lastChecked: Date.now() };
    return { online: false, detectedIp: "", tcpOpen: false, error: "No proxy configured" };
  }

  if (activeProbePromise && !targetUrl) {
    return activeProbePromise;
  }

  const runProbe = async () => {
    let portOpen = false;
    let host = "";
    let port = 8888;
    try {
      const parsed = new URL(proxyToTest);
      host = parsed.hostname;
      port = Number(parsed.port) || 8888;

      portOpen = await probeTcpPort(host, port, Math.min(3800, timeoutMs));
      if (!portOpen) {
        const errMsg = `Proxy port ${host}:${port} is unreachable (check GCP Firewall TCP:${port})`;
        proxyHealthCache = {
          url: proxyToTest,
          online: false,
          detectedIp: "",
          tcpOpen: false,
          lastError: errMsg,
          lastChecked: Date.now(),
        };
        return { online: false, detectedIp: "", tcpOpen: false, error: errMsg };
      }

      const detectedIp = await probeHttpsViaProxy(proxyToTest, timeoutMs);
      proxyHealthCache = {
        url: proxyToTest,
        online: true,
        detectedIp,
        tcpOpen: true,
        lastError: "",
        lastChecked: Date.now(),
      };
      return { online: true, detectedIp, tcpOpen: true };
    } catch (err: any) {
      const rawMsg = err?.message || "Proxy HTTPS CONNECT failed";
      const errMsg = portOpen
        ? `TCP port ${host}:${port} is OPEN, but ${rawMsg} — Tinyproxy MaxClients or Allow ACL on GCP VM may be blocking or stalled.`
        : rawMsg;
      proxyHealthCache = {
        url: proxyToTest,
        online: false,
        detectedIp: "",
        tcpOpen: portOpen,
        lastError: errMsg,
        lastChecked: Date.now(),
      };
      if (sharedProxyAgent) {
        try { sharedProxyAgent.destroy(); } catch {}
        sharedProxyAgent = null;
      }
      return { online: false, detectedIp: "", tcpOpen: portOpen, error: errMsg };
    } finally {
      activeProbePromise = null;
    }
  };

  if (!targetUrl) {
    activeProbePromise = runProbe();
    return activeProbePromise;
  }
  return runProbe();
}

export function markProxyUnhealthy(reason: string) {
  const configured = getConfiguredProxyUrl();
  proxyHealthCache = {
    url: configured,
    online: false,
    detectedIp: "",
    tcpOpen: proxyHealthCache.tcpOpen,
    lastError: reason,
    lastChecked: Date.now(),
  };
  if (sharedProxyAgent) {
    try { sharedProxyAgent.destroy(); } catch {}
    sharedProxyAgent = null;
  }
}

/**
 * Returns true ONLY when the configured proxy is verified healthy via real HTTPS CONNECT.
 * Uses stale-while-revalidate when refreshing an already-verified proxy so traffic never flaps.
 */
export function isProxyCurrentlyOnline(): boolean {
  const configured = getConfiguredProxyUrl();
  const state = evaluateProxyHealthCacheState(proxyHealthCache, configured, Date.now());
  if (state.shouldRefresh && configured && !activeProbePromise) {
    testProxyConnectivity(configured, 7500).catch(() => {});
  }
  return state.online;
}

export function getProxyStatusSummary() {
  const configured = getConfiguredProxyUrl();
  const isOnline = isProxyCurrentlyOnline();
  const detectedContainerIp = containerIpCache.ip || "";
  return {
    configuredProxy: configured,
    isProxyActive: isOnline,
    tcpOpen: proxyHealthCache.tcpOpen,
    activeIp: isOnline
      ? proxyHealthCache.detectedIp || FIXED_PRIMARY_IP
      : detectedContainerIp || FIXED_SECONDARY_IP,
    containerIp: detectedContainerIp || "Detecting...",
    primaryStaticIp: FIXED_PRIMARY_IP,
    lastError: !isOnline ? proxyHealthCache.lastError : "",
    lastChecked: proxyHealthCache.lastChecked,
  };
}

export function getSharedProxyAgent(proxyUrl: string): HttpsProxyAgent<string> {
  const cleanUrl = proxyUrl.trim();
  if (!sharedProxyAgent || sharedProxyAgentUrl !== cleanUrl) {
    sharedProxyAgentUrl = cleanUrl;
    sharedProxyAgent = new HttpsProxyAgent(cleanUrl, {
      family: 4,
      keepAlive: true,
      keepAliveMsecs: 15000,
      maxSockets: 3,
      maxFreeSockets: 1,
      timeout: 10000,
    });
  }
  return sharedProxyAgent;
}

export function getUpstoxAgent() {
  const proxyUrl = getConfiguredProxyUrl();
  if (proxyUrl && isProxyCurrentlyOnline()) {
    try {
      return getSharedProxyAgent(proxyUrl);
    } catch {
      // Fall through to direct IPv4
    }
  }
  return upstoxIpv4Agent;
}

// Called explicitly from bootstrap so unit tests don't spawn background network probes on import
export function warmUpUpstoxTransport() {
  getDetectedContainerIp().catch(() => {});
  if (getConfiguredProxyUrl()) {
    testProxyConnectivity().catch(() => {});
    // Periodic background keepalive probe every 30 seconds to guarantee proxy stays online and warm
    setInterval(() => {
      if (getConfiguredProxyUrl()) {
        testProxyConnectivity().catch(() => {});
      }
    }, 30000);
  }
}

/**
 * Resilient Upstox Fetch:
 * Routes account, profile, funds, portfolio, auth, and order calls through the verified HTTP proxy
 * with a lean socket pool; routes high-frequency read-only market polling directly via IPv4 so
 * Tinyproxy workers on small GCP VMs are never starved.
 */
async function upstoxFetch(url: string, options: any = {}): Promise<Response> {
  const proxyUrl = getConfiguredProxyUrl();

  if (proxyUrl && shouldUseProxyForUrl(url) && isProxyCurrentlyOnline()) {
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
        let req: ReturnType<typeof https.request> | null = null;
        const hardTimer = setTimeout(() => {
          if (!done) {
            done = true;
            try { req?.destroy(); } catch {}
            reject(new Error("Upstox proxy request timed out (6s)"));
          }
        }, 6200);

        req = https.request(
          url,
          { method, agent, family: 4, headers },
          (res) => {
            if (done) return;
            done = true;
            clearTimeout(hardTimer);
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              const bodyBuffer = Buffer.concat(chunks);
              proxyHealthCache.online = true;
              proxyHealthCache.tcpOpen = true;
              proxyHealthCache.lastError = "";
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
            clearTimeout(hardTimer);
            req.destroy();
            return reject(new Error("Request aborted"));
          }
          options.signal.addEventListener("abort", () => {
            if (!done) {
              done = true;
              clearTimeout(hardTimer);
              req?.destroy();
              reject(new Error("Request aborted"));
            }
          });
        }

        req.on("error", (err) => {
          if (!done) {
            done = true;
            clearTimeout(hardTimer);
            reject(new Error(`Upstox proxy error: ${err?.message}`));
          }
        });

        req.setTimeout(6000, () => {
          if (!done) {
            done = true;
            clearTimeout(hardTimer);
            req?.destroy();
            reject(new Error("Upstox proxy request timed out (6s)"));
          }
        });

        if (bodyData) {
          req.write(typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData));
        }
        req.end();
      });

      return proxyRes;
    } catch (err: any) {
      if (err?.message === "Request aborted") {
        throw err;
      }
      // Proxy failed or timed out — mark unhealthy and fall back immediately to direct IPv4
      markProxyUnhealthy(err?.message || "Proxy timeout");
    }
  }

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
  const proxyUrl = getConfiguredProxyUrl();
  if (proxyUrl && (!isProxyCurrentlyOnline() || retryCount === 0)) {
    await testProxyConnectivity(proxyUrl, 5000).catch(() => {});
  }
  const isOnline = isProxyCurrentlyOnline();
  const agent = proxyUrl && isOnline ? getSharedProxyAgent(proxyUrl) : getUpstoxAgent();
  console.log(`[UPSTOX ORDER ROUTE] Order: ${orderPayload.transaction_type} ${orderPayload.quantity} ${orderPayload.instrument_token || orderPayload.symbol} -> Egress via: ${agent !== upstoxIpv4Agent ? `STATIC PROXY (${FIXED_PRIMARY_IP})` : "DIRECT IPV4"}`);

  return new Promise((resolve) => {
    let settled = false;
    const dataStr = JSON.stringify(orderPayload);
    let req: ReturnType<typeof https.request> | null = null;

    const hardOrderTimer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      try { req?.destroy(); } catch {}
      if (agent !== upstoxIpv4Agent) {
        markProxyUnhealthy("Order proxy request timed out (8s)");
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: "error", message: "Upstox order request timed out" });
    }, 8200);

    req = https.request(
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
          clearTimeout(hardOrderTimer);
          if (settled) return;
          settled = true;
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
      clearTimeout(hardOrderTimer);
      if (settled) return;
      settled = true;
      if (agent !== upstoxIpv4Agent) {
        markProxyUnhealthy(err?.message || "Order proxy socket error");
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: "error", message: err?.message || "Network error" });
    });
    req.setTimeout(8000, async () => {
      clearTimeout(hardOrderTimer);
      if (settled) return;
      settled = true;
      try { req?.destroy(); } catch {}
      if (agent !== upstoxIpv4Agent) {
        markProxyUnhealthy("Order proxy request timed out (8s)");
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: "error", message: "Upstox order request timed out" });
    });
    req.write(dataStr);
    req.end();
  });
}
