// Default bot configuration seeded before the server pushes authoritative config.
import type { BotConfig } from '../types';

export const DEFAULT_BOT_CONFIG: BotConfig = {
  enabled: true, // Always active 24x7 Cloud Trading Engine
  mode: 'PAPER_TRADING',
  tradeMode: 'OPTIONS_ONLY',
  minOptionProfitAmount: 350,
  maxOptionLossCount: 2,
  maxStockLossCount: 2,
  maxStockProfitCount: 5,
  selectedStrategy: 'PROFIT_MAX_100_PERCENT_MATRIX',
  minConfidence: 82,
  maxCapitalPerTrade: 0, // 0 = Auto Dynamic Funds (100% Real Account Margin Sizing)
  maxTradesPerDay: 8,
  riskPerTradePercent: 1.5,
  stopLossPercent: 12.0,
  targetProfitPercent: 30.0,
  trailingStopLoss: true,
  trailingStepPercent: 5,
  dailyMaxLossLimit: 2000,
  dailyMaxProfitTarget: 5000,
  dailyLossLocked: false,
  multiTimeframeConfirmation: true,
  multiTimeframeEnabled: true,
  autoOptionStrikeSelector: true,
  optionStrikeSelector: true,
  candlestickPatternFilter: true,
  telegramAlertsEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  autoSquareOffTime: '15:25',
  allowedSymbols: ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY', 'BANKEX'],
  soundAlerts: true,
  selectedIndexPriority: 'FULL_AUTO_MULTI_INDEX',
  maxConcurrentTrades: 0, // 0 = Dynamic Fund-Based Auto Allocation
  optionStrategyMode: 'HYBRID_AUTO_REGIME',
  limitOrderSlippageGuard: true,
};
