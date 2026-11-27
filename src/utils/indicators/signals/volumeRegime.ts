// Relative-volume (RVOL) measurement plus the dark-pool and neural-weight
// scoring heuristics derived from it.

export interface VolumeCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface VolumeRegimeInput {
  candles: VolumeCandle[];
  last: VolumeCandle;
  prev: VolumeCandle;
  currentLtp: number;
  rsi: number;
}

export interface VolumeRegimeResult {
  rvol: number;
  isDarkPoolBullishBlock: boolean;
  isDarkPoolBearishBlock: boolean;
  neuralQuantConfidenceWeight: number;
  bullishPoints: number;
  bearishPoints: number;
}

const RVOL_WINDOW = 20;
const DARK_POOL_POINTS = 22;
const NEURAL_POINTS = 10;

// Index spot candles carry no volume, so fall back to range expansion as the
// activity proxy there.
export const computeRvol = ({ candles, last, prev, currentLtp }: VolumeRegimeInput): number => {
  const volSlice = candles.slice(-Math.min(RVOL_WINDOW, candles.length));
  const avgVol20 =
    volSlice.reduce((acc, c) => acc + Number(c.volume || 0), 0) / Math.max(1, volSlice.length);
  const avgRange20 =
    volSlice.reduce((acc, c) => acc + Math.max(0.05, c.high - c.low), 0) /
    Math.max(1, volSlice.length);
  const recent2MaxRange = Math.max(
    last.high - last.low,
    prev.high - prev.low,
    Math.abs(currentLtp - prev.close),
  );

  if (avgVol20 > 0) return Number((Number(last.volume || 0) / avgVol20).toFixed(2));
  if (avgRange20 > 0) {
    return Number(Math.max(0.8, Math.min(3.5, recent2MaxRange / avgRange20)).toFixed(2));
  }
  return 1.15;
};

export const evaluateVolumeRegime = (input: VolumeRegimeInput): VolumeRegimeResult => {
  const { last, rsi } = input;
  const rvol = computeRvol(input);
  const midPoint = (last.high + last.low) / 2;

  const isDarkPoolBullishBlock = rvol >= 3.5 && last.close >= last.open && last.close >= midPoint;
  const isDarkPoolBearishBlock = rvol >= 3.5 && last.close <= last.open && last.close <= midPoint;

  const neuralEntropyFactor = Math.abs(rsi - 50) / 50;
  const neuralQuantConfidenceWeight = Number(
    (1 / (1 + Math.exp(-((rvol - 1.2) * 1.5 + neuralEntropyFactor)))).toFixed(2),
  );

  let bullishPoints = 0;
  let bearishPoints = 0;

  if (isDarkPoolBullishBlock) bullishPoints += DARK_POOL_POINTS;
  if (isDarkPoolBearishBlock) bearishPoints += DARK_POOL_POINTS;

  if (neuralQuantConfidenceWeight >= 0.65) {
    if (last.close >= last.open) bullishPoints += NEURAL_POINTS;
    else bearishPoints += NEURAL_POINTS;
  }

  return {
    rvol,
    isDarkPoolBullishBlock,
    isDarkPoolBearishBlock,
    neuralQuantConfidenceWeight,
    bullishPoints,
    bearishPoints,
  };
};
