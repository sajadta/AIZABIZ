// Detects whether the underlying index parameters have flipped against an open
// option position (CE vs PE) using live EMA/SuperTrend/MACD and heavyweight flow.

export interface UnderlyingReversalResult {
  isUnderlyingParametersReversing: boolean;
  underlyingReversalDetails: string;
}

export const isCallOptionSymbol = (symbol: string | undefined): boolean =>
  /\bCE\b/i.test(symbol || '');

export const detectUnderlyingReversal = (
  underlyingSignal: any,
  isCallOption: boolean,
): UnderlyingReversalResult => {
  const ind = underlyingSignal?.indicators;
  if (!ind) return { isUnderlyingParametersReversing: false, underlyingReversalDetails: '' };

  const corpScoreLive =
    underlyingSignal?.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;

  if (isCallOption) {
    const emaTurnedBear = ind.emaCross?.ema9 < ind.emaCross?.ema21;
    const stTurnedSell = ind.supertrend?.signal === 'SELL';
    const macdTurnedBear = ind.macd?.hist < 0;
    const oppSignal = underlyingSignal?.signalType === 'SELL';
    if (
      oppSignal ||
      (emaTurnedBear && macdTurnedBear) ||
      (stTurnedSell && emaTurnedBear) ||
      (emaTurnedBear && corpScoreLive <= -25)
    ) {
      return {
        isUnderlyingParametersReversing: true,
        underlyingReversalDetails: `Underlying Index Parameters Reversed against CE (EMA9 < EMA21, MACD ${ind.macd?.hist?.toFixed(2)}, Heavyweights ${corpScoreLive})`,
      };
    }
    return { isUnderlyingParametersReversing: false, underlyingReversalDetails: '' };
  }

  const emaTurnedBull = ind.emaCross?.ema9 > ind.emaCross?.ema21;
  const stTurnedBuy = ind.supertrend?.signal === 'BUY';
  const macdTurnedBull = ind.macd?.hist > 0;
  const oppSignal = underlyingSignal?.signalType === 'BUY';
  if (
    oppSignal ||
    (emaTurnedBull && macdTurnedBull) ||
    (stTurnedBuy && emaTurnedBull) ||
    (emaTurnedBull && corpScoreLive >= 25)
  ) {
    return {
      isUnderlyingParametersReversing: true,
      underlyingReversalDetails: `Underlying Index Parameters Reversed against PE (EMA9 > EMA21, MACD +${ind.macd?.hist?.toFixed(2)}, Heavyweights +${corpScoreLive})`,
    };
  }
  return { isUnderlyingParametersReversing: false, underlyingReversalDetails: '' };
};
