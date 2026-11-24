// Upstox intraday candle normalisation plus live-tick merge so indicators are
// enriched on the real-time price rather than the last closed bar.

export interface NormalizedCandle {
  timestamp: number;
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const IST_TIME = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

export const mapUpstoxCandles = (rows: any[][]): NormalizedCandle[] =>
  rows
    .map((c) => ({
      timestamp: new Date(c[0]).getTime(),
      timeStr: IST_TIME.format(new Date(c[0])),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }))
    .reverse();

// Merges the live index tick into the newest bar so EMA/Supertrend/RSI read the
// current price; the bar's high/low expand to contain the tick.
export const applyLiveTick = (candles: NormalizedCandle[], liveLtp: number): NormalizedCandle[] => {
  if (!(liveLtp > 0) || candles.length === 0) return candles;

  const last = candles[candles.length - 1];
  last.close = liveLtp;
  if (liveLtp > last.high) last.high = liveLtp;
  if (liveLtp < last.low) last.low = liveLtp;
  return candles;
};
