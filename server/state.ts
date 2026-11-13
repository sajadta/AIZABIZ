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
  tradeMode: "AUTO_ADAPTIVE",
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
  apiKey: process.env.UPSTOX_API_KEY || "3ab5711d-8891-480b-b0c1-29662852de49",
  apiSecret: process.env.UPSTOX_API_SECRET || "jl5s7qy9r0",
  redirectUri: process.env.UPSTOX_REDIRECT_URI || "",
  accessToken: process.env.UPSTOX_ACCESS_TOKEN || "",
  userName: process.env.UPSTOX_USER_NAME || "SAJAD THAZHEPEEDIKAYILA ABDULRAHIMAN",
  userEmail: process.env.UPSTOX_USER_EMAIL || "sajadthazhepeedikayila@gmail.com",
  userClientCode: process.env.UPSTOX_CLIENT_CODE || process.env.UPSTOX_ID || "5VCABX",
  mobile: process.env.UPSTOX_MOBILE || "9847989434",
  pin: process.env.UPSTOX_PIN || "984798",
  totpSecret: process.env.UPSTOX_TOTP_SECRET || process.env.TOTP_SECRET_KEY || "OQMKK5L53ZDRSNKVRNBTYOIB5ZVLEXW3",
  tokenGeneratedAt: "",
  tokenExpiresAt: "",
  outboundProxyUrl: process.env.UPSTOX_PROXY_URL || "http://8.234.113.241:8888",
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

export let lastWebhookDiagnostic = "";
export const setLastWebhookDiagnostic = (v: string) => { lastWebhookDiagnostic = v; };
export const getLastWebhookDiagnostic = () => lastWebhookDiagnostic;

export const setBotConfig = (newConfig: any) => {
  Object.assign(botConfig, newConfig);
};

export const setUpstoxConfig = (newConfig: any) => {
  Object.assign(upstoxConfig, newConfig);
};

export const setActiveAutoOtpSession = (session: UpstoxAutoOtpSession | null) => {
  activeAutoOtpSession = session;
};

// Setters for module-level `let` bindings that are reassigned by the bot engine
// and other services. Kept here so importers can mutate shared state without
// depending on the (read-only) live binding of a namespace import.
export const setEngineHeartbeatTicks = (v: number) => { engineHeartbeatTicks = v; };
export const setLastEngineTickAt = (v: string) => { lastEngineTickAt = v; };
export const setIsBotTickRunning = (v: boolean) => { isBotTickRunning = v; };
export const setLastBotTickStartedAt = (v: number) => { lastBotTickStartedAt = v; };
export const setLastFullEntryScanAtMs = (v: number) => { lastFullEntryScanAtMs = v; };
export const setLastTradeExitTime = (v: number) => { lastTradeExitTime = v; };
export const setCachedUpstoxLivePositions = (v: { timestamp: number; list: any[] }) => { cachedUpstoxLivePositions = v; };
export const setCachedUpstoxLiveMargin = (v: typeof cachedUpstoxLiveMargin) => { cachedUpstoxLiveMargin = v; };
export const setLatestMultiIndexAlphaMatrix = (v: any[]) => { latestMultiIndexAlphaMatrix = v; };
export const setLastQuotesCache = (v: typeof lastQuotesCache) => { lastQuotesCache = v; };
export const setSubscribedKeys = (v: Set<string>) => { subscribedKeys = v; };

export const getEngineHeartbeatTicks = () => engineHeartbeatTicks;
export const getLastEngineTickAt = () => lastEngineTickAt;
export const getIsBotTickRunning = () => isBotTickRunning;
export const getLastBotTickStartedAt = () => lastBotTickStartedAt;
export const getLastFullEntryScanAtMs = () => lastFullEntryScanAtMs;
export const getLastTradeExitTime = () => lastTradeExitTime;
export const getCachedUpstoxLivePositions = () => cachedUpstoxLivePositions;
export const getCachedUpstoxLiveMargin = () => cachedUpstoxLiveMargin;
export const getLatestMultiIndexAlphaMatrix = () => latestMultiIndexAlphaMatrix;
export const getLastQuotesCache = () => lastQuotesCache;
export const getSubscribedKeys = () => subscribedKeys;

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

