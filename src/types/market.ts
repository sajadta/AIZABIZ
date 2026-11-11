export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'MCX' | 'GLOBAL';

export interface StockQuote {
  symbol: string;
  indexSymbol?: string;
  name: string;
  instrumentKey: string;
  exchange: Exchange;
  segment: 'EQUITY' | 'INDEX' | 'FUTURES' | 'OPTIONS' | 'COMMODITY' | 'GLOBAL';
  ltp: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  oi?: number;
  bidPrice?: number;
  askPrice?: number;
  bidQty?: number;
  askQty?: number;
  week52High?: number;
  week52Low?: number;
  lastTradeTime?: string;
  tickFlash?: 'up' | 'down' | null;
}

export interface CandleData {
  timestamp: number;
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema9?: number;
  ema21?: number;
  ema50?: number;
  supertrend?: number;
  supertrendDir?: 'BUY' | 'SELL';
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  adx?: number;
  upperBand?: number;
  lowerBand?: number;
  middleBand?: number;
}

export interface OptionStrike {
  strikePrice: number;
  callOI: number;
  callChangeOI: number;
  callLTP: number;
  callIV: number;
  callVolume: number;
  callDelta?: number;
  callInstrumentKey?: string;
  putOI: number;
  putChangeOI: number;
  putLTP: number;
  putIV: number;
  putVolume: number;
  putDelta?: number;
  putInstrumentKey?: string;
  lotSize?: number;
}

export interface OptionChainData {
  underlyingSymbol: string;
  underlyingLTP: number;
  lotSize?: number;
  expiryDates: string[];
  selectedExpiry: string;
  strikes: OptionStrike[];
  pcr: number;
  maxPain: number;
  totalCallOI: number;
  totalPutOI: number;
}

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface IndicatorReadings {
  supertrend: { signal: 'BUY' | 'SELL'; value: number };
  emaCross: { signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; ema9: number; ema21: number; ema50: number };
  rsi: { value: number; condition: 'OVERSOLD' | 'OVERBOUGHT' | 'BULLISH' | 'BEARISH' | 'NEUTRAL' };
  macd: { macd: number; signal: number; hist: number; cross: 'BULLISH' | 'BEARISH' | 'NEUTRAL' };
  vwap: { value: number; position: 'ABOVE' | 'BELOW' };
  rvol?: number;
  adx?: { value: number; condition: 'STRONG_TREND' | 'TRENDING' | 'SIDEWAYS_CHOP' };
}

export interface TradingSignal {
  id: string;
  symbol: string;
  name: string;
  instrumentKey: string;
  underlyingInstrumentKey?: string;
  signalType: SignalType;
  action?: SignalType;
  strategyName: string;
  confidenceScore: number; // 0 - 100%
  confidence?: number;
  price: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  riskRewardRatio: string;
  rationale: string;
  reason?: string;
  rationaleMalayalam: string;
  indicators: IndicatorReadings;
  candlestickPattern?: string;
  candlestickPatternMalayalam?: string;
  mtfConfirmation?: {
    status: boolean;
    timeframe5m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    timeframe15m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  institutionalQuantAnalysis?: {
    chartStructurePattern: string;
    chartStructurePatternMl: string;
    nearestSupport: number;
    nearestResistance: number;
    atr14?: number;
    clearRunwayPoints: number;
    corporateHeavyweightScore: number; // -100 to +100
    corporateHeavyweightSummary: string;
    globalMacroAlignment: 'BULLISH' | 'BEARISH' | 'MIXED';
    oiBuildupType: string;
    estimatedMinutesToTarget: string;
    estimatedMaxOptionPrice: number;
    estimatedNetProfitRange: string;
    fiveYearRegimeSummary?: string;
    fiveYearRegimeSummaryMl?: string;
    multiYearSupport?: number;
    multiYearResistance?: number;
    historicalWinProbability?: number;
    indiaVix?: number;
    marketRegimeMode?: 'TRENDING_OPTION_BUYING' | 'HIGH_VIX_BREAKOUT' | 'LOW_VIX_RANGE_GUARD';
    optionExecutionSide?: 'OPTION_BUYING' | 'OPTION_SELLING' | 'MULTI_LEG_STRANGLE';
    multiLegDetails?: {
      strategyType: 'SHORT_STRADDLE' | 'SHORT_STRANGLE' | 'IRON_CONDOR_SPREAD';
      callStrike: number;
      callLtp: number;
      callInstrumentKey?: string;
      putStrike: number;
      putLtp: number;
      putInstrumentKey?: string;
      combinedPremiumCollected: number;
      thetaDecayPerDayRupees: number;
      upperBreakeven: number;
      lowerBreakeven: number;
    };
  };
  recommendedOptionStrike?: {
    strikePrice: number;
    optionType: 'CE' | 'PE';
    ltp: number;
    expiry: string;
    delta: number;
    lotSize?: number;
    iv?: number;
    oi?: number;
    volume?: number;
    instrumentKey?: string;
    requiredCapital?: number;
    estimatedBrokerage?: number;
    totalRequiredWithBrokerage?: number;
    expectedNetProfit?: number;
    affordableLots?: number;
    availableCapital?: number;
    underlyingSpot?: number;
    optionSymbol?: string;
  };
  timestamp: string;
  status: 'ACTIVE' | 'EXECUTED' | 'TARGET_HIT' | 'SL_HIT' | 'EXPIRED';
}
