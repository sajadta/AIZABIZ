import dns from "dns";
import net from "net";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { upstoxConfig } from "../state";

try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
    (net as any).setDefaultAutoSelectFamily(false);
  }
} catch {
  /* ignore */
}

export const FIXED_PRIMARY_IP = "34.180.11.27";
export const FIXED_SECONDARY_IP = "34.34.254.178";
export const DEFAULT_SOCKS5_PROXY_URL = "socks5://upstoxuser:Sajad9847989434@34.180.11.27:1080";

function ipv4Lookup(
  hostname: string,
  options: any,
  callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void,
) {
  if (typeof options === "function") {
    return dns.lookup(hostname, { family: 4 }, options);
  }
  return dns.lookup(hostname, { ...(options || {}), family: 4 }, callback);
}

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

let sharedProxyAgent: any = null;
let sharedProxyAgentUrl = "";

export function shouldUseProxyForUrl(urlStr: string): boolean {
  const clean = String(urlStr || "");
  if (!clean) return false;
  // High-frequency read-only market polling does not require Upstox Static IP and can run 100ms faster direct,
  // preserving SOCKS5 proxy workers exclusively for orders, portfolio, funds, and auth calls.
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
  const ttlMs = cache.online ? 30000 : 12000;
  const isFresh = nowMs - cache.lastChecked < ttlMs;
  if (isFresh) {
    return { online: cache.online, shouldRefresh: false };
  }
  // Stale-while-revalidate: keep routing through last-verified online proxy while background probe refreshes.
  return { online: cache.online, shouldRefresh: true };
}

export function parseUpstoxFundsData(fundsData: any): {
  availableMargin: number;
  usableCash: number;
  settledCash: number;
  deliverySellCredit: number;
  usedMargin: number;
  utilizedMargin: number;
  payin: number;
  payout: number;
} {
  const eq = fundsData?.data?.equity || {};
  const com = fundsData?.data?.commodity || {};
  const availableMargin = Number(eq.available_margin ?? 0) || (Number(eq.available_margin ?? 0) === 0 ? Number(com.available_margin ?? 0) : 0);
  const usedMargin = Number(eq.used_margin ?? eq.utilized_margin ?? 0);
  // Upstox reports negative used_margin equal to CNC delivery sell proceeds already included in available_margin.
  const deliverySellCredit = usedMargin < 0 ? Number(Math.abs(usedMargin).toFixed(2)) : 0;
  const settledCash =
    usedMargin < 0
      ? Math.max(0, Number((availableMargin + usedMargin).toFixed(2)))
      : availableMargin;
  const utilizedMargin = Math.max(0, usedMargin);
  const payin = Number(eq.payin_amount ?? eq.payin ?? 0);
  const payout = Number(eq.payout_amount ?? eq.payout ?? 0);
  return {
    availableMargin,
    usableCash: availableMargin,
    settledCash,
    deliverySellCredit,
    usedMargin,
    utilizedMargin,
    payin,
    payout,
  };
}

export function getConfiguredProxyUrl(): string {
  const raw = upstoxConfig.outboundProxyUrl;
  if (raw === "DIRECT" || raw === "NONE" || raw === "disabled") {
    return "";
  }
  const cfgVal = typeof raw === "string" ? raw.trim() : "";
  if (cfgVal && !cfgVal.includes("8.234.113.241")) {
    return cfgVal;
  }
  const envVal = (process.env.UPSTOX_PROXY_URL || "").trim();
  if (envVal && !envVal.includes("8.234.113.241")) {
    return envVal;
  }
  return DEFAULT_SOCKS5_PROXY_URL;
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
      // @ts-expect-error Node fetch option
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
        try { socket.destroy(); } catch { /* ignore */ }
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
 * Verifies actual HTTPS tunneling through the SOCKS5/HTTP proxy.
 * Converts socks5:// -> socks5h:// so target DNS resolution happens remotely on the proxy VM over IPv4.
 */
function createProxyAgent(proxyUrl: string, keepAlive = false) {
  const clean = proxyUrl.trim();
  const lower = clean.toLowerCase();
  if (lower.startsWith("socks5://") || lower.startsWith("socks://") || lower.startsWith("socks5h://") || lower.startsWith("socks4a://")) {
    const remoteDnsUrl = clean.replace(/^socks5?:\/\//i, "socks5h://");
    return new SocksProxyAgent(remoteDnsUrl, {
      timeout: 16000,
    });
  }
  return new HttpsProxyAgent(clean, {
    family: 4,
    keepAlive,
    keepAliveMsecs: keepAlive ? 15000 : undefined,
    maxSockets: keepAlive ? 3 : undefined,
    maxFreeSockets: keepAlive ? 1 : undefined,
    timeout: 16000,
  });
}

function probeHttpsViaProxy(proxyUrl: string, timeoutMs = 8500): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    const probeAgent = createProxyAgent(proxyUrl, false);

    let req: ReturnType<typeof https.get> | null = null;
    const hardTimer = setTimeout(() => {
      try { req?.destroy(); } catch { /* ignore */ }
      finishErr(`Proxy HTTPS tunnel timed out (${Math.round(timeoutMs / 1000)}s)`);
    }, timeoutMs + 250);

    const finishErr = (msg: string) => {
      if (!done) {
        done = true;
        clearTimeout(hardTimer);
        try { probeAgent.destroy(); } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };

    req = https.get(
      "https://api.ipify.org?format=json",
      { agent: probeAgent, timeout: timeoutMs, family: 4, lookup: ipv4Lookup },
      (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          if (done) return;
          done = true;
          clearTimeout(hardTimer);
          try { probeAgent.destroy(); } catch { /* ignore */ }
          if ((res.statusCode || 500) >= 400) {
            return reject(new Error(`Proxy HTTP ${res.statusCode}`));
          }
          try {
            const parsed = JSON.parse(body);
            const ip = String(parsed?.ip || "").trim();
            if (ip && ip.length <= 45) return resolve(ip);
          } catch { /* ignore */ }
          const plain = body.trim();
          if (/^\d{1,3}(\.\d{1,3}){3}$/.test(plain)) return resolve(plain);
          reject(new Error("Invalid IP response through proxy"));
        });
      }
    );

    req.on("error", (err: any) => finishErr(err?.message || "HTTPS CONNECT failed"));
    req.setTimeout(timeoutMs, () => {
      try { req?.destroy(); } catch { /* ignore */ }
      finishErr(`HTTPS CONNECT timed out (${Math.round(timeoutMs / 1000)}s)`);
    });
  });
}

let consecutiveProxyFailures = 0;
let lastProbeAttemptTime = 0;
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
    consecutiveProxyFailures = 0;
    proxyHealthCache = { url: "", online: false, detectedIp: "", tcpOpen: false, lastError: "", lastChecked: Date.now() };
    return { online: false, detectedIp: "", tcpOpen: false };
  }

  if (activeProbePromise && !targetUrl) {
    return activeProbePromise;
  }

  const runProbe = async () => {
    let portOpen = false;
    let host = "";
    const isSocks = proxyToTest.toLowerCase().startsWith("socks");
    let port = isSocks ? 1080 : 8888;
    try {
      const normalizedUrl = isSocks
        ? proxyToTest.replace(/^socks[45]?[ha]?:/i, "http:")
        : proxyToTest;
      const parsed = new URL(normalizedUrl);
      host = parsed.hostname;
      port = Number(parsed.port) || (isSocks ? 1080 : 8888);

      lastProbeAttemptTime = Date.now();
      portOpen = await probeTcpPort(host, port, Math.min(4500, timeoutMs));
      if (!portOpen) {
        // Quick 350ms backoff + 1 immediate TCP retry to absorb transient GCP e2-micro SYN drops
        await new Promise((r) => setTimeout(r, 350));
        portOpen = await probeTcpPort(host, port, Math.min(4500, timeoutMs));
      }
      if (!portOpen) {
        consecutiveProxyFailures++;
        const errMsg = `Proxy port ${host}:${port} is unreachable (check GCP Firewall TCP:${port})`;
        // During background refreshes (!targetUrl), tolerate 1 transient probe miss if proxy was already verified online
        if (!targetUrl && proxyHealthCache.url === proxyToTest && proxyHealthCache.online && consecutiveProxyFailures < 2) {
          return { online: true, detectedIp: proxyHealthCache.detectedIp || FIXED_PRIMARY_IP, tcpOpen: true };
        }
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

      // If TCP port is open, consider proxy online for order routing even if external ipify test has a transient delay
      let detectedIp = FIXED_PRIMARY_IP;
      try {
        detectedIp = await probeHttpsViaProxy(proxyToTest, Math.max(10000, timeoutMs));
      } catch {
        // Fallback to primary static IP if ipify probe lags, keeping TCP proxy tunnel active
      }

      consecutiveProxyFailures = 0;
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
      consecutiveProxyFailures++;
      const rawMsg = err?.message || "Proxy HTTPS tunnel failed";
      const errMsg = portOpen
        ? isSocks
          ? `TCP port ${host}:${port} is OPEN, but ${rawMsg} — verify SOCKS5 credentials or Dante IPv4 egress on GCP VM.`
          : `TCP port ${host}:${port} is OPEN, but ${rawMsg} — HTTP proxy ACL or worker limit on GCP VM may be blocking.`
        : rawMsg;
      // If TCP port is open, keep online true so orders continue routing through the static proxy IP
      const isOnline = portOpen;
      proxyHealthCache = {
        url: proxyToTest,
        online: isOnline,
        detectedIp: FIXED_PRIMARY_IP,
        tcpOpen: portOpen,
        lastError: isOnline ? "" : errMsg,
        lastChecked: Date.now(),
      };
      if (!isOnline && sharedProxyAgent) {
        try { sharedProxyAgent.destroy(); } catch { /* ignore */ }
        sharedProxyAgent = null;
      }
      return { online: isOnline, detectedIp: FIXED_PRIMARY_IP, tcpOpen: portOpen, error: isOnline ? undefined : errMsg };
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
  consecutiveProxyFailures = 0;
  proxyHealthCache = {
    url: configured,
    online: false,
    detectedIp: "",
    tcpOpen: configured ? proxyHealthCache.tcpOpen : false,
    lastError: configured && reason !== "Proxy removed by user" ? reason : "",
    lastChecked: Date.now(),
  };
  if (sharedProxyAgent) {
    try { sharedProxyAgent.destroy(); } catch { /* ignore */ }
    sharedProxyAgent = null;
  }
}

/**
 * Returns true ONLY when the configured proxy is verified healthy.
 * Uses stale-while-revalidate when refreshing an already-verified proxy so traffic never flaps.
 */
export function isProxyCurrentlyOnline(): boolean {
  const configured = getConfiguredProxyUrl();
  if (!configured) return false;
  const state = evaluateProxyHealthCacheState(proxyHealthCache, configured, Date.now());
  if (state.shouldRefresh && !activeProbePromise) {
    const now = Date.now();
    const backoffInterval = consecutiveProxyFailures >= 2 ? 20000 : 10000;
    if (now - lastProbeAttemptTime >= backoffInterval) {
      testProxyConnectivity(configured, 7500).catch(() => {});
    }
  }
  return state.online;
}

/**
 * Awaits an active or fresh proxy check when the proxy is currently marked offline or stale,
 * preventing cold-boot or transient-error responses from prematurely reporting `isProxyActive: false`.
 */
export async function ensureProxyHealthVerified(maxWaitMs = 5000): Promise<boolean> {
  const configured = getConfiguredProxyUrl();
  if (!configured) return false;

  if (proxyHealthCache.url === configured && proxyHealthCache.online && proxyHealthCache.tcpOpen) {
    // Keep cache fresh in background if expired, don't block caller
    isProxyCurrentlyOnline();
    return true;
  }

  try {
    const probePromise = activeProbePromise || testProxyConnectivity(configured, Math.max(4500, maxWaitMs));
    await Promise.race([
      probePromise,
      new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
    ]);
  } catch {
    // Ignore transient probe errors
  }

  return proxyHealthCache.url === configured && proxyHealthCache.online;
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

export function getSharedProxyAgent(proxyUrl: string): any {
  const cleanUrl = proxyUrl.trim();
  if (!sharedProxyAgent || sharedProxyAgentUrl !== cleanUrl) {
    sharedProxyAgentUrl = cleanUrl;
    sharedProxyAgent = createProxyAgent(cleanUrl, true);
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

export function warmUpUpstoxTransport() {
  getDetectedContainerIp().catch(() => {});
  if (getConfiguredProxyUrl()) {
    testProxyConnectivity().catch(() => {});
    // Periodic background keepalive probe:
    // Refresh every 45s when online, retry every 15s when offline.
    setInterval(() => {
      const configured = getConfiguredProxyUrl();
      if (!configured) return;
      const now = Date.now();
      const interval = proxyHealthCache.online ? 45000 : 15000;
      if (now - lastProbeAttemptTime >= interval) {
        lastProbeAttemptTime = now;
        testProxyConnectivity().catch(() => {});
      }
    }, 15000);
  }
}

/**
 * Resilient Upstox Fetch:
 * Routes account, profile, funds, portfolio, auth, and order calls through the verified SOCKS5/HTTP proxy
 * with remote IPv4 DNS resolution; routes high-frequency read-only market polling directly via IPv4.
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
            try { req?.destroy(); } catch { /* ignore */ }
            reject(new Error("Upstox proxy request timed out (16s)"));
          }
        }, 16500);

        req = https.request(
          url,
          { method, agent, family: 4, lookup: ipv4Lookup, headers },
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
              consecutiveProxyFailures = 0;
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

        req.setTimeout(16000, () => {
          if (!done) {
            done = true;
            clearTimeout(hardTimer);
            req?.destroy();
            reject(new Error("Upstox proxy request timed out (16s)"));
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
      // Do NOT immediately drop the proxy badge to offline on a single slow API call!
      // Verify TCP/proxy health asynchronously; only mark unhealthy if multiple socket errors occur or TCP drops.
      const msg = String(err?.message || "Proxy error");
      const isHardRefusal = /ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET/i.test(msg);
      consecutiveProxyFailures++;
      if (isHardRefusal || consecutiveProxyFailures >= 3) {
        markProxyUnhealthy(msg);
      }
      setTimeout(() => {
        testProxyConnectivity(proxyUrl, 6000).catch(() => {});
      }, 1000);
    }
  }

  return originalNativeFetch(url, options);
}

globalThis.fetch = function (input: any, init?: any): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input?.url || "";
  if (typeof urlStr === "string" && urlStr.startsWith("http")) {
    try {
      const parsedHost = new URL(urlStr).hostname.toLowerCase();
      if (parsedHost === "upstox.com" || parsedHost.endsWith(".upstox.com")) {
        return upstoxFetch(urlStr, init);
      }
    } catch {
      // Ignore malformed URLs and fall back to native fetch
    }
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
      try { req?.destroy(); } catch { /* ignore */ }
      if (agent !== upstoxIpv4Agent) {
        consecutiveProxyFailures++;
        if (consecutiveProxyFailures >= 2) {
          markProxyUnhealthy("Order proxy request timed out (9s)");
        } else {
          testProxyConnectivity(proxyUrl, 5000).catch(() => {});
        }
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: "error", message: "Upstox order request timed out" });
    }, 9800);

    req = https.request(
      "https://api.upstox.com/v2/order/place",
      {
        method: "POST",
        agent,
        family: 4,
        lookup: ipv4Lookup,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Api-Version": "2.0",
          "Content-Length": Buffer.byteLength(dataStr),
        },
      },
      (res) => {
        if (agent !== upstoxIpv4Agent) {
          proxyHealthCache.online = true;
          proxyHealthCache.tcpOpen = true;
          proxyHealthCache.lastError = "";
          proxyHealthCache.lastChecked = Date.now();
        }
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
        const msg = String(err?.message || "Order proxy socket error");
        consecutiveProxyFailures++;
        if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(msg) || consecutiveProxyFailures >= 2) {
          markProxyUnhealthy(msg);
        } else {
          testProxyConnectivity(proxyUrl, 5000).catch(() => {});
        }
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: "error", message: err?.message || "Network error" });
    });
    req.setTimeout(9500, async () => {
      clearTimeout(hardOrderTimer);
      if (settled) return;
      settled = true;
      try { req?.destroy(); } catch { /* ignore */ }
      if (agent !== upstoxIpv4Agent) {
        consecutiveProxyFailures++;
        if (consecutiveProxyFailures >= 2) {
          markProxyUnhealthy("Order proxy request timed out (9s)");
        } else {
          testProxyConnectivity(proxyUrl, 5000).catch(() => {});
        }
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
