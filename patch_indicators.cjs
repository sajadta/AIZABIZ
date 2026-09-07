const fs = require('fs');
let code = fs.readFileSync('src/utils/indicators.ts', 'utf-8');

const advancedScoring = `
  let bullishPoints = 0;
  let bearishPoints = 0;

  // 1. Supertrend (Institutional Trend Direction) - 30 Points
  if (readings.supertrend.signal === 'BUY') bullishPoints += 30;
  else bearishPoints += 30;

  // 2. EMA Cross (Momentum) - 25 Points
  // Only score if the crossover is clear and diverging
  if (readings.emaCross.signal === 'BULLISH' && ema9 > ema21 * 1.0005) bullishPoints += 25;
  else if (readings.emaCross.signal === 'BEARISH' && ema9 < ema21 * 0.9995) bearishPoints += 25;

  // 3. RSI (Strength) - 20 Points
  // Avoid buying at absolute tops (RSI > 75) or selling at bottoms (RSI < 25)
  if (readings.rsi.value >= 52 && readings.rsi.value <= 72) bullishPoints += 20;
  else if (readings.rsi.value <= 48 && readings.rsi.value >= 28) bearishPoints += 20;

  // 4. MACD (Acceleration) - 15 Points
  // Check if MACD histogram is growing, not just positive
  if ((readings.macd.cross === 'BULLISH' || macdHist > 0) && macdHist > prevMacdHist) bullishPoints += 15;
  else if ((readings.macd.cross === 'BEARISH' || macdHist < 0) && macdHist < prevMacdHist) bearishPoints += 15;

  // 5. VWAP (Intraday Institutional Average) - 10 Points
  if (readings.vwap.position === 'ABOVE') bullishPoints += 10;
  else bearishPoints += 10;

  // 6. Volatility & Trap Filter (Penalty)
  // If RSI is extremely overbought, penalize bullish score
  if (readings.rsi.value > 80) bullishPoints -= 15;
  // If RSI is extremely oversold, penalize bearish score
  if (readings.rsi.value < 20) bearishPoints -= 15;
  
  // 7. Candlestick Anatomy (Simple Check)
  const bodySize = Math.abs(last.close - last.open);
  const totalSize = last.high - last.low;
  const isDoji = totalSize > 0 && (bodySize / totalSize) < 0.15;
  if (isDoji) {
      // Doji means indecision. Reduce confidence.
      bullishPoints -= 10;
      bearishPoints -= 10;
  }
`;

code = code.replace(
  /let bullishPoints = 0;[\s\S]*else bearishPoints \+= 10;/,
  advancedScoring.trim()
);

fs.writeFileSync('src/utils/indicators.ts', code);
console.log("Patched indicator logic");
