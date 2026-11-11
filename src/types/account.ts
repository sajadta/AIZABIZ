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
