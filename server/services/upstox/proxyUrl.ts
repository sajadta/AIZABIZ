// Which outbound proxy to use, plus detection of the container's own public IP.
import { upstoxConfig } from '../../state';
import { DEFAULT_SOCKS5_PROXY_URL } from '../upstoxTransportConstants';
import { transportState, originalNativeFetch } from './transportState';

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
