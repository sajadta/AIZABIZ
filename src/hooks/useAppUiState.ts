import { useState } from 'react';
import type { ExecutionMode, Language, OrderTransactionType, PriceAlert } from '../types';
import { safeStorage } from '../utils/storage';
import type { LightingAlertBannerState } from '../utils/soundAlerts';

export type TabKey =
  'WATCHLIST' | 'CHART' | 'BOT' | 'OPTIONS' | 'ORDERS' | 'HOLDINGS' | 'HEATMAP' | 'AI' | 'INVEST';

export interface OrderModalState {
  symbol: string;
  price: number;
  type: OrderTransactionType;
  quantity?: number;
  lotSize?: number;
  heldQuantity?: number;
  productType?: 'INTRADAY' | 'DELIVERY';
  instrumentKey?: string;
}

/** UI-only state for the app shell: navigation, selection, chart view and modals. */
export function useAppUiState() {
  const [activeTab, setActiveTab] = useState<TabKey>('CHART');

  const [language, setLanguage] = useState<Language>('ml');
  const [mode, setMode] = useState<ExecutionMode>(() => {
    const savedMode = safeStorage.getItem('aizabiz_preferred_trading_mode');
    if (savedMode === 'PAPER_TRADING' || savedMode === 'UPSTOX_LIVE') {
      return savedMode;
    }
    return 'PAPER_TRADING';
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [lightingBanner, setLightingBanner] = useState<LightingAlertBannerState | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>('NSE_INDEX|Nifty 50');
  const [chartTradeContext, setChartTradeContext] = useState<any>(null);
  const [ipCopiedNotice, setIpCopiedNotice] = useState(false);
  const [dismissedIpWarning, setDismissedIpWarning] = useState(false);

  const [chartInterval, setChartInterval] = useState<string>('5m');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalData, setOrderModalData] = useState<OrderModalState>({
    symbol: 'NIFTY 50',
    price: 0,
    type: 'BUY',
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isEquityExitConfirmOpen, setIsEquityExitConfirmOpen] = useState(false);
  const [isTerminalLocked, setIsTerminalLocked] = useState(() => {
    return safeStorage.getItem('aizabiz_master_unlocked') !== 'true';
  });

  return {
    activeTab,
    setActiveTab,
    language,
    setLanguage,
    mode,
    setMode,
    soundEnabled,
    setSoundEnabled,
    isWsConnected,
    setIsWsConnected,
    lightingBanner,
    setLightingBanner,
    selectedSymbol,
    setSelectedSymbol,
    selectedInstrumentKey,
    setSelectedInstrumentKey,
    chartTradeContext,
    setChartTradeContext,
    ipCopiedNotice,
    setIpCopiedNotice,
    dismissedIpWarning,
    setDismissedIpWarning,
    chartInterval,
    setChartInterval,
    aiLoading,
    setAiLoading,
    priceAlerts,
    setPriceAlerts,
    isOrderModalOpen,
    setIsOrderModalOpen,
    orderModalData,
    setOrderModalData,
    isApiModalOpen,
    setIsApiModalOpen,
    isAlertsModalOpen,
    setIsAlertsModalOpen,
    isAndroidModalOpen,
    setIsAndroidModalOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    isEquityExitConfirmOpen,
    setIsEquityExitConfirmOpen,
    isTerminalLocked,
    setIsTerminalLocked,
  };
}
