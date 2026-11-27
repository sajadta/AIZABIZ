// One-second IST market session clock plus the opening/closing bell alerts.
import { useEffect, useRef, useState } from 'react';
import {
  triggerAlertEvent,
  getIstMarketSessionStatus,
  type LightingAlertBannerState,
  type MarketSessionStatus,
} from '../utils/soundAlerts';

interface UseMarketSessionClockParams {
  soundEnabled: boolean;
  setLightingBanner: (banner: LightingAlertBannerState) => void;
}

export function useMarketSessionClock({
  soundEnabled,
  setLightingBanner,
}: UseMarketSessionClockParams): MarketSessionStatus {
  const [marketSession, setMarketSession] = useState<MarketSessionStatus>(() =>
    getIstMarketSessionStatus(),
  );
  const prevMarketPhaseRef = useRef<string>(marketSession.phase ?? '');

  useEffect(() => {
    const timer = setInterval(() => {
      const nextSession = getIstMarketSessionStatus();
      setMarketSession(nextSession);

      if (prevMarketPhaseRef.current !== nextSession.phase) {
        if (nextSession.phase === 'LIVE_TRADING' || nextSession.phase === 'OPENING_VOLATILITY') {
          const banner = triggerAlertEvent(
            'MARKET_OPEN_BELL',
            'NSE / BSE',
            '🔔 മാർക്കറ്റ് ട്രേഡിങ് ആരംഭിച്ചു (09:15 AM IST)!',
            'അൽഗോരിതം 09:18 AM മുതൽ തത്സമയ ബ്രേക്ക്ഔട്ട് ട്രേഡുകൾ എടുത്തു തുടങ്ങും.',
            !soundEnabled,
          );
          if (banner) setLightingBanner(banner);
        } else if (nextSession.phase === 'CLOSED_POST_MARKET') {
          const banner = triggerAlertEvent(
            'MARKET_CLOSE_BELL',
            'NSE / BSE',
            '🏁 ഇന്നത്തെ മാർക്കറ്റ് ട്രേഡിങ് അവസാനിച്ചു (03:30 PM IST)!',
            'ഇന്നത്തെ ട്രേഡിങ് സമയം പൂർത്തിയായി. അടുത്ത ട്രേഡിങ് സെഷൻ രാവിലെ 09:15 AM-ന് ആരംഭിക്കും.',
            !soundEnabled,
          );
          if (banner) setLightingBanner(banner);
        }
        prevMarketPhaseRef.current = nextSession.phase;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [soundEnabled, setLightingBanner]);

  return marketSession;
}
