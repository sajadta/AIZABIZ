import type { CandleData } from '../../../types';

export interface CandlePatternResult {
  patternEn: string;
  patternMl: string;
  bullishPoints: number;
  bearishPoints: number;
  isBullishEngulfing: boolean;
  isBearishEngulfing: boolean;
  isHammerSupport: boolean;
  isShootingStarResistance: boolean;
}

const FALLBACK_EN = 'Multi-Candle Structure Follow-Through';
const FALLBACK_ML = 'മൾട്ടി-കാൻഡിൽ സ്ട്രക്ചർ കൺഫർമേഷൻ';

// Multi-candle pattern recognition over the last two CLOSED candles with the live
// price as breakout confirmation, so a single unclosed candle never fires a signal.
export function detectCandlePattern(
  prev: CandleData,
  prev2: CandleData,
  prev3: CandleData,
  currentLtp: number,
): CandlePatternResult {
  const prevBody = Math.abs(prev.close - prev.open);
  const prevRange = Math.max(0.01, prev.high - prev.low);
  const prevUpperWick = prev.high - Math.max(prev.open, prev.close);
  const prevLowerWick = Math.min(prev.open, prev.close) - prev.low;
  const prev2Body = Math.abs(prev2.close - prev2.open);
  const prev3Body = Math.abs(prev3.close - prev3.open);

  const isBullishEngulfing =
    prev2.close < prev2.open &&
    prev.close > prev.open &&
    prev.close >= prev2.open &&
    prev.open <= prev2.close &&
    currentLtp >= prev.close;
  const isBearishEngulfing =
    prev2.close > prev2.open &&
    prev.close < prev.open &&
    prev.close <= prev2.open &&
    prev.open >= prev2.close &&
    currentLtp <= prev.close;

  const isHammerSupport =
    prevLowerWick >= prevBody * 1.8 && prevUpperWick <= prevRange * 0.25 && currentLtp > prev.high;
  const isShootingStarResistance =
    prevUpperWick >= prevBody * 1.8 && prevLowerWick <= prevRange * 0.25 && currentLtp < prev.low;

  const isMorningStar =
    prev3.close < prev3.open &&
    prev2Body < prev3Body * 0.45 &&
    prev.close > prev.open &&
    prev.close > (prev3.open + prev3.close) / 2 &&
    currentLtp >= prev.close;
  const isEveningStar =
    prev3.close > prev3.open &&
    prev2Body < prev3Body * 0.45 &&
    prev.close < prev.open &&
    prev.close < (prev3.open + prev3.close) / 2 &&
    currentLtp <= prev.close;

  const isInsideBarBullBreakout =
    prev.high <= prev2.high && prev.low >= prev2.low && currentLtp > prev2.high;
  const isInsideBarBearBreakdown =
    prev.high <= prev2.high && prev.low >= prev2.low && currentLtp < prev2.low;

  const isThreeSoldiersThrust =
    prev2.close > prev2.open &&
    prev.close > prev.open &&
    prev.close > prev2.close &&
    currentLtp >= prev.close;
  const isThreeCrowsThrust =
    prev2.close < prev2.open &&
    prev.close < prev.open &&
    prev.close < prev2.close &&
    currentLtp <= prev.close;

  const result: CandlePatternResult = {
    patternEn: FALLBACK_EN,
    patternMl: FALLBACK_ML,
    bullishPoints: 0,
    bearishPoints: 0,
    isBullishEngulfing,
    isBearishEngulfing,
    isHammerSupport,
    isShootingStarResistance,
  };

  if (isBullishEngulfing) {
    result.patternEn = 'Bullish Engulfing + Follow-Through Breakout';
    result.patternMl = 'ബുള്ളിഷ് എൻഗൾഫിങ് + ബ്രേക്ക്ഔട്ട് കൺഫർമേഷൻ';
    result.bullishPoints = 16;
  } else if (isMorningStar) {
    result.patternEn = 'Morning Star 3-Candle Institutional Reversal';
    result.patternMl = 'മോണിംഗ് സ്റ്റാർ 3-കാൻഡിൽ റിവേഴ്സൽ';
    result.bullishPoints = 18;
  } else if (isHammerSupport) {
    result.patternEn = 'Hammer Pin-Bar Liquidity Sweep & Breakout';
    result.patternMl = 'ഹാമർ പിൻ-ബാർ സപ്പോർട്ട് ബൗൺസ്';
    result.bullishPoints = 15;
  } else if (isInsideBarBullBreakout) {
    result.patternEn = 'Inside-Bar Volatility Expansion Breakout';
    result.patternMl = 'ഇൻസൈഡ്-ബാർ വോളിയം ബ്രേക്ക്ഔട്ട്';
    result.bullishPoints = 15;
  } else if (isThreeSoldiersThrust) {
    result.patternEn = '3-Bar Institutional Momentum Thrust';
    result.patternMl = '3-ബാർ ഇൻസ്റ്റിറ്റ്യൂഷണൽ മൊമെന്റം ബ്രേക്ക്ഔട്ട്';
    result.bullishPoints = 14;
  } else if (isBearishEngulfing) {
    result.patternEn = 'Bearish Engulfing + Breakdown Confirmation';
    result.patternMl = 'ബെയറിഷ് എൻഗൾഫിങ് + ബ്രേക്ക്ഡൗൺ കൺഫർമേഷൻ';
    result.bearishPoints = 16;
  } else if (isEveningStar) {
    result.patternEn = 'Evening Star 3-Candle Institutional Reversal';
    result.patternMl = 'ഈവനിംഗ് സ്റ്റാർ 3-കാൻഡിൽ റിവേഴ്സൽ';
    result.bearishPoints = 18;
  } else if (isShootingStarResistance) {
    result.patternEn = 'Shooting Star Supply Rejection Breakdown';
    result.patternMl = 'ഷൂട്ടിംഗ് സ്റ്റാർ റെസിസ്റ്റൻസ് റിജക്ഷൻ';
    result.bearishPoints = 15;
  } else if (isInsideBarBearBreakdown) {
    result.patternEn = 'Inside-Bar Downside Expansion Breakdown';
    result.patternMl = 'ഇൻസൈഡ്-ബാർ ഡൗൺസൈഡ് ബ്രേക്ക്ഡൗൺ';
    result.bearishPoints = 15;
  } else if (isThreeCrowsThrust) {
    result.patternEn = '3-Bar Institutional Bearish Thrust';
    result.patternMl = '3-ബാർ ഇൻസ്റ്റിറ്റ്യൂഷണൽ ബെയറിഷ് ബ്രേക്ക്ഡൗൺ';
    result.bearishPoints = 14;
  }

  return result;
}
