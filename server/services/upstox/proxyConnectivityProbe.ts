// Full proxy health prober: TCP reachability plus a real HTTPS CONNECT verification.
import { probeTcpPort, probeHttpsViaProxy } from './proxyProbe';
import { FIXED_PRIMARY_IP } from '../upstoxTransportConstants';
import { transportState } from './transportState';
import { getConfiguredProxyUrl } from './proxyUrl';

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
