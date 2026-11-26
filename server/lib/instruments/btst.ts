// Decides whether an open option position is worth carrying overnight (BTST).
export function shouldHoldOvernightBTST(pos: any, signal: any): boolean {
  if (!signal || !signal.indicators) return false;

  const isCall = /\bCE\b/i.test(pos.symbol || '');
  const isPut = /\bPE\b/i.test(pos.symbol || '');
  const ind = signal.indicators;
  const corpScore = signal.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;

  if (isCall) {
    return (
      (signal.signalType === 'BUY' || signal.sentiment === 'BULLISH') &&
      ind.emaCross?.ema9 > ind.emaCross?.ema21 &&
      corpScore >= -10 &&
      (ind.rsi?.value || 50) < 78
    );
  } else if (isPut) {
    return (
      (signal.signalType === 'SELL' || signal.sentiment === 'BEARISH') &&
      ind.emaCross?.ema9 < ind.emaCross?.ema21 &&
      corpScore <= 10 &&
      (ind.rsi?.value || 50) > 22
    );
  }

  return signal.signalType === 'BUY' && corpScore >= -15;
}
