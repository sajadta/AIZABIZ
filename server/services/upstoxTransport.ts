import dns from 'dns';
import net from 'net';

try {
  dns.setDefaultResultOrder('ipv4first');
  if (typeof (net as any).setDefaultAutoSelectFamily === 'function') {
    (net as any).setDefaultAutoSelectFamily(false);
  }
} catch {
  /* ignore */
}

export {
  FIXED_PRIMARY_IP,
  FIXED_SECONDARY_IP,
  DEFAULT_SOCKS5_PROXY_URL,
} from './upstoxTransportConstants';

export {
  shouldUseProxyForUrl,
  evaluateProxyHealthCacheState,
  parseUpstoxFundsData,
} from './upstox/proxyRouting';
export type { ProxyHealthState } from './upstox/proxyRouting';

export {
  getConfiguredProxyUrl,
  getDetectedContainerIp,
  testProxyConnectivity,
  markProxyUnhealthy,
  isProxyCurrentlyOnline,
  ensureProxyHealthVerified,
  getProxyStatusSummary,
  getSharedProxyAgent,
  getUpstoxAgent,
  warmUpUpstoxTransport,
} from './upstox/proxyHealth';

export { placeUpstoxOrderIpv4 } from './upstox/placeOrder';

// Registers the global fetch interceptor that routes Upstox API traffic through the static-IP proxy.
import './upstox/upstoxFetch';
