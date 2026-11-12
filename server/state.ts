import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

export const PERSISTENT_TOKEN_BACKUP_PATH = path.join(process.cwd(), ".upstox_token_backup.json");


export let botConfig = {
  enabled: true,
  mode: "PAPER_TRADING",
  userExplicitlySelectedMode: false,
  selectedStrategy: "PROFIT_MAX_100_PERCENT_MATRIX",
  minConfidence: 75,
  maxCapitalPerTrade: 0,
  riskPerTradePercent: 1.5,
  stopLossPercent: 12.0,
  targetProfitPercent: 30,
  trailingStopLoss: true,
  trailingStepPercent: 5,
  tradeQuantity: 50,
  multiTimeframeEnabled: true,
  optionStrikeSelector: true,
  tradeMmode: "OPTIONS_ONLY",
  optionStrategyMode: "HYBRID_AUTO_REGIME",
  enableMultiLegExecution: true,
  limitOrderSlippageGuard: true,
  maxOptionLossCount: 2,
  maxOptionProfitCount: 15,
  minOptionProfitAmount: 450,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  telegramAlertsEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  selectedIndexPriority: "FULL_AUTO_MULTI_INDEX",
  maxConcurrentTrades: 0,
  dailyMaxLossLimit: 800,
  dailyLossLocked: false,
  enableAtrStopLoss: true,
  enableEmaSupertrendExit: true,
  enablePartialBooking: true,
  enableTimeDecayProtection: true,
  enableIndexCorrelation: true,
  marketRegimeFilter: true,
  dynamicPositionSizing: true,
  newsSentimentFilter: true,
  ivCrushProtection: true,
  autoKillSwitch: true,
  maxConsecutiveLosses: 2,
  autoStrikeSelection: true,
  multiTimeframeConfluence: true,
};

export let upstoxConfig = {
  apiKey: process.env.UPSTOX_API_KEY || "",
  apiSecret: process.env.UPSTOX_API_SECRET || "",
  redirectUri: process.env.UPSTOX_REDIRECT_URI || "",
  accessToken: process.env.UPSTOX_ACCESS_TOKEN || "",
  userName: process.env.UPSTOX_USER_NAME || "",
  userEmail: process.env.UPSTOX_USER_EMAIL || "",
  userClientCode: process.env.UPSTOX_CLIENT_CODE || process.env.UPSTOX_ID || "",
  mobile: process.env.UPSTOX_MOBILE || "",
  pin: process.env.UPSTOX_PIN || "",
  totpSecret: process.env.UPSTOX_TOTP_SECRET || process.env.TOTP_SECRET_KEY || "",
  tokenGeneratedAt: "",
  tokenExpiresAt: "",
  outboundProxyUrl: process.env.UPSTOX_PROXY_URL || "",
};

export let botLogs: any[] = [];
export let botSignals: any[] = [];
export let paperOrders: any[] = [];
export let paperPositions: any[] = [];
export let paperTradeHistory: any[] = [];
export let latestMultiIndexAlphaMatrix: any[] = [];
export let globalLiveQuotes: Record<string, any> = {};
export interface UpstoxAutoOtpSession {
  requestId: string;
  userId: string;
  internalClientId: string;
  validateOtpToken: string;
  cookies: Record<string, string>;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  mobile: string;
  pin: string;
  createdAt: number;
}

export let activeAutoOtpSession: UpstoxAutoOtpSession | null = null;
export let customHoldingBuyPrices: Record<string, number> = {};

export const FIXED_PRIMARY_IP = "8.234.113.241";
export const FIXED_SECONDARY_IP = "34.34.254.178";
const PUBLIC_WEBHOOK_RELAY_TOPIC = "upstox_live_sajad_5vcabx_3ab5711d";
export const PUBLIC_WEBHOOK_RELAY_URL = `https://ntfy.sh/${PUBLIC_WEBHOOK_RELAY_TOPIC}`;

export let engineHeartbeatTicks = 0;
export let lastEngineTickAt = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
export let isBotTickRunning = false;
export let lastBotTickStartedAt = 0;
export let cachedUpstoxLivePositions: { timestamp: number; list: any[] } = { timestamp: 0, list: [] };
export const livePositionStateTracker: Record<string, any> = {};
export let lastFullEntryScanAtMs = 0;
export const optionIntradayCandleCache: Record<string, { timestamp: number; raw: any[] }> = {};
export let lastTradeExitTime = 0;
export const recentClosedStrikes: Record<string, any> = {};
export const intradayCandleCache: Record<string, { timestamp: number; raw: any[] }> = {};
export const fiveYearHistoricalRegimeCache: Record<string, { timestamp: number; [key: string]: any }> = {};
export let lastQuotesCache: { timestamp: number; data: Record<string, any>; quotes: any[] } = { timestamp: 0, data: {}, quotes: [] };
export const optionContractCache: Record<string, { timestamp: number; data: any }> = {};
export const optionChainCache: Record<string, { timestamp: number; data: any }> = {};
export let cachedUpstoxLiveMargin: { timestamp: number; margin: number; utilizedMargin: number; payin: number; payout: number } = { timestamp: 0, margin: 0, utilizedMargin: 0, payin: 0, payout: 0 };

export const YAHOO_NSE_MAP: { instrumentKey: string; symbol: string; yahooTicker: string }[] = [];
export const invalidTokens = new Set<string>();
export let subscribedKeys: Set<string> = new Set();
export let paperBalance = 2000; // Initial mock balance

export const setBotConfig = (newConfig: any) => {
  Object.assign(botConfig, newConfig);
};

export const setUpstoxConfig = (newConfig: any) => {
  Object.assign(upstoxConfig, newConfig);
};

export const setActiveAutoOtpSession = (session: UpstoxAutoOtpSession | null) => {
  activeAutoOtpSession = session;
};

export const resetPaperTradingState = () => {
  paperOrders.length = 0;
  paperPositions.length = 0;
  paperTradeHistory.length = 0;
  botLogs.length = 0;
  botSignals.length = 0;
  latestMultiIndexAlphaMatrix.length = 0;
  invalidTokens.clear();
};

export const addBotLog = (log: any) => {
  botLogs.unshift(log);
  if (botLogs.length > 200) botLogs.length = 200;
};

