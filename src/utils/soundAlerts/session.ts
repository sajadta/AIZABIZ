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
  const algoCutoffMin = 15 * 60 + 15; // 915 (03:15 PM) - Allows high-momentum scalping & big profit moves until 03:15 PM
  const squareOffMin = 15 * 60 + 25; // 925 (03:25 PM) - Safely exits before 03:30 PM market close!
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
      phaseLabelMl: '🟢 ലൈവ് ട്രേഡിംഗ് & അൽഗോ എൻട്രി സജീവം (09:18 AM – 03:15 PM)',
      phaseLabelEn: '🟢 Market & Algo Entry Window ACTIVE (09:18 AM – 03:15 PM)',
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
      phaseLabelMl: '🟠 പുതിയ എൻട്രി അവസാനിച്ചു (03:15 PM) — ഓപ്പൺ ട്രേഡുകൾ പ്രോഫിറ്റ് ലോക്ക് ചെയ്യുന്നു',
      phaseLabelEn: '🟠 New Entry Cutoff Passed (03:15 PM) — Trailing Open Positions',
      countdownLabelMl: `സുരക്ഷിത സ്ക്വയർ-ഓഫ് (03:25 PM): ${formatDuration(secUntilSqOff)} ബാക്കി`,
      countdownLabelEn: `Safe Square-Off (03:25 PM) in: ${formatDuration(secUntilSqOff)}`,
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

