import { translations } from '../../translations';
import type { Language } from '../../types';

export type Translations = (typeof translations)[Language];
export type TabKey =
  'SIGNALS' | 'AI_SUPERVISOR' | 'INSTITUTIONAL' | 'SETTINGS' | 'BACKTEST' | 'TELEGRAM' | 'LOGS';

export interface TickerStep {
  title: string;
  badge: string;
  text: string;
}

export interface AiDeepReport {
  timestamp?: string;
  summaryMl?: string;
  summaryEn?: string;
  rootCauseMl?: string;
  rootCauseEn?: string;
  actionableUpgradesMl?: string[];
  actionableUpgradesEn?: string[];
}

export interface SupervisorActivePosition {
  symbol: string;
  buyPrice: number;
  currentLTP: number;
  highestLTP: number;
  autoStopLoss?: number;
  autoTarget?: number;
  currentNetProfit: number;
}

export interface SupervisorAutoHealEntry {
  id: string;
  time?: string;
  problemMl: string;
  autoActionMl: string;
  beforeValue?: string | number;
  afterValue?: string | number;
}

export interface SupervisorDirective {
  id: string;
  titleMl: string;
  titleEn: string;
  status: 'ACTIVE_OK' | 'ATTENTION' | string;
  detailMl: string;
}

export interface SupervisorTradeDiagnostic {
  id?: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  peakLTP: number;
  netPnL: number;
  diagnosisMl: string;
  fixStatusMl?: string;
}

export interface SupervisorConfig {
  stopLossPercent?: number;
  trailingStopLoss?: number;
  minConfidence?: number;
  minOptionProfitAmount?: number;
}

export interface SupervisorPerformanceSummary {
  winCount?: number;
  lossCount?: number;
  netPnLTotal?: number;
  peakCaptureEfficiencyPct?: number;
}

export interface SupervisorAudit {
  complianceScore: number;
  lastAiSupervisorDeepReport?: AiDeepReport | null;
  activePositionsAudit?: SupervisorActivePosition[];
  autoHealHistory?: SupervisorAutoHealEntry[];
  directiveChecklist?: SupervisorDirective[];
  tradeDiagnostics?: SupervisorTradeDiagnostic[];
  currentVerifiedConfig?: SupervisorConfig;
  performanceSummary?: SupervisorPerformanceSummary;
  lastEngineTickAt?: string;
  engineHeartbeatTicks?: number;
}
