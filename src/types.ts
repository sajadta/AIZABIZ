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

export type OrderTransactionType = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type ProductType = 'INTRADAY' | 'DELIVERY';
export type OrderStatus = 'COMPLETE' | 'PENDING' | 'CANCELLED' | 'REJECTED';
export type ExecutionMode = 'UPSTOX_LIVE' | 'PAPER_TRADING';

export interface Order {
  id: string;
  orderId: string;
  symbol: string;
  instrumentKey: string;
  transactionType: OrderTransactionType;
  orderType: OrderType;
  productType: ProductType;
  quantity: number;
  price: number;
  triggerPrice?: number;
  status: OrderStatus;
  executedPrice?: number;
  positionId?: string;
  buyPrice?: number;
  sellPrice?: number;
  realizedPnL?: number;
  brokerageCharges?: number;
  netRealizedPnL?: number;
  timestamp: string;
  mode: ExecutionMode;
  notes?: string;
}

export interface Position {
  id: string;
  realizedPnL?: number;
  netRealizedPnL?: number;
  brokerageCharges?: number;
  exitReason?: string;
  sellPrice?: number;
  closeTime?: string;
  symbol: string;
  instrumentKey: string;
  productType: ProductType;
  quantity: number;
  buyPrice: number;
  currentLTP: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  target?: number;
  trailingStopLoss?: number;
  highestLTP?: number;
  highestPnl?: number;
  highestNetPnl?: number;
  estimatedMaxOptionPrice?: number;
  estimatedMinutesToTarget?: string;
  liveTrajectoryRadar?: {
    nextMomentState: 'ACCELERATING_UP' | 'FAKE_DIP_HOLD' | 'PEAK_EXHAUSTION' | 'REVERSING_EXIT';
    nextMomentLabel: string;
    nextMomentLabelMl: string;
    holdOrExitVerdict: string;
    holdOrExitVerdictMl: string;
    dynamicStopLossPrice?: number;
    dynamicTargetPrice?: number;
    protectedNetFloor: number;
    forecastedMaxOptionPrice: number;
    option1mTrendIntact: boolean;
    underlyingAligned: boolean;
    updatedAt: string;
  };
  mode: ExecutionMode;
  openedAt: string;
  openedAtMs?: number;
  isOption?: boolean;
  type?: string;
  netPnl?: number;
  taxes?: {
    brokerage: number;
    stt: number;
    gst: number;
    totalCharges: number;
  };
}

export interface Holding {
  symbol: string;
  companyName: string;
  instrumentKey?: string;
  isin?: string;
  quantity: number;
  avgPrice: number;
  buyPrice?: number;
  currentLTP: number;
  closePrice?: number;
  isBuyPriceLocked?: boolean;
  isUpstoxZeroPrice?: boolean;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  fiftyPercentTarget?: {
    targetPrice: number;
    targetTotalValue: number;
    targetProfitAmount: number;
    priceNeeded: number;
    profitRemaining: number;
    progressPct: number;
    isReached: boolean;
    targetPrice50Pct?: number;
    targetValue50Pct?: number;
    netProfitAt50Pct?: number;
    priceNeededFor50Pct?: number;
    pctAwayFrom50Pct?: number;
    progressTo50Pct?: number;
    is50PctMilestoneReached?: boolean;
  };
  algoForecast?: {
    direction: 'STRONG_UPTREND' | 'UPTREND' | 'SIDEWAYS_CONSOLIDATION' | 'DOWNTREND_RISK';
    confidencePct: number;
    expectedTarget30d: number;
    supportLevel: number;
    resistanceLevel: number;
    rsi14: number;
    ema20: number;
    ema50: number;
    ema200: number;
    fiftyPctReachProbability: number;
    recommendedAction: string;
    forecastSummaryMl: string;
    trendOutlook?: 'STRONG_UPTREND' | 'ACCUMULATION_RECOVERY' | 'PROFIT_BOOKING_ZONE' | 'DOWNTREND_CAUTION';
    verdictEn?: string;
    verdictMl?: string;
    nextBreakoutTarget?: number;
    supportFloor?: number;
    resistanceWall?: number;
    ema20Daily?: number;
    ema50Daily?: number;
    rsi14Daily?: number;
    probabilityOf50PctTarget?: number;
    estimatedHoldingHorizonMl?: string;
  };
}

export type StrategyKey = 
  | 'SUPERTREND_EMA_CONFLUENCE'
  | 'RSI_MOMENTUM_BREAKOUT'
  | 'VWAP_INSTITUTIONAL_REVERSION'
  | 'PROFIT_MAX_100_PERCENT_MATRIX'
  | 'MULTI_TIMEFRAME_CONFLUENCE'
  | 'OPTION_ATM_MOMENTUM_RIDER';

export interface CandlestickPattern {
  name: string;
  nameMalayalam: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  reliability: 'HIGH' | 'MEDIUM';
  description: string;
  descriptionMalayalam: string;
  candleIndex: number;
}

export type TradeMode = 'OPTIONS_ONLY' | 'STOCKS_ONLY' | 'BOTH';

export type OptionStrategyMode =
  | 'OPTION_BUYING'
  | 'OPTION_SELLING'
  | 'MULTI_LEG_STRANGLE'
  | 'HYBRID_AUTO_REGIME';

export interface BotConfig {
  enabled: boolean;
  mode: ExecutionMode;
  tradeMode: TradeMode;
  optionStrategyMode?: OptionStrategyMode;
  enableMultiLegExecution?: boolean;
  limitOrderSlippageGuard?: boolean;
  minOptionProfitAmount: number;
  maxOptionLossCount: number;
  maxStockLossCount: number;
  maxStockProfitCount: number;
  selectedStrategy: StrategyKey;
  minConfidence: number; // e.g., 85
  maxCapitalPerTrade?: number; // 0 = Auto Dynamic Funds (100% Available Balance Sizing), or manual limit in ₹
  maxTradesPerDay: number;
  riskPerTradePercent: number;
  stopLossPercent: number;
  targetProfitPercent: number;
  trailingStopLoss: boolean;
  trailingStepPercent: number;
  dailyMaxLossLimit: number; // Daily loss protection (e.g. 1500)
  dailyMaxProfitTarget: number; // Daily target lock (e.g. 5000)
  dailyLossLocked?: boolean;
  selectedIndexPriority?:
    | 'FULL_AUTO_MULTI_INDEX'
    | 'ALL_NIFTY_PRIORITY'
    | 'NIFTY_50_ONLY'
    | 'BANKNIFTY_ONLY'
    | 'SENSEX_ONLY'
    | 'FINNIFTY_ONLY'
    | 'MIDCPNIFTY_ONLY'
    | 'BANKEX_ONLY'
    | 'ALL_EQUAL';
  maxConcurrentTrades?: number; // 0 = Auto Dynamic Funds, or 1, 2, 3, 4, 5
  // Advanced Institutional Settings
  marketRegimeFilter?: boolean; // Sideways market detection
  dynamicPositionSizing?: boolean; // AI confidence based sizing
  newsSentimentFilter?: boolean; // Gemini API news checks
  ivCrushProtection?: boolean; // Options Greek IV checks
  autoKillSwitch?: boolean; // Emotionless kill switch on max loss
  maxConsecutiveLosses?: number;

  multiTimeframeConfirmation: boolean; // 5m + 15m MTF confluence
  multiTimeframeEnabled?: boolean;
  autoOptionStrikeSelector: boolean; // Smart ATM CE/PE Strike Picker
  optionStrikeSelector?: boolean;
  candlestickPatternFilter: boolean; // Require Candlestick pattern validation
  telegramAlertsEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  autoSquareOffTime: string; // e.g. "15:15"
  allowedSymbols: string[];
  soundAlerts: boolean;
}

export interface BotLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SIGNAL' | 'EXECUTION' | 'SL_TRIGGER' | 'TP_TRIGGER' | 'ERROR' | 'SYSTEM' | 'TRADE' | 'SUCCESS';
  message: string;
  messageMalayalam?: string;
  data?: any;
}

export interface UpstoxApiConfig {
  geminiApiKey?: string;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  accessToken: string;
  isConnected: boolean;
  userName: string;
  userEmail: string;
  userClientCode?: string;
  broker: string;
  availableMargin: number;
  usedMargin: number;
  utilizedMargin?: number;
  payin?: number;
  payout?: number;
  totalBalance?: number;
  tokenGeneratedAt?: string;
  tokenExpiresAt?: string;
  todayTokenValid?: boolean;
  lastConnectedAt?: string;
  serverOutboundIp?: string;
  serverSecondaryIp?: string;
}

export interface GeminiMarketAnalysis {
  sentiment: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  confidenceScore: number;
  summary: string;
  summaryMalayalam: string;
  keyLevels: {
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
  };
  recommendedAction: {
    type: 'BUY' | 'SELL' | 'WAIT';
    entryRange: string;
    stopLoss: number;
    target1: number;
    target2: number;
    confidence: number;
    riskReward: string;
  };
  technicalReasons: string[];
  technicalReasonsMalayalam: string[];
  catalyst: string;
  analyzedAt: string;
}

export type Language = 'en' | 'ml';

export interface PriceAlert {
  id: string;
  symbol: string;
  instrumentKey: string;
  targetPrice: number;
  condition: 'GREATER_THAN' | 'LESS_THAN';
  isActive: boolean;
}

export interface MultiIndexAlphaItem {
  key: string;
  symbol: string;
  displayName: string;
  exchange: 'NSE' | 'BSE';
  spotLtp: number;
  trend15m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trend5m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalType: 'BUY' | 'SELL' | 'HOLD';
  confidenceScore: number;
  corporateHeavyweightScore: number;
  corporateHeavyweightSummary: string;
  bestOptionSymbol?: string;
  bestOptionLtp?: number;
  lotSize?: number;
  bestStrike?: number;
  delta?: number;
  gamma?: number;
  expectedNetProfit?: number;
  totalRequiredCashWithBrokerage?: number;
  roiPotentialPct?: number;
  alphaOpportunityScore?: number;
  rank?: number;
  isTopPick?: boolean;
  statusTextMl: string;
  statusTextEn: string;
}
