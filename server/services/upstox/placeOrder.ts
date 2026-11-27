import https from 'https';
import { ipv4Lookup } from './proxyProbe';
import { FIXED_PRIMARY_IP } from '../upstoxTransportConstants';
import { transportState, upstoxIpv4Agent } from './transportState';
import {
  getConfiguredProxyUrl,
  getSharedProxyAgent,
  getUpstoxAgent,
  isProxyCurrentlyOnline,
  markProxyUnhealthy,
  testProxyConnectivity,
} from './proxyHealth';

export async function placeUpstoxOrderIpv4(
  orderPayload: any,
  token: string,
  retryCount = 0,
): Promise<any> {
  const proxyUrl = getConfiguredProxyUrl();
  if (proxyUrl && (!isProxyCurrentlyOnline() || retryCount === 0)) {
    await testProxyConnectivity(proxyUrl, 5000).catch(() => {});
  }
  const isOnline = isProxyCurrentlyOnline();
  const agent = proxyUrl && isOnline ? getSharedProxyAgent(proxyUrl) : getUpstoxAgent();
  console.log(
    `[UPSTOX ORDER ROUTE] Order: ${orderPayload.transaction_type} ${orderPayload.quantity} ${orderPayload.instrument_token || orderPayload.symbol} -> Egress via: ${agent !== upstoxIpv4Agent ? `STATIC PROXY (${FIXED_PRIMARY_IP})` : 'DIRECT IPV4'}`,
  );

  return new Promise((resolve) => {
    let settled = false;
    const dataStr = JSON.stringify(orderPayload);
    let req: ReturnType<typeof https.request> | null = null;

    const hardOrderTimer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      try {
        req?.destroy();
      } catch {
        /* ignore */
      }
      if (agent !== upstoxIpv4Agent) {
        transportState.consecutiveProxyFailures++;
        if (transportState.consecutiveProxyFailures >= 2) {
          markProxyUnhealthy('Order proxy request timed out (9s)');
        } else {
          testProxyConnectivity(proxyUrl, 5000).catch(() => {});
        }
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: 'error', message: 'Upstox order request timed out' });
    }, 9800);

    req = https.request(
      'https://api.upstox.com/v2/order/place',
      {
        method: 'POST',
        agent,
        family: 4,
        lookup: ipv4Lookup,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Api-Version': '2.0',
          'Content-Length': Buffer.byteLength(dataStr),
        },
      },
      (res) => {
        if (agent !== upstoxIpv4Agent) {
          transportState.proxyHealth.online = true;
          transportState.proxyHealth.tcpOpen = true;
          transportState.proxyHealth.lastError = '';
          transportState.proxyHealth.lastChecked = Date.now();
        }
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', async () => {
          clearTimeout(hardOrderTimer);
          if (settled) return;
          settled = true;
          try {
            const json = JSON.parse(raw);
            if (
              json?.status !== 'success' &&
              retryCount === 0 &&
              (raw.includes('ECONNRESET') || raw.includes('socket') || raw.includes('timeout'))
            ) {
              const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
              return resolve(retryRes);
            }
            resolve(json);
          } catch {
            resolve({ status: 'error', message: raw });
          }
        });
      },
    );
    req.on('error', async (err) => {
      clearTimeout(hardOrderTimer);
      if (settled) return;
      settled = true;
      if (agent !== upstoxIpv4Agent) {
        const msg = String(err?.message || 'Order proxy socket error');
        transportState.consecutiveProxyFailures++;
        if (
          /ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(msg) ||
          transportState.consecutiveProxyFailures >= 2
        ) {
          markProxyUnhealthy(msg);
        } else {
          testProxyConnectivity(proxyUrl, 5000).catch(() => {});
        }
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: 'error', message: err?.message || 'Network error' });
    });
    req.setTimeout(9500, async () => {
      clearTimeout(hardOrderTimer);
      if (settled) return;
      settled = true;
      try {
        req?.destroy();
      } catch {
        /* ignore */
      }
      if (agent !== upstoxIpv4Agent) {
        transportState.consecutiveProxyFailures++;
        if (transportState.consecutiveProxyFailures >= 2) {
          markProxyUnhealthy('Order proxy request timed out (9s)');
        } else {
          testProxyConnectivity(proxyUrl, 5000).catch(() => {});
        }
      }
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: 'error', message: 'Upstox order request timed out' });
    });
    req.write(dataStr);
    req.end();
  });
}
