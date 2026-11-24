import { useEffect } from 'react';
import type { BotConfig, ExecutionMode, Position, UpstoxApiConfig } from '../types';
import { safeStorage } from '../utils/storage';

interface UseAppBootstrapParams {
  setMode: React.Dispatch<React.SetStateAction<ExecutionMode>>;
  setBotConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  setApiConfig: React.Dispatch<React.SetStateAction<UpstoxApiConfig>>;
  setTradeHistory: React.Dispatch<React.SetStateAction<Position[]>>;
}

// Loads server configuration on mount, completes the Upstox OAuth hand-off and keeps
// the API config in sync every few seconds.
export const useAppBootstrap = ({
  setMode,
  setBotConfig,
  setApiConfig,
  setTradeHistory,
}: UseAppBootstrapParams) => {
  useEffect(() => {
    let isMounted = true;
    const initCtrl = new AbortController();
    const fetchInitData = async () => {
      try {
        // Check if Upstox OAuth redirected back to root URL with ?code=...
        const urlParams = new URLSearchParams(window.location.search);
        const oauthCode = urlParams.get('code');
        if (oauthCode) {
          try {
            const cleanRedirectUri = window.location.origin;
            const tokenRes = await fetch('/api/market/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: initCtrl.signal,
              body: JSON.stringify({
                code: oauthCode,
                redirectUri: cleanRedirectUri,
              }),
            });
            const tokenData = await tokenRes.json();
            if (tokenData.accessToken) {
              safeStorage.setItem('upstox_daily_token', tokenData.accessToken);
              safeStorage.setItem('upstox_token_date', new Date().toLocaleDateString('en-IN'));
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch {
            // Silently ignored
          }
        }

        if (!isMounted) return;
        const savedDailyToken = safeStorage.getItem('upstox_daily_token') || '';

        const headers: Record<string, string> = {};
        if (savedDailyToken) {
          headers['Authorization'] = `Bearer ${savedDailyToken}`;
        }

        const [botRes, configRes, historyRes] = await Promise.allSettled([
          fetch('/api/bot/config', { signal: initCtrl.signal }).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch('/api/market/config', { headers, signal: initCtrl.signal }).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch('/api/history', { signal: initCtrl.signal }).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (!isMounted) return;
        let serverUserExplicitMode = false;
        let hasPreferredMode = false;

        if (botRes.status === 'fulfilled' && botRes.value) {
          serverUserExplicitMode = Boolean(botRes.value.userExplicitlySelectedMode);
          const savedModeIsValid = (v: string | null): v is ExecutionMode => {
            return v === 'PAPER_TRADING' || v === 'UPSTOX_LIVE';
          };
          let preferredMode: ExecutionMode | null = null;
          const saved = safeStorage.getItem('aizabiz_preferred_trading_mode');
          if (saved === 'PAPER_TRADING' || savedModeIsValid(saved)) {
            preferredMode = saved as ExecutionMode;
            hasPreferredMode = true;
          }
          const finalMode: ExecutionMode =
            preferredMode ||
            (botRes.value.mode === 'PAPER_TRADING' || botRes.value.mode === 'UPSTOX_LIVE'
              ? botRes.value.mode
              : 'PAPER_TRADING');
          setMode(finalMode);
          setBotConfig((prev) => ({ ...prev, ...botRes.value, mode: finalMode }));
          if (preferredMode && botRes.value.mode !== preferredMode) {
            fetch('/api/bot/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...botRes.value, mode: preferredMode }),
            }).catch(() => {
              /* ignore */
            });
          }
        }
        if (configRes.status === 'fulfilled' && configRes.value) {
          const cfg = configRes.value;
          // Only clear savedDailyToken if user explicitly cleared it or JWT exp timestamp has passed
          let isJwtExpired = false;
          if (savedDailyToken) {
            try {
              const parts = savedDailyToken.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload?.exp && Date.now() / 1000 > payload.exp + 60) {
                  isJwtExpired = true;
                }
              }
            } catch {
              // Ignored
            }
          }
          if (cfg.tokenExpired && isJwtExpired) {
            safeStorage.removeItem('upstox_daily_token');
            cfg.accessToken = '';
          } else if (cfg.accessToken) {
            safeStorage.setItem('upstox_daily_token', cfg.accessToken);
            cfg.isConnected = true;
          } else if (savedDailyToken && !isJwtExpired && !cfg.accessToken) {
            cfg.accessToken = savedDailyToken;
            cfg.isConnected = true;
          }
          setApiConfig((prev) => ({
            ...prev,
            ...cfg,
            isConnected: Boolean(cfg.accessToken || cfg.isConnected),
          }));
          if (cfg.accessToken && !serverUserExplicitMode && !hasPreferredMode) {
            setMode('UPSTOX_LIVE');
          }
        }
        if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)) {
          const parsedInitHistory = historyRes.value.map((t: any) => ({
            ...t,
            mode: t.mode || 'PAPER_TRADING',
          }));
          setTradeHistory(parsedInitHistory);
          if (parsedInitHistory.length === 0) {
            safeStorage.removeItem('aizabiz_persisted_trade_history_v2');
            safeStorage.removeItem('aizabiz_persisted_trade_history_v3');
          }
        }
      } catch (err) {
        console.warn('Initial data fetch notice:', err);
      }
    };
    fetchInitData();

    let inFlightConfigSync = false;
    let activeSyncCtrl: AbortController | null = null;
    const configSyncInterval = setInterval(async () => {
      if (!isMounted || inFlightConfigSync) return;
      inFlightConfigSync = true;
      const ctrl = new AbortController();
      activeSyncCtrl = ctrl;
      const timeoutId = setTimeout(() => ctrl.abort(), 5000);
      try {
        const syncToken = safeStorage.getItem('upstox_daily_token') || '';
        const syncHeaders: Record<string, string> = {};
        if (syncToken) syncHeaders['Authorization'] = `Bearer ${syncToken}`;

        const res = await fetch('/api/market/config', {
          headers: syncHeaders,
          signal: ctrl.signal,
        });
        if (res.ok && isMounted) {
          const cfg = await res.json();
          if (cfg && typeof cfg.isConnected === 'boolean') {
            if (cfg.isConnected && cfg.accessToken) {
              safeStorage.setItem('upstox_daily_token', cfg.accessToken);
            }
            setApiConfig((prev) => {
              const nextAccessToken = cfg.accessToken || (cfg.tokenExpired ? '' : prev.accessToken);
              const nextAvailableMargin = Number(cfg.availableMargin ?? prev.availableMargin);
              const nextSettledCash =
                cfg.settledCash !== undefined ? Number(cfg.settledCash) : prev.settledCash;
              const nextDeliverySellCredit =
                cfg.deliverySellCredit !== undefined
                  ? Number(cfg.deliverySellCredit)
                  : prev.deliverySellCredit;
              const nextUsedMargin = Number(cfg.usedMargin ?? prev.usedMargin);
              const nextUtilizedMargin = Number(cfg.utilizedMargin ?? prev.utilizedMargin);
              const nextPayin = Number(cfg.payin ?? prev.payin);
              const nextPayout = Number(cfg.payout ?? prev.payout);
              const nextTotalBalance = Number(cfg.totalBalance ?? prev.totalBalance);
              const nextHoldingsCount =
                typeof cfg.holdingsCount === 'number' ? cfg.holdingsCount : prev.holdingsCount;
              const nextUserName = cfg.userName || prev.userName;
              const nextUserClientCode = cfg.userClientCode || prev.userClientCode;
              const nextTokenGeneratedAt = cfg.tokenGeneratedAt || prev.tokenGeneratedAt;
              const nextTokenExpiresAt = cfg.tokenExpiresAt || prev.tokenExpiresAt;
              const nextRedirectUri = cfg.redirectUri || prev.redirectUri;
              const nextServerOutboundIp = cfg.serverOutboundIp || prev.serverOutboundIp;
              const nextServerSecondaryIp = cfg.serverSecondaryIp || prev.serverSecondaryIp;
              const nextActualDetectedIp = cfg.actualDetectedIp || prev.actualDetectedIp;
              const nextIsFixedProxyActive =
                typeof cfg.isFixedProxyActive === 'boolean'
                  ? cfg.isFixedProxyActive
                  : prev.isFixedProxyActive;
              const nextProxyError = cfg.proxyError ?? prev.proxyError;

              if (
                prev.isConnected === cfg.isConnected &&
                prev.accessToken === nextAccessToken &&
                prev.availableMargin === nextAvailableMargin &&
                prev.settledCash === nextSettledCash &&
                prev.deliverySellCredit === nextDeliverySellCredit &&
                prev.usedMargin === nextUsedMargin &&
                prev.utilizedMargin === nextUtilizedMargin &&
                prev.payin === nextPayin &&
                prev.payout === nextPayout &&
                prev.totalBalance === nextTotalBalance &&
                prev.holdingsCount === nextHoldingsCount &&
                prev.userName === nextUserName &&
                prev.userClientCode === nextUserClientCode &&
                prev.tokenGeneratedAt === nextTokenGeneratedAt &&
                prev.tokenExpiresAt === nextTokenExpiresAt &&
                prev.redirectUri === nextRedirectUri &&
                prev.serverOutboundIp === nextServerOutboundIp &&
                prev.serverSecondaryIp === nextServerSecondaryIp &&
                prev.actualDetectedIp === nextActualDetectedIp &&
                prev.isFixedProxyActive === nextIsFixedProxyActive &&
                prev.proxyError === nextProxyError
              ) {
                return prev;
              }

              return {
                ...prev,
                isConnected: cfg.isConnected,
                accessToken: nextAccessToken,
                availableMargin: nextAvailableMargin,
                settledCash: nextSettledCash,
                deliverySellCredit: nextDeliverySellCredit,
                usedMargin: nextUsedMargin,
                utilizedMargin: nextUtilizedMargin,
                payin: nextPayin,
                payout: nextPayout,
                totalBalance: nextTotalBalance,
                holdingsCount: nextHoldingsCount,
                userName: nextUserName,
                userClientCode: nextUserClientCode,
                tokenGeneratedAt: nextTokenGeneratedAt,
                tokenExpiresAt: nextTokenExpiresAt,
                redirectUri: nextRedirectUri,
                serverOutboundIp: nextServerOutboundIp,
                serverSecondaryIp: nextServerSecondaryIp,
                actualDetectedIp: nextActualDetectedIp,
                isFixedProxyActive: nextIsFixedProxyActive,
                proxyError: nextProxyError,
              };
            });
          }
        }
      } catch {
        // Ignored
      } finally {
        clearTimeout(timeoutId);
        if (activeSyncCtrl === ctrl) activeSyncCtrl = null;
        inFlightConfigSync = false;
      }
    }, 6000);
    return () => {
      isMounted = false;
      initCtrl.abort();
      activeSyncCtrl?.abort();
      clearInterval(configSyncInterval);
    };
  }, [setMode, setBotConfig, setApiConfig, setTradeHistory]);
};
