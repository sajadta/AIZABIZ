// Low-level networking helpers for the Upstox transport: IPv4-only DNS lookup,
// TCP port probes, proxy agent construction and an HTTPS-through-proxy probe.
import dns from 'dns';
import net from 'net';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export function ipv4Lookup(
  hostname: string,
  options: any,
  callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void,
) {
  if (typeof options === 'function') {
    return dns.lookup(hostname, { family: 4 }, options);
  }
  return dns.lookup(hostname, { ...(options || {}), family: 4 }, callback);
}

/**
 * Fast TCP probe to check if proxy port accepts connections (3800ms max for slow GCP micro-VMs).
 */
export function probeTcpPort(host: string, port: number, timeoutMs = 3800): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const socket = net.createConnection({ host, port, family: 4 });
    const hardTimer = setTimeout(() => finish(false), timeoutMs + 100);
    const finish = (result: boolean) => {
      if (!done) {
        done = true;
        clearTimeout(hardTimer);
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve(result);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

/**
 * Verifies actual HTTPS tunneling through the SOCKS5/HTTP proxy.
 * Converts socks5:// -> socks5h:// so target DNS resolution happens remotely on the proxy VM over IPv4.
 */
export function createProxyAgent(proxyUrl: string, keepAlive = false) {
  const clean = proxyUrl.trim();
  const lower = clean.toLowerCase();
  if (
    lower.startsWith('socks5://') ||
    lower.startsWith('socks://') ||
    lower.startsWith('socks5h://') ||
    lower.startsWith('socks4a://')
  ) {
    const remoteDnsUrl = clean.replace(/^socks5?:\/\//i, 'socks5h://');
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

export function probeHttpsViaProxy(proxyUrl: string, timeoutMs = 8500): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    const probeAgent = createProxyAgent(proxyUrl, false);

    let req: ReturnType<typeof https.get> | null = null;
    const hardTimer = setTimeout(() => {
      try {
        req?.destroy();
      } catch {
        /* ignore */
      }
      finishErr(`Proxy HTTPS tunnel timed out (${Math.round(timeoutMs / 1000)}s)`);
    }, timeoutMs + 250);

    const finishErr = (msg: string) => {
      if (!done) {
        done = true;
        clearTimeout(hardTimer);
        try {
          probeAgent.destroy();
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };

    req = https.get(
      'https://api.ipify.org?format=json',
      { agent: probeAgent, timeout: timeoutMs, family: 4, lookup: ipv4Lookup },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (done) return;
          done = true;
          clearTimeout(hardTimer);
          try {
            probeAgent.destroy();
          } catch {
            /* ignore */
          }
          if ((res.statusCode || 500) >= 400) {
            return reject(new Error(`Proxy HTTP ${res.statusCode}`));
          }
          try {
            const parsed = JSON.parse(body);
            const ip = String(parsed?.ip || '').trim();
            if (ip && ip.length <= 45) return resolve(ip);
          } catch {
            /* ignore */
          }
          const plain = body.trim();
          if (/^\d{1,3}(\.\d{1,3}){3}$/.test(plain)) return resolve(plain);
          reject(new Error('Invalid IP response through proxy'));
        });
      },
    );

    req.on('error', (err: any) => finishErr(err?.message || 'HTTPS CONNECT failed'));
    req.setTimeout(timeoutMs, () => {
      try {
        req?.destroy();
      } catch {
        /* ignore */
      }
      finishErr(`HTTPS CONNECT timed out (${Math.round(timeoutMs / 1000)}s)`);
    });
  });
}
