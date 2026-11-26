import { createProxyAgent } from './proxyProbe';
import { evaluateProxyHealthCacheState } from './proxyRouting';
import { FIXED_PRIMARY_IP, FIXED_SECONDARY_IP } from '../upstoxTransportConstants';
import { transportState, upstoxIpv4Agent } from './transportState';
import { getConfiguredProxyUrl, getDetectedContainerIp } from './proxyUrl';
import { testProxyConnectivity } from './proxyConnectivityProbe';

export { getConfiguredProxyUrl, getDetectedContainerIp } from './proxyUrl';
export { testProxyConnectivity } from './proxyConnectivityProbe';

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
