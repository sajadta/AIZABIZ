// Aggregates 1-minute candles into higher timeframes aligned to the 09:15 IST open.
export function aggregateCandles(candles: any[], intervalMs: number) {
  if (!candles || candles.length === 0) return [];
  const aggregated: any[] = [];
  let currentGroup: any = null;
  // Align multi-minute candles (3m, 5m, 15m, 30m, 1h) to Indian Market Open (09:15 AM IST = +03:45 UTC = 13,500,000 ms offset)
  const IST_MARKET_OPEN_OFFSET_MS = (3 * 60 + 45) * 60 * 1000;

  for (const candle of candles) {
    const alignedTime =
      Math.floor((candle.timestamp - IST_MARKET_OPEN_OFFSET_MS) / intervalMs) * intervalMs +
      IST_MARKET_OPEN_OFFSET_MS;

    if (!currentGroup || currentGroup.timestamp !== alignedTime) {
      if (currentGroup) aggregated.push(currentGroup);
      currentGroup = {
        timestamp: alignedTime,
        timeStr: new Date(alignedTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
        }),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      };
    } else {
      currentGroup.high = Math.max(currentGroup.high, candle.high);
      currentGroup.low = Math.min(currentGroup.low, candle.low);
      currentGroup.close = candle.close;
      currentGroup.volume += candle.volume;
    }
  }
  if (currentGroup) aggregated.push(currentGroup);
  return aggregated;
}
