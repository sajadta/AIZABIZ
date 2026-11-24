// Pure routing and funds-parsing helpers shared by the Upstox transport and its tests.

export interface ProxyHealthState {
  url: string;
  online: boolean;
  detectedIp: string;
  tcpOpen: boolean;
  lastError: string;
  lastChecked: number;
}

export function shouldUseProxyForUrl(urlStr: string): boolean {
  const clean = String(urlStr || '');
  if (!clean) return false;
  // High-frequency read-only market polling does not require Upstox Static IP and can run 100ms faster direct,
  // preserving SOCKS5 proxy workers exclusively for orders, portfolio, funds, and auth calls.
  if (
    clean.includes('/market-quote/') ||
    clean.includes('/historical-candle/') ||
    clean.includes('/option/chain') ||
    clean.includes('/option/contract') ||
    clean.includes('/charges/brokerage')
  ) {
    return false;
  }
  return true;
}

export function evaluateProxyHealthCacheState(
  cache: Pick<ProxyHealthState, 'url' | 'online' | 'lastChecked'>,
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
  const availableMargin =
    Number(eq.available_margin ?? 0) ||
    (Number(eq.available_margin ?? 0) === 0 ? Number(com.available_margin ?? 0) : 0);
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
