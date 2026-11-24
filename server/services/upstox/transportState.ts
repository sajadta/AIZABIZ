import https from 'https';
import type { ProxyHealthState } from './proxyRouting';

export interface ProxyProbeResult {
  online: boolean;
  detectedIp: string;
  tcpOpen: boolean;
  error?: string;
}

export const upstoxIpv4Agent = new https.Agent({
  family: 4,
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 30,
  maxFreeSockets: 15,
  timeout: 15000,
});

export const originalNativeFetch = globalThis.fetch;

export const transportState = {
  proxyHealth: {
    url: '',
    online: false,
    detectedIp: '',
    tcpOpen: false,
    lastError: '',
    lastChecked: 0,
  } as ProxyHealthState,
  containerIp: { ip: '', checkedAt: 0 },
  sharedProxyAgent: null as any,
  sharedProxyAgentUrl: '',
  consecutiveProxyFailures: 0,
  lastProbeAttemptTime: 0,
  activeProbe: null as Promise<ProxyProbeResult> | null,
};
