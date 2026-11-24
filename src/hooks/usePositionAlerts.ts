// Multi-tier audio/visual alerts for open positions and holdings.
import { useEffect, useRef } from 'react';
import type { Holding, Position } from '../types';
import { triggerAlertEvent, type LightingAlertBannerState } from '../utils/soundAlerts';

interface UsePositionAlertsParams {
  positions: Position[];
  holdings: Holding[];
  soundEnabled: boolean;
  setLightingBanner: (banner: LightingAlertBannerState) => void;
}

export function usePositionAlerts({
  positions,
  holdings,
  soundEnabled,
  setLightingBanner,
}: UsePositionAlertsParams) {
  const prevPositionsRef = useRef<Record<string, { pnl: number; is50Hit: boolean; tier: number }>>({});
  const prevHoldingsRef = useRef<Record<string, { pnl: number; is50Hit: boolean }>>({});

  useEffect(() => {
    // Check Open Positions for New Entry, Loss, Medium Profit, High Profit, and +50% Buy-Price Jackpot
    positions.forEach((pos) => {
      const key = pos.id || pos.symbol;
      const buyPx = Number(pos.buyPrice || 0);
      const curPx = Number(pos.currentLTP || buyPx);
      const pnl = Number(pos.pnl || 0);
      const is50Hit = buyPx > 0 && curPx >= buyPx * 1.5;
      const prev = prevPositionsRef.current[key];

      let currentTier = 0;
      if (is50Hit) currentTier = 4;
      else if (pnl >= 1000) currentTier = 3;
      else if (pnl >= 300) currentTier = 2;
      else if (pnl <= -250) currentTier = -1;

      if (!prev) {
        const banner = triggerAlertEvent(
          'TRADE_ENTRY',
          pos.symbol,
          `⚡ പുതിയ ട്രേഡ് എടുത്തു: ${pos.symbol}`,
          `Buy Price: ₹${buyPx.toFixed(2)} | Qty: ${pos.quantity} — അൽഗോരിതം Peak-Locked Stop-Loss നിരീക്ഷിക്കുന്നു.`,
          !soundEnabled,
          pnl,
        );
        if (banner) setLightingBanner(banner);
      } else {
        if (is50Hit && !prev.is50Hit) {
          const banner = triggerAlertEvent(
            'FIFTY_PERCENT_JACKPOT',
            pos.symbol,
            `🏆 +50% ജാക്ക്പോട്ട് ലാഭം! ${pos.symbol}`,
            `വാങ്ങിയ വിലയുടെ (₹${buyPx.toFixed(2)}) 50% ലാഭ ലക്ഷ്യം (₹${curPx.toFixed(2)}) മറികടന്നു! ലാഭം: +₹${pnl.toFixed(2)}`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (currentTier === 3 && prev.tier < 3) {
          const banner = triggerAlertEvent(
            'PROFIT_HIGH',
            pos.symbol,
            `🚀 ഉയർന്ന ലാഭം (+₹${pnl.toFixed(0)}): ${pos.symbol}`,
            `LTP ₹${curPx.toFixed(2)}-ലേക്ക് കുതിച്ചു! Auto-Moving Peak Stop-Loss ലാഭം സുരക്ഷിതമായി ലോക്ക് ചെയ്തു.`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (currentTier === 2 && prev.tier < 2) {
          const banner = triggerAlertEvent(
            'PROFIT_MEDIUM',
            pos.symbol,
            `🟢 മികച്ച ലാഭത്തിലേക്ക് (+₹${pnl.toFixed(0)}): ${pos.symbol}`,
            `ട്രേഡ് നല്ല ലാഭത്തിലാണ് (LTP: ₹${curPx.toFixed(2)}). Zero-Loss ബ്രേക്ക്-ഈവൻ സംരക്ഷണം ആക്ടീവ് ആയി.`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (currentTier === -1 && prev.tier > -1) {
          const banner = triggerAlertEvent(
            'TRADE_LOSS_WARNING',
            pos.symbol,
            `⚠️ സ്റ്റോപ്പ്-ലോസ് / നഷ്ട മുന്നറിയിപ്പ് (${pos.symbol})`,
            `നിലവിലെ P&L: ₹${pnl.toFixed(2)}. അൽഗോരിതം ₹400 Max SL Cap & 1m സപ്പോർട്ട് പരിശോധിക്കുന്നു.`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        }
      }

      prevPositionsRef.current[key] = { pnl, is50Hit, tier: currentTier };
    });

    // Check Holdings for Profit Turn & +50% Buy-Price Milestone
    holdings.forEach((h) => {
      const key = h.symbol;
      const buyPx = Number(h.buyPrice ?? h.avgPrice ?? 0);
      const curPx = Number(h.currentLTP || 0);
      const pnl = Number(h.pnl || 0);
      const is50Hit = Boolean(
        h.fiftyPercentTarget?.isReached || (buyPx > 0 && curPx >= buyPx * 1.5),
      );
      const prev = prevHoldingsRef.current[key];

      if (prev) {
        if (is50Hit && !prev.is50Hit) {
          const banner = triggerAlertEvent(
            'FIFTY_PERCENT_JACKPOT',
            h.symbol,
            `⚡ ഹോൾഡിങ്ങ് +50% ലാഭ ലക്ഷ്യം മറികടന്നു: ${h.symbol}!`,
            `വാങ്ങിയ വില ₹${buyPx.toFixed(2)} -> ഇപ്പോൾ ₹${curPx.toFixed(2)} (+₹${pnl.toFixed(2)} ലാഭം)!`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (pnl > 0 && prev.pnl <= 0) {
          const banner = triggerAlertEvent(
            'HOLDING_IN_PROFIT',
            h.symbol,
            `💎 ഹോൾഡിങ്ങ് ലാഭത്തിലായി: ${h.symbol}`,
            `LTP ₹${curPx.toFixed(2)} — നിലവിലെ ലാഭം: +₹${pnl.toFixed(2)} (${h.pnlPercent?.toFixed(2)}%)`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        }
      }
      prevHoldingsRef.current[key] = { pnl, is50Hit };
    });
  }, [positions, holdings, soundEnabled, setLightingBanner]);
}
