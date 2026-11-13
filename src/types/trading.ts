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
  isBtstHoldRecommended?: boolean;
  btstHoldLogged?: boolean;
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

export type TradeMode = 'OPTIONS_ONLY' | 'STOCKS_ONLY' | 'BOTH' | 'AUTO_ADAPTIVE';

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
