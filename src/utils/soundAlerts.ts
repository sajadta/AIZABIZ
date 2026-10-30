// Institutional Web Audio Synthesizer & Visual Lighting Alert Engine
// Zero-dependency audio generator for Trade Entry, Loss, Medium Profit, High Profit,
// +50% Buy-Price Jackpot Milestone, Holding Profit, and Daily Market Session Start/End bells.

export type AlertCategory =
  | 'TRADE_ENTRY'
  | 'LOSS_ALERT'
  | 'PROFIT_MEDIUM'
  | 'PROFIT_HIGH'
  | 'PROFIT_50_PERCENT_JACKPOT'
  | 'HOLDING_PROFIT'
  | 'SESSION_START'
  | 'SESSION_END';

export interface VisualLightAlert {
  id: string;
  category: AlertCategory;
  titleMl: string;
  titleEn: string;
  subtitleMl: string;
  subtitleEn: string;
  timestamp: string;
  colorTheme: 'cyan' | 'rose' | 'emerald' | 'amber' | 'gold_jackpot' | 'indigo';
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playToneNote(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  peakGain = 0.22
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffsetSec);

  gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffsetSec);
  gain.gain.exponentialRampToValueAtTime(peakGain, ctx.currentTime + startOffsetSec + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + startOffsetSec + durationSec
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + startOffsetSec);
  osc.stop(ctx.currentTime + startOffsetSec + durationSec + 0.02);
}

export function playTradingAlertSound(category: AlertCategory, enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    switch (category) {
      case 'TRADE_ENTRY': {
        // Crisp 3-step institutional execution chime (D5 -> F#5 -> A5)
        playToneNote(ctx, 587.33, 0.0, 0.14, 'triangle', 0.24);
        playToneNote(ctx, 739.99, 0.12, 0.14, 'triangle', 0.24);
        playToneNote(ctx, 880.0, 0.24, 0.28, 'sine', 0.28);
        break;
      }

      case 'LOSS_ALERT': {
        // Urgent descending 3-tone stop-loss / drawdown warning siren
        playToneNote(ctx, 440.0, 0.0, 0.18, 'sawtooth', 0.22);
        playToneNote(ctx, 349.23, 0.18, 0.18, 'sawtooth', 0.24);
        playToneNote(ctx, 261.63, 0.36, 0.35, 'triangle', 0.28);
        break;
      }

      case 'PROFIT_MEDIUM': {
        // Pleasant ascending Major Triad profit chime (C5 -> E5 -> G5)
        playToneNote(ctx, 523.25, 0.0, 0.14, 'sine', 0.22);
        playToneNote(ctx, 659.25, 0.12, 0.14, 'sine', 0.24);
        playToneNote(ctx, 783.99, 0.24, 0.30, 'triangle', 0.26);
        break;
      }

      case 'PROFIT_HIGH': {
        // Radiant 4-note high-profit fanfare (C5 -> E5 -> G5 -> C6)
        playToneNote(ctx, 523.25, 0.0, 0.12, 'triangle', 0.24);
        playToneNote(ctx, 659.25, 0.11, 0.12, 'triangle', 0.25);
        playToneNote(ctx, 783.99, 0.22, 0.14, 'triangle', 0.26);
        playToneNote(ctx, 1046.5, 0.35, 0.42, 'sine', 0.30);
        break;
      }

      case 'PROFIT_50_PERCENT_JACKPOT': {
        // Special 6-Note Golden Jackpot Symphony for +50% Buy-Price Profit Milestone!
        playToneNote(ctx, 523.25, 0.0, 0.11, 'triangle', 0.26); // C5
        playToneNote(ctx, 659.25, 0.10, 0.11, 'triangle', 0.26); // E5
        playToneNote(ctx, 783.99, 0.20, 0.11, 'triangle', 0.28); // G5
        playToneNote(ctx, 1046.5, 0.30, 0.14, 'sine', 0.30); // C6
        playToneNote(ctx, 1318.5, 0.43, 0.16, 'sine', 0.30); // E6
        playToneNote(ctx, 1567.98, 0.58, 0.55, 'triangle', 0.34); // G6
        break;
      }

      case 'HOLDING_PROFIT': {
        // Crystal bell chime when Holdings are in profit (E5 -> B5 -> E6)
        playToneNote(ctx, 659.25, 0.0, 0.15, 'sine', 0.20);
        playToneNote(ctx, 987.77, 0.14, 0.18, 'sine', 0.22);
        playToneNote(ctx, 1318.5, 0.30, 0.35, 'triangle', 0.25);
        break;
      }

      case 'SESSION_START': {
        // Exchange Opening Bell (Rich resonant brass bell chord)
        playToneNote(ctx, 587.33, 0.0, 0.25, 'triangle', 0.26);
        playToneNote(ctx, 880.0, 0.0, 0.25, 'sine', 0.20);
        playToneNote(ctx, 587.33, 0.28, 0.25, 'triangle', 0.26);
        playToneNote(ctx, 1174.66, 0.56, 0.55, 'sine', 0.30);
        break;
      }

      case 'SESSION_END': {
        // Exchange Closing Bell (Resonant descending bell cadence)
        playToneNote(ctx, 880.0, 0.0, 0.22, 'triangle', 0.25);
        playToneNote(ctx, 659.25, 0.24, 0.22, 'triangle', 0.25);
        playToneNote(ctx, 440.0, 0.48, 0.50, 'sine', 0.28);
        break;
      }
    }
  } catch (e) {
    // Ignore audio context autoplay errors until user interacts
  }
}

export interface MarketSessionStatus {
  istTimeStr: string;
  istTimeFormatted?: string;
  phase?: string;
  labelMl?: string;
  labelEn?: string;
  isTradingDay: boolean;
  isMarketOpen: boolean; // 09:15 AM - 03:30 PM IST
  isAlgoEntryWindowOpen: boolean; // 09:18 AM - 02:45 PM IST
  phaseCode:
    | 'PRE_MARKET'
    | 'OPENING_SETTLE_915_918'
    | 'ALGO_ACTIVE_918_1445'
    | 'LATE_SESSION_HOLD_ONLY_1445_1515'
    | 'EOD_SQUAREOFF_1515_1530'
    | 'POST_MARKET_CLOSED'
    | 'WEEKEND_CLOSED';
  phaseLabelMl: string;
  phaseLabelEn: string;
  countdownLabelMl: string;
  countdownLabelEn: string;
  sessionProgressPct: number; // 0 to 100 across 09:15 AM - 03:30 PM (375 mins)
}

export function getLiveIstMarketSessionStatus(): MarketSessionStatus {
  const now = new Date();
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);

  const day = istDate.getDay(); // 0 = Sun, 6 = Sat
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const seconds = istDate.getSeconds();
  const totalMinutes = hours * 60 + minutes;
  const totalSeconds = totalMinutes * 60 + seconds;

  const marketOpenMin = 9 * 60 + 15; // 555 (09:15 AM)
  const algoStartMin = 9 * 60 + 18; // 558 (09:18 AM)
  const algoCutoffMin = 15 * 60 + 8; // 908 (03:08 PM) - Allows high-momentum 1m/3m scalping until 03:08 PM
  const squareOffMin = 15 * 60 + 14; // 914 (03:14 PM) - Safely exits before Upstox 03:15 broker auto-squareoff!
  const marketCloseMin = 15 * 60 + 30; // 930 (03:30 PM)

  const istTimeStr = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const isTradingDay = day >= 1 && day <= 5;
  const isMarketOpen =
    isTradingDay && totalMinutes >= marketOpenMin && totalMinutes < marketCloseMin;
  const isAlgoEntryWindowOpen =
    isTradingDay && totalMinutes >= algoStartMin && totalMinutes <= algoCutoffMin;

  const formatDuration = (secDiff: number) => {
    const s = Math.max(0, Math.floor(secDiff));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
    return `${mm}m ${ss}s`;
  };

  if (!isTradingDay) {
    return {
      istTimeStr,
      isTradingDay: false,
      isMarketOpen: false,
      isAlgoEntryWindowOpen: false,
      phaseCode: 'WEEKEND_CLOSED',
      phaseLabelMl: '🔴 വാരാന്ത്യ അവധി (Market Closed - Weekend)',
      phaseLabelEn: '🔴 Weekend Market Closed (Opens Monday 09:15 AM IST)',
      countdownLabelMl: 'തിങ്കളാഴ്ച രാവിലെ 09:15 AM-ന് മാർക്കറ്റ് തുറക്കും',
      countdownLabelEn: 'Opens Monday 09:15 AM IST',
      sessionProgressPct: 100,
    };
  }

  if (totalMinutes < marketOpenMin) {
    const secUntilOpen = marketOpenMin * 60 - totalSeconds;
    const dur = formatDuration(secUntilOpen);
    return {
      istTimeStr,
      isTradingDay: true,
      isMarketOpen: false,
      isAlgoEntryWindowOpen: false,
      phaseCode: 'PRE_MARKET',
      phaseLabelMl: '🟡 പ്രീ-മാർക്കറ്റ് (09:15 AM-ന് ട്രേഡിംഗ് തുടങ്ങും)',
      phaseLabelEn: '🟡 Pre-Market (Trading Starts at 09:15 AM IST)',
      countdownLabelMl: `മാർക്കറ്റ് തുടങ്ങാൻ: ${dur} ബാക്കി`,
      countdownLabelEn: `Market Opens in: ${dur}`,
      sessionProgressPct: 0,
    };
  }

  const sessionProgressPct = Math.min(
    100,
    Math.max(
      0,
      Number((((totalMinutes - marketOpenMin) / (marketCloseMin - marketOpenMin)) * 100).toFixed(1))
    )
  );

  if (totalMinutes < algoStartMin) {
    const secUntilAlgo = algoStartMin * 60 - totalSeconds;
    const dur = formatDuration(secUntilAlgo);
    return {
      istTimeStr,
      isTradingDay: true,
      isMarketOpen: true,
      isAlgoEntryWindowOpen: false,
      phaseCode: 'OPENING_SETTLE_915_918',
      phaseLabelMl: '🟢 മാർക്കറ്റ് തുറന്നു! (09:18 AM-ന് അൽഗോ എൻട്രി തുടങ്ങും)',
      phaseLabelEn: '🟢 Market Open! (Algo Entry Starts at 09:18 AM IST)',
      countdownLabelMl: `അൽഗോ എൻട്രി തുടങ്ങാൻ: ${dur}`,
      countdownLabelEn: `Algo Window in: ${dur}`,
      sessionProgressPct,
    };
  }

  if (totalMinutes <= algoCutoffMin) {
    const secUntilCutoff = algoCutoffMin * 60 + 59 - totalSeconds;
    const secUntilClose = marketCloseMin * 60 - totalSeconds;
    return {
      istTimeStr,
      isTradingDay: true,
      isMarketOpen: true,
      isAlgoEntryWindowOpen: true,
      phaseCode: 'ALGO_ACTIVE_918_1445',
      phaseLabelMl: '🟢 ലൈവ് ട്രേഡിംഗ് & അൽഗോ എൻട്രി സജീവം (09:18 AM – 03:08 PM)',
      phaseLabelEn: '🟢 Market & Algo Entry Window ACTIVE (09:18 AM – 03:08 PM)',
      countdownLabelMl: `എൻട്രി വിൻഡോ: ${formatDuration(secUntilCutoff)} | ക്ലോസിംഗ്: ${formatDuration(secUntilClose)}`,
      countdownLabelEn: `Entry Cutoff in ${formatDuration(secUntilCutoff)} | Close in ${formatDuration(secUntilClose)}`,
      sessionProgressPct,
    };
  }

  if (totalMinutes < squareOffMin) {
    const secUntilSqOff = squareOffMin * 60 - totalSeconds;
    return {
      istTimeStr,
      isTradingDay: true,
      isMarketOpen: true,
      isAlgoEntryWindowOpen: false,
      phaseCode: 'LATE_SESSION_HOLD_ONLY_1445_1515',
      phaseLabelMl: '🟠 പുതിയ എൻട്രി അവസാനിച്ചു (03:08 PM) — ഓപ്പൺ ട്രേഡുകൾ പ്രോഫിറ്റ് ലോക്ക് ചെയ്യുന്നു',
      phaseLabelEn: '🟠 New Entry Cutoff Passed (03:08 PM) — Trailing Open Positions',
      countdownLabelMl: `സുരക്ഷിത സ്ക്വയർ-ഓഫ് (03:14 PM): ${formatDuration(secUntilSqOff)} ബാക്കി`,
      countdownLabelEn: `Safe Square-Off (03:14 PM) in: ${formatDuration(secUntilSqOff)}`,
      sessionProgressPct,
    };
  }

  if (totalMinutes < marketCloseMin) {
    const secUntilClose = marketCloseMin * 60 - totalSeconds;
    return {
      istTimeStr,
      isTradingDay: true,
      isMarketOpen: true,
      isAlgoEntryWindowOpen: false,
      phaseCode: 'EOD_SQUAREOFF_1515_1530',
      phaseLabelMl: '🟠 ഇൻട്രാഡേ ക്ലോസിംഗ് സമയം (03:15 PM – 03:30 PM IST)',
      phaseLabelEn: '🟠 Intraday Closing Window (03:15 PM – 03:30 PM IST)',
      countdownLabelMl: `മാർക്കറ്റ് അവസാനിക്കാൻ: ${formatDuration(secUntilClose)} ബാക്കി`,
      countdownLabelEn: `Market Closes in: ${formatDuration(secUntilClose)}`,
      sessionProgressPct,
    };
  }

  // Post-market after 03:30 PM IST
  const secUntilTomorrowOpen = (24 * 60 - totalMinutes + marketOpenMin) * 60 - seconds;
  return {
    istTimeStr,
    isTradingDay: true,
    isMarketOpen: false,
    isAlgoEntryWindowOpen: false,
    phaseCode: 'POST_MARKET_CLOSED',
    phaseLabelMl: '🔴 ഇന്നത്തെ ട്രേഡിംഗ് സമയം അവസാനിച്ചു (09:15 AM – 03:30 PM IST)',
    phaseLabelEn: '🔴 Today’s Trading Session Ended (09:15 AM – 03:30 PM IST)',
    countdownLabelMl: `അടുത്ത ട്രേഡിംഗ് തുടങ്ങാൻ: ${formatDuration(secUntilTomorrowOpen)} (09:15 AM IST)`,
    countdownLabelEn: `Next Session Opens in: ${formatDuration(secUntilTomorrowOpen)} (09:15 AM IST)`,
    sessionProgressPct: 100,
  };
}

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
