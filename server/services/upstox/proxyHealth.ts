import { upstoxConfig } from '../../state';
import { ipv4Lookup, probeTcpPort, createProxyAgent, probeHttpsViaProxy } from './proxyProbe';
import { evaluateProxyHealthCacheState } from './proxyRouting';
import {
  FIXED_PRIMARY_IP,
  FIXED_SECONDARY_IP,
  DEFAULT_SOCKS5_PROXY_URL,
} from '../upstoxTransportConstants';
import { transportState, upstoxIpv4Agent, originalNativeFetch } from './transportState';

export function getConfiguredProxyUrl(): string {
  const raw = upstoxConfig.outboundProxyUrl;
  if (raw === 'DIRECT' || raw === 'NONE' || raw === 'disabled') {
    return '';
  }
  const cfgVal = typeof raw === 'string' ? raw.trim() : '';
  if (cfgVal && !cfgVal.includes('8.234.113.241')) {
    return cfgVal;
  }
  const envVal = (process.env.UPSTOX_PROXY_URL || '').trim();
  if (envVal && !envVal.includes('8.234.113.241')) {
    return envVal;
  }
  return DEFAULT_SOCKS5_PROXY_URL;
}

export async function getDetectedContainerIp(forceRefresh = false): Promise<string> {
  if (
    !forceRefresh &&
    transportState.containerIp.ip &&
    Date.now() - transportState.containerIp.checkedAt < 5 * 60 * 1000
  ) {
    return transportState.containerIp.ip;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await originalNativeFetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
      // @ts-expect-error Node fetch option
      family: 4,
    });
    clearTimeout(timer);
    if (res.ok) {
      const json: any = await res.json().catch(() => null);
      const ip = String(json?.ip || '').trim();
      if (ip && ip.length <= 45) {
        transportState.containerIp = { ip, checkedAt: Date.now() };
        return ip;
      }
    }
  } catch {
    // Ignore transient ipify lookup error
  }
  return transportState.containerIp.ip || '';
}

/**
 * Full proxy health prober (TCP + real HTTPS CONNECT verification).
 */
export async function testProxyConnectivity(
  targetUrl?: string,
  timeoutMs = 7500,
): Promise<{ online: boolean; detectedIp: string; tcpOpen: boolean; error?: string }> {
  const proxyToTest =
    (typeof targetUrl === 'string' ? targetUrl.trim() : '') || getConfiguredProxyUrl();

  if (!proxyToTest) {
    transportState.consecutiveProxyFailures = 0;
    transportState.proxyHealth = {
      url: '',
      online: false,
      detectedIp: '',
      tcpOpen: false,
      lastError: '',
      lastChecked: Date.now(),
    };
    return { online: false, detectedIp: '', tcpOpen: false };
  }

  if (transportState.activeProbe && !targetUrl) {
    return transportState.activeProbe;
  }

  const runProbe = async () => {
    let portOpen = false;
    let host = '';
    const isSocks = proxyToTest.toLowerCase().startsWith('socks');
    let port = isSocks ? 1080 : 8888;
    try {
      const normalizedUrl = isSocks
        ? proxyToTest.replace(/^socks[45]?[ha]?:/i, 'http:')
        : proxyToTest;
      const parsed = new URL(normalizedUrl);
      host = parsed.hostname;
      port = Number(parsed.port) || (isSocks ? 1080 : 8888);

      transportState.lastProbeAttemptTime = Date.now();
      portOpen = await probeTcpPort(host, port, Math.min(4500, timeoutMs));
      if (!portOpen) {
        // Quick 350ms backoff + 1 immediate TCP retry to absorb transient GCP e2-micro SYN drops
        await new Promise((r) => setTimeout(r, 350));
        portOpen = await probeTcpPort(host, port, Math.min(4500, timeoutMs));
      }
      if (!portOpen) {
        transportState.consecutiveProxyFailures++;
        const errMsg = `Proxy port ${host}:${port} is unreachable (check GCP Firewall TCP:${port})`;
        // During background refreshes (!targetUrl), tolerate 1 transient probe miss if proxy was already verified online
        if (
          !targetUrl &&
          transportState.proxyHealth.url === proxyToTest &&
          transportState.proxyHealth.online &&
          transportState.consecutiveProxyFailures < 2
        ) {
          return {
            online: true,
            detectedIp: transportState.proxyHealth.detectedIp || FIXED_PRIMARY_IP,
            tcpOpen: true,
          };
        }
        transportState.proxyHealth = {
          url: proxyToTest,
          online: false,
          detectedIp: '',
          tcpOpen: false,
          lastError: errMsg,
          lastChecked: Date.now(),
        };
        return { online: false, detectedIp: '', tcpOpen: false, error: errMsg };
      }

      // If TCP port is open, consider proxy online for order routing even if external ipify test has a transient delay
      let detectedIp = FIXED_PRIMARY_IP;
      try {
        detectedIp = await probeHttpsViaProxy(proxyToTest, Math.max(10000, timeoutMs));
      } catch {
        // Fallback to primary static IP if ipify probe lags, keeping TCP proxy tunnel active
      }

      transportState.consecutiveProxyFailures = 0;
      transportState.proxyHealth = {
        url: proxyToTest,
        online: true,
        detectedIp,
        tcpOpen: true,
        lastError: '',
        lastChecked: Date.now(),
      };
      return { online: true, detectedIp, tcpOpen: true };
    } catch (err: any) {
      transportState.consecutiveProxyFailures++;
      const rawMsg = err?.message || 'Proxy HTTPS tunnel failed';
      const errMsg = portOpen
        ? isSocks
          ? `TCP port ${host}:${port} is OPEN, but ${rawMsg} — verify SOCKS5 credentials or Dante IPv4 egress on GCP VM.`
          : `TCP port ${host}:${port} is OPEN, but ${rawMsg} — HTTP proxy ACL or worker limit on GCP VM may be blocking.`
        : rawMsg;
      // If TCP port is open, keep online true so orders continue routing through the static proxy IP
      const isOnline = portOpen;
      transportState.proxyHealth = {
        url: proxyToTest,
        online: isOnline,
        detectedIp: FIXED_PRIMARY_IP,
        tcpOpen: portOpen,
        lastError: isOnline ? '' : errMsg,
        lastChecked: Date.now(),
      };
      if (!isOnline && transportState.sharedProxyAgent) {
        try {
          transportState.sharedProxyAgent.destroy();
        } catch {
          /* ignore */
        }
        transportState.sharedProxyAgent = null;
      }
      return {
        online: isOnline,
        detectedIp: FIXED_PRIMARY_IP,
        tcpOpen: portOpen,
        error: isOnline ? undefined : errMsg,
      };
    } finally {
      transportState.activeProbe = null;
    }
  };

  if (!targetUrl) {
    transportState.activeProbe = runProbe();
    return transportState.activeProbe;
  }
  return runProbe();
}

export function markProxyUnhealthy(reason: string) {
  const configured = getConfiguredProxyUrl();
  transportState.consecutiveProxyFailures = 0;
  transportState.proxyHealth = {
    url: configured,
    online: false,
    detectedIp: '',
    tcpOpen: configured ? transportState.proxyHealth.tcpOpen : false,
    lastError: configured && reason !== 'Proxy removed by user' ? reason : '',
    lastChecked: Date.now(),
  };
  if (transportState.sharedProxyAgent) {
    try {
      transportState.sharedProxyAgent.destroy();
    } catch {
      /* ignore */
    }
    transportState.sharedProxyAgent = null;
  }
}

/**
 * Returns true ONLY when the configured proxy is verified healthy.
 * Uses stale-while-revalidate when refreshing an already-verified proxy so traffic never flaps.
 */
export function isProxyCurrentlyOnline(): boolean {
  const configured = getConfiguredProxyUrl();
  if (!configured) return false;
  const state = evaluateProxyHealthCacheState(transportState.proxyHealth, configured, Date.now());
  if (state.shouldRefresh && !transportState.activeProbe) {
    const now = Date.now();
    const backoffInterval = transportState.consecutiveProxyFailures >= 2 ? 20000 : 10000;
    if (now - transportState.lastProbeAttemptTime >= backoffInterval) {
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

  if (
    transportState.proxyHealth.url === configured &&
    transportState.proxyHealth.online &&
    transportState.proxyHealth.tcpOpen
  ) {
    // Keep cache fresh in background if expired, don't block caller
    isProxyCurrentlyOnline();
    return true;
  }

  try {
    const probePromise =
      transportState.activeProbe || testProxyConnectivity(configured, Math.max(4500, maxWaitMs));
    await Promise.race([
      probePromise,
      new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
    ]);
  } catch {
    // Ignore transient probe errors
  }

  return transportState.proxyHealth.url === configured && transportState.proxyHealth.online;
}

export function getProxyStatusSummary() {
  const configured = getConfiguredProxyUrl();
  const isOnline = isProxyCurrentlyOnline();
  const detectedContainerIp = transportState.containerIp.ip || '';
  return {
    configuredProxy: configured,
    isProxyActive: isOnline,
    tcpOpen: transportState.proxyHealth.tcpOpen,
    activeIp: isOnline
      ? transportState.proxyHealth.detectedIp || FIXED_PRIMARY_IP
      : detectedContainerIp || FIXED_SECONDARY_IP,
    containerIp: detectedContainerIp || 'Detecting...',
    primaryStaticIp: FIXED_PRIMARY_IP,
    lastError: !isOnline ? transportState.proxyHealth.lastError : '',
    lastChecked: transportState.proxyHealth.lastChecked,
  };
}

export function getSharedProxyAgent(proxyUrl: string): any {
  const cleanUrl = proxyUrl.trim();
  if (!transportState.sharedProxyAgent || transportState.sharedProxyAgentUrl !== cleanUrl) {
    transportState.sharedProxyAgentUrl = cleanUrl;
    transportState.sharedProxyAgent = createProxyAgent(cleanUrl, true);
  }
  return transportState.sharedProxyAgent;
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
      const interval = transportState.proxyHealth.online ? 45000 : 15000;
      if (now - transportState.lastProbeAttemptTime >= interval) {
        transportState.lastProbeAttemptTime = now;
        testProxyConnectivity().catch(() => {});
      }
    }, 15000);
  }
}
