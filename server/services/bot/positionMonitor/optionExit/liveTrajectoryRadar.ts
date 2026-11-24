// Live trajectory radar shown in the UI: current moment state, labels and locked levels.

export type NextMomentState =
  'ACCELERATING_UP' | 'FAKE_DIP_HOLD' | 'PEAK_EXHAUSTION' | 'REVERSING_EXIT';

export interface LiveTrajectoryRadarParams {
  shouldSell: boolean;
  ltp: number;
  dynamicStopLossPrice: number;
  staticStopLossPrice: number;
  dynamicTargetPrice: number;
  protectedNetFloor: number;
  isUnderlyingParametersReversing: boolean;
  isOption1mTrendIntact: boolean;
  isPeakInflectionAlert: boolean;
  hasReachedForecastTarget: boolean;
  posPnL: number;
}

export function buildLiveTrajectoryRadar(p: LiveTrajectoryRadarParams) {
  const {
    shouldSell,
    ltp,
    dynamicStopLossPrice,
    staticStopLossPrice,
    dynamicTargetPrice,
    protectedNetFloor,
    isUnderlyingParametersReversing,
    isOption1mTrendIntact,
    isPeakInflectionAlert,
    hasReachedForecastTarget,
    posPnL,
  } = p;

  const nextMomentState: NextMomentState =
    shouldSell ||
    ltp <= dynamicStopLossPrice ||
    ltp <= staticStopLossPrice ||
    (isUnderlyingParametersReversing && !isOption1mTrendIntact)
      ? 'REVERSING_EXIT'
      : isPeakInflectionAlert || hasReachedForecastTarget
        ? 'PEAK_EXHAUSTION'
        : posPnL >= 0 && isOption1mTrendIntact
          ? 'ACCELERATING_UP'
          : 'FAKE_DIP_HOLD';

  const sl = dynamicStopLossPrice.toFixed(2);
  const slShort = dynamicStopLossPrice.toFixed(1);
  const target = dynamicTargetPrice.toFixed(1);

  return {
    nextMomentState,
    nextMomentLabel:
      nextMomentState === 'ACCELERATING_UP'
        ? 'Option In Profit — Riding Toward Target'
        : nextMomentState === 'FAKE_DIP_HOLD'
          ? `Monitoring Risk Above Stop-Loss (₹${sl})`
          : nextMomentState === 'PEAK_EXHAUSTION'
            ? `Peak Target Reached — Stop-Loss Locked @ ₹${sl}`
            : 'Stop-Loss Hit — Exiting Trade',
    nextMomentLabelMl:
      nextMomentState === 'ACCELERATING_UP'
        ? 'ഓപ്ഷൻ ലാഭത്തിൽ — ടാർഗെറ്റിലേക്ക് മുന്നേറുന്നു'
        : nextMomentState === 'FAKE_DIP_HOLD'
          ? `സ്റ്റോപ്പ്-ലോസിന് മുകളിൽ റിസ്ക് നിരീക്ഷിക്കുന്നു (SL: ₹${sl})`
          : nextMomentState === 'PEAK_EXHAUSTION'
            ? `പരമാവധി ലാഭ ലക്ഷ്യം കണ്ടു — Stop-Loss ₹${sl}-ൽ ലോക്ക് ചെയ്തു`
            : 'സ്റ്റോപ്പ്-ലോസ് പരിധി എത്തി — നഷ്ടം തടയാൻ ക്ലോസ് ചെയ്യുന്നു',
    holdOrExitVerdict:
      nextMomentState === 'PEAK_EXHAUSTION'
        ? `PEAK LOCKED @ ₹${slShort}`
        : nextMomentState === 'ACCELERATING_UP'
          ? `IN PROFIT (Target ₹${target} | SL ₹${slShort})`
          : nextMomentState === 'FAKE_DIP_HOLD'
            ? `HOLDING (SL ₹${slShort})`
            : 'STOP-LOSS HIT — EXITING',
    holdOrExitVerdictMl:
      nextMomentState === 'PEAK_EXHAUSTION'
        ? `Peak Locked @ ₹${slShort}`
        : nextMomentState === 'ACCELERATING_UP'
          ? `ലാഭത്തിൽ (Target ₹${target} | SL ₹${slShort})`
          : nextMomentState === 'FAKE_DIP_HOLD'
            ? `ഹോൾഡ് ചെയ്യുന്നു (SL ₹${slShort})`
            : 'Stop-Loss എത്തി — ക്ലോസ് ചെയ്യുന്നു',
    dynamicStopLossPrice,
    dynamicTargetPrice,
    protectedNetFloor,
    forecastedMaxOptionPrice: dynamicTargetPrice,
    option1mTrendIntact: isOption1mTrendIntact,
    underlyingAligned: !isUnderlyingParametersReversing,
    updatedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };
}
