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

export interface SupervisorAudit {
  complianceScore: number;
  lastAiSupervisorDeepReport?: AiDeepReport | null;
  [key: string]: any;
}
