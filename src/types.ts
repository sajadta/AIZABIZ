export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'MCX';

export interface StockQuote {
  symbol: string;
  indexSymbol?: string;
  name: string;
  instrumentKey: string;
  exchange: Exchange;
  segment: 'EQUITY' | 'INDEX' | 'FUTURES' | 'OPTIONS';
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
  lastTradeTime: string;
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
  putOI: number;
  putChangeOI: number;
  putLTP: number;
  putIV: number;
  putVolume: number;
  putDelta?: number;
}

export interface OptionChainData {
  underlyingSymbol: string;
  underlyingLTP: number;
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
}

export interface TradingSignal {
  id: string;
  symbol: string;
  name: string;
  instrumentKey: string;
  underlyingInstrumentKey?: string;
  signalType: SignalType;
  strategyName: string;
  confidenceScore: number; // 0 - 100%
  price: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  riskRewardRatio: string;
  rationale: string;
  rationaleMalayalam: string;
  indicators: IndicatorReadings;
  candlestickPattern?: string;
  candlestickPatternMalayalam?: string;
  mtfConfirmation?: {
    status: boolean;
    timeframe5m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    timeframe15m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  recommendedOptionStrike?: {
    strikePrice: number;
    optionType: 'CE' | 'PE';
    ltp: number;
    expiry: string;
    delta: number;
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
  timestamp: string;
  mode: ExecutionMode;
  notes?: string;
}

export interface Position {
  id: string;
  realizedPnL?: number;
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
  mode: ExecutionMode;
  openedAt: string;
  isOption?: boolean;
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
  quantity: number;
  avgPrice: number;
  currentLTP: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
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

export interface BotConfig {
  enabled: boolean;
  mode: ExecutionMode;
  tradeMode: TradeMode;
  minOptionProfitAmount: number;
  maxOptionLossCount: number;
  maxStockLossCount: number;
  maxStockProfitCount: number;
  selectedStrategy: StrategyKey;
  minConfidence: number; // e.g., 85
  maxCapitalPerTrade: number;
  maxTradesPerDay: number;
  riskPerTradePercent: number;
  stopLossPercent: number;
  targetProfitPercent: number;
  trailingStopLoss: boolean;
  trailingStepPercent: number;
  dailyMaxLossLimit: number; // Daily loss protection (e.g. 1500)
  dailyMaxProfitTarget: number; // Daily target lock (e.g. 5000)
  dailyLossLocked?: boolean;
  // Advanced Institutional Settings
  marketRegimeFilter?: boolean; // Sideways market detection
  dynamicPositionSizing?: boolean; // AI confidence based sizing
  newsSentimentFilter?: boolean; // Gemini API news checks
  ivCrushProtection?: boolean; // Options Greek IV checks
  autoKillSwitch?: boolean; // Emotionless kill switch on max loss
  maxConsecutiveLosses?: number;

  multiTimeframeConfirmation: boolean; // 5m + 15m MTF confluence
  autoOptionStrikeSelector: boolean; // Smart ATM CE/PE Strike Picker
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
  type: 'INFO' | 'SIGNAL' | 'EXECUTION' | 'SL_TRIGGER' | 'TP_TRIGGER' | 'ERROR' | 'SYSTEM';
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
  tokenGeneratedAt?: string;
  tokenExpiresAt?: string;
  todayTokenValid?: boolean;
  lastConnectedAt?: string;
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
