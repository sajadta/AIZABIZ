import https from 'https';
import { ipv4Lookup } from './proxyProbe';
import { shouldUseProxyForUrl } from './proxyRouting';
import { transportState, originalNativeFetch } from './transportState';
import {
  getConfiguredProxyUrl,
  getSharedProxyAgent,
  isProxyCurrentlyOnline,
  markProxyUnhealthy,
  testProxyConnectivity,
} from './proxyHealth';

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
      const method = options.method || 'GET';
      const bodyData = options.body;

      if (bodyData && !headers['Content-Length'] && !headers['content-length']) {
        const str = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
        headers['Content-Length'] = Buffer.byteLength(str);
      }

      const proxyRes = await new Promise<Response>((resolve, reject) => {
        let done = false;
        let req: ReturnType<typeof https.request> | null = null;
        const hardTimer = setTimeout(() => {
          if (!done) {
            done = true;
            try {
              req?.destroy();
            } catch {
              /* ignore */
            }
            reject(new Error('Upstox proxy request timed out (16s)'));
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
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              const bodyBuffer = Buffer.concat(chunks);
              transportState.proxyHealth.online = true;
              transportState.proxyHealth.tcpOpen = true;
              transportState.proxyHealth.lastError = '';
              transportState.proxyHealth.lastChecked = Date.now();
              transportState.consecutiveProxyFailures = 0;
              resolve(
                new Response(bodyBuffer, {
                  status: res.statusCode || 200,
                  statusText: res.statusMessage || '',
                  headers: res.headers as any,
                }),
              );
            });
          },
        );

        if (options.signal) {
          if (options.signal.aborted) {
            done = true;
            clearTimeout(hardTimer);
            req.destroy();
            return reject(new Error('Request aborted'));
          }
          options.signal.addEventListener('abort', () => {
            if (!done) {
              done = true;
              clearTimeout(hardTimer);
              req?.destroy();
              reject(new Error('Request aborted'));
            }
          });
        }

        req.on('error', (err) => {
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
            reject(new Error('Upstox proxy request timed out (16s)'));
          }
        });

        if (bodyData) {
          req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
        }
        req.end();
      });

      return proxyRes;
    } catch (err: any) {
      if (err?.message === 'Request aborted') {
        throw err;
      }
      // Do NOT immediately drop the proxy badge to offline on a single slow API call!
      // Verify TCP/proxy health asynchronously; only mark unhealthy if multiple socket errors occur or TCP drops.
      const msg = String(err?.message || 'Proxy error');
      const isHardRefusal = /ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET/i.test(msg);
      transportState.consecutiveProxyFailures++;
      if (isHardRefusal || transportState.consecutiveProxyFailures >= 3) {
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
  const urlStr = typeof input === 'string' ? input : input?.url || '';
  if (typeof urlStr === 'string' && urlStr.startsWith('http')) {
    try {
      const parsedHost = new URL(urlStr).hostname.toLowerCase();
      if (parsedHost === 'upstox.com' || parsedHost.endsWith('.upstox.com')) {
        return upstoxFetch(urlStr, init);
      }
    } catch {
      // Ignore malformed URLs and fall back to native fetch
    }
  }
  return originalNativeFetch(input, init);
};
