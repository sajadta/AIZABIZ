import { playTradingAlertSound, type AlertCategory } from './audio';
import { getLiveIstMarketSessionStatus } from './session';

export interface LightingAlertBannerState {
  id: string;
  active: boolean;
  type: string;
  symbol: string;
  titleMl: string;
  subtitleMl: string;
  colorTheme: 'GOLD_JACKPOT' | 'EMERALD_HIGH' | 'ROSE_LOSS' | 'CYAN_ENTRY';
  pnl?: number;
}

export function getIstMarketSessionStatus() {
  const s = getLiveIstMarketSessionStatus();
  const phaseMap: Record<string, string> = {
    PRE_MARKET: 'PRE_MARKET',
    OPENING_SETTLE_915_918: 'OPENING_VOLATILITY',
    ALGO_ACTIVE_918_1445: 'LIVE_TRADING',
    LATE_SESSION_HOLD_ONLY_1445_1515: 'LATE_AFTERNOON_CUTOFF',
    EOD_SQUAREOFF_1515_1530: 'LATE_AFTERNOON_CUTOFF',
    POST_MARKET_CLOSED: 'CLOSED_POST_MARKET',
    WEEKEND_CLOSED: 'CLOSED_WEEKEND',
  };
  return {
    ...s,
    phase: phaseMap[s.phaseCode] || s.phaseCode,
    istTimeFormatted: s.istTimeStr,
    labelMl: s.phaseLabelMl,
    labelEn: s.phaseLabelEn,
  };
}

export function triggerAlertEvent(
  eventType:
    | 'TRADE_ENTRY'
    | 'TRADE_LOSS_WARNING'
    | 'PROFIT_MEDIUM'
    | 'PROFIT_HIGH'
    | 'FIFTY_PERCENT_JACKPOT'
    | 'HOLDING_IN_PROFIT'
    | 'MARKET_OPEN_BELL'
    | 'MARKET_CLOSE_BELL',
  symbol: string,
  titleMl: string,
  subtitleMl: string,
  muted = false,
  pnl?: number
): LightingAlertBannerState {
  const categoryMap: Record<string, AlertCategory> = {
    TRADE_ENTRY: 'TRADE_ENTRY',
    TRADE_LOSS_WARNING: 'LOSS_ALERT',
    PROFIT_MEDIUM: 'PROFIT_MEDIUM',
    PROFIT_HIGH: 'PROFIT_HIGH',
    FIFTY_PERCENT_JACKPOT: 'PROFIT_50_PERCENT_JACKPOT',
    HOLDING_IN_PROFIT: 'HOLDING_PROFIT',
    MARKET_OPEN_BELL: 'SESSION_START',
    MARKET_CLOSE_BELL: 'SESSION_END',
  };
  playTradingAlertSound(categoryMap[eventType] || 'TRADE_ENTRY', !muted);

  let colorTheme: 'GOLD_JACKPOT' | 'EMERALD_HIGH' | 'ROSE_LOSS' | 'CYAN_ENTRY' = 'CYAN_ENTRY';
  if (eventType === 'FIFTY_PERCENT_JACKPOT') colorTheme = 'GOLD_JACKPOT';
  else if (
    eventType === 'PROFIT_HIGH' ||
    eventType === 'PROFIT_MEDIUM' ||
    eventType === 'HOLDING_IN_PROFIT' ||
    eventType === 'MARKET_OPEN_BELL'
  ) {
    colorTheme = 'EMERALD_HIGH';
  } else if (eventType === 'TRADE_LOSS_WARNING') {
    colorTheme = 'ROSE_LOSS';
  }

  return {
    id: `${eventType}_${Date.now()}`,
    active: true,
    type: eventType,
    symbol,
    titleMl,
    subtitleMl,
    colorTheme,
    pnl,
  };
}
