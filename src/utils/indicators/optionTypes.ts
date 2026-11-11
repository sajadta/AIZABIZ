export interface RealOptionMetrics {
  optionSymbol?: string;
  strikePrice: number;
  optionType: "CE" | "PE";
  ltp: number;
  expiry: string;
  lotSize: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  iv?: number;
  oi?: number;
  oiChange?: number;
  volume?: number;
  pcr?: number;
  bidAskRatio?: number;
  callWallStrike?: number;
  putWallStrike?: number;
  corporateHeavyweightScore?: number; // -100 to +100
  corporateHeavyweightSummary?: string;
  globalMacroAlignment?: "BULLISH" | "BEARISH" | "MIXED";
  fiveYearRegimeTrend?: "BULLISH_SECULAR" | "BEARISH_CORRECTION" | "RANGE_CONSOLIDATION";
  fiveYearRegimeSummary?: string;
  fiveYearRegimeSummaryMl?: string;
  multiYearSupport?: number;
  multiYearResistance?: number;
  historicalPatternWinRate?: number;
  ema200Daily?: number;
  ema50Daily?: number;
  indiaVix?: number;
  instrumentKey?: string;
  affordableLots?: number;
  requiredCapital?: number;
  estimatedBrokerage?: number;
  totalRequiredWithBrokerage?: number;
  expectedNetProfit?: number;
  availableCapital?: number;
}

