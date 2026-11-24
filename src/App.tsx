import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StockQuote,
  CandleData,
  TradingSignal,
  Order,
  Position,
  Holding,
  BotConfig,
  BotLog,
  UpstoxApiConfig,
  GeminiMarketAnalysis,
  OptionChainData,
  Language,
  ExecutionMode,
  PriceAlert,
  OrderTransactionType,
} from './types';
import { deduplicateQuotes, getStandardIndexLotSize } from './utils/quotes';
import { deriveCurrentQuote } from './utils/currentQuote';
import { safeStorage } from './utils/storage';
import { useBackendBotSync } from './hooks/useBackendBotSync';
import { useTradingActions } from './hooks/useTradingActions';
import { useOrderPlacement } from './hooks/useOrderPlacement';
import { useTradingDataFetchers } from './hooks/useTradingDataFetchers';
import { useGeminiAnalysis } from './hooks/useGeminiAnalysis';
import { useSignalExecution } from './hooks/useSignalExecution';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useLiveQuotes } from './hooks/useLiveQuotes';
import { useChartCandles } from './hooks/useChartCandles';
import { useLivePositionMarks } from './hooks/useLivePositionMarks';
import { useServerWakeup } from './hooks/useServerWakeup';
import { usePersistedCollections } from './hooks/usePersistedCollections';
import { translations } from './translations';
import { useAccountMetrics } from './hooks/useAccountMetrics';
import { usePriceAlerts } from './hooks/usePriceAlerts';
import { usePositionAlerts } from './hooks/usePositionAlerts';
import { useMarketSessionClock } from './hooks/useMarketSessionClock';
import { useAppUiState } from './hooks/useAppUiState';
import { useAppShellActions } from './hooks/useAppShellActions';
import { useChartTradeContextSync, useCandleTickSync } from './hooks/useAppChartSync';
import { AppChrome } from './components/app/AppChrome';
import { AppWorkspace } from './components/app/AppWorkspace';
import { AppOverlays } from './components/app/AppOverlays';
import { AppDesktopNav } from './components/app/AppDesktopNav';
import { AppTabContent } from './components/app/AppTabContent';
import {
  enrichCandlesWithIndicators,
  analyzeTradingSignals,
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from './utils/indicators';
import { soundEngine } from './utils/audioAlerts';
import { triggerAlertEvent, LightingAlertBannerState } from './utils/soundAlerts';

import { INITIAL_WATCHLIST_SYMBOLS } from './data/initialWatchlist';
import { DEFAULT_BOT_CONFIG } from './data/defaultBotConfig';

export const App: React.FC = () => {
  const {
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
  } = useAppUiState();

  const marketSession = useMarketSessionClock({ soundEnabled, setLightingBanner });

  // Quotes and Selection
  const [quotes, setQuotes] = useState<StockQuote[]>(INITIAL_WATCHLIST_SYMBOLS);

  // Chart data (100% Real Live Candles)
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [activeSignal, setActiveSignal] = useState<TradingSignal | null>(null);

  // Bot state
  const [botConfig, setBotConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);

  const { handleModeChange, handleToggleBot, handleIndexFocus } = useAppShellActions({
    setMode,
    setBotConfig,
  });
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);

  // Positions, Orders, Holdings
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>(() => {
    safeStorage.removeItem('aizabiz_persisted_orders_v2');
    const parsed = safeStorage.getJson<Order[]>('aizabiz_persisted_orders_v3');
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  });
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Position[]>(() => {
    safeStorage.removeItem('aizabiz_persisted_trade_history_v2');
    const parsed = safeStorage.getJson<Position[]>('aizabiz_persisted_trade_history_v3');
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  });

  usePersistedCollections(orders, tradeHistory);

  // Option Chain
  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
  const [optionChainLoading, setOptionChainLoading] = useState(false);

  // Gemini Market Analysis
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiMarketAnalysis | null>(null);

  // Upstox API configuration
  const [apiConfig, setApiConfig] = useState<UpstoxApiConfig>({
    apiKey: '',
    apiSecret: '',
    redirectUri: '',
    accessToken: '',
    isConnected: false,
    userName: '',
    userEmail: '',
    userClientCode: '',
    broker: 'Live Market Feed Active',
    availableMargin: 0,
    usedMargin: 0,
    utilizedMargin: 0,
    payin: 0,
    payout: 0,
    totalBalance: 0,
  });

  const lastSseQuoteAtRef = useRef<number>(0);
  const livePositionsInFlightRef = useRef<Promise<void> | null>(null);
  const lastLivePositionsAtRef = useRef<number>(0);

  // 0. Server Wakeup Heartbeat
  useServerWakeup();

  // Load configuration from API on mount & auto-restore saved Upstox daily token
  useAppBootstrap({ setMode, setBotConfig, setApiConfig, setTradeHistory });

  // Fetch real Upstox live quotes via SSE with resilient HTTP fallback
  useLiveQuotes({
    accessToken: apiConfig.accessToken,
    lastSseQuoteAtRef,
    setQuotes,
    setIsWsConnected,
  });

  // Fetch real Upstox Candlesticks & Technical Indicators
  useChartCandles({
    accessToken: apiConfig.accessToken,
    selectedSymbol,
    selectedInstrumentKey,
    chartInterval,
    setCandles,
  });

  useChartTradeContextSync({ positions, candles, chartTradeContext, setChartTradeContext });

  // Sync selected symbol's current live tick into latest candle (only if price belongs to the same instrument scale!)
  const currentQuote = deriveCurrentQuote({
    quotes,
    selectedSymbol,
    selectedInstrumentKey,
    chartTradeContext,
    positions,
    candles,
  });

  useCandleTickSync({ currentQuote, setCandles });

  // Fetch or Compute Gemini AI Market Analysis (see useGeminiAnalysis)
  const { handleFetchGeminiAnalysis } = useGeminiAnalysis({
    currentQuote,
    candles,
    optionChainData,
    mode,
    botConfig,
    apiConfig,
    chartInterval,
    soundEnabled,
    setAiLoading,
    setActiveSignal,
    setSignals,
    setGeminiAnalysis,
  });

  const { fetchOptionChain, fetchHoldings, fetchHistory, fetchLivePositions } =
    useTradingDataFetchers({
      accessToken: apiConfig.accessToken,
      isConnected: apiConfig.isConnected,
      mode,
      selectedSymbol,
      livePositionsInFlightRef,
      lastLivePositionsAtRef,
      setOptionChainLoading,
      setOptionChainData,
      setHoldings,
      setPositions,
      setOrders,
      setTradeHistory,
    });

  useEffect(() => {
    if (activeTab === 'OPTIONS') {
      fetchOptionChain(undefined, selectedSymbol);
    } else if (activeTab === 'HOLDINGS' || activeTab === 'ORDERS') {
      fetchHoldings();
      fetchLivePositions();
    }
  }, [activeTab, selectedSymbol, fetchOptionChain, fetchHoldings, fetchLivePositions]);

  // Initial and periodic sync of holdings (server holds token fallback)
  useEffect(() => {
    if (apiConfig.isConnected || apiConfig.accessToken) {
      fetchHoldings();
    }
  }, [apiConfig.isConnected, apiConfig.accessToken, fetchHoldings]);

  // Square-off, paper reset and brokerage-sync actions (see useTradingActions)
  const {
    handleSquareOffPosition,
    handleSquareOffAll,
    handleSquareOffEquityOnly,
    confirmSquareOffEquityOnly,
    handleSyncHistoryBrokerage,
    handleResetPaperAccount,
    confirmResetPaperAccount,
  } = useTradingActions({
    positions,
    mode,
    language,
    soundEnabled,
    setPositions,
    setOrders,
    setTradeHistory,
    setBotLogs,
    setLightingBanner,
    setIsResetConfirmOpen,
    setIsEquityExitConfirmOpen,
    fetchHistory,
  });

  // Order placement (see useOrderPlacement)
  const { handlePlaceOrder } = useOrderPlacement({
    mode,
    accessToken: apiConfig.accessToken || '',
    quotes,
    holdings,
    positions,
    soundEnabled,
    setOrders,
    setPositions,
    setBotLogs,
    setIsOrderModalOpen,
    squareOffPosition: handleSquareOffPosition,
    fetchHoldings,
    fetchLivePositions,
  });

  // Dedicated Option Premium & Instrument Chart Handler (Supports running positions, history, orders & holdings)
  const handleViewChart = useCallback(
    (sym: string, key?: string, context?: any) => {
      setSelectedSymbol(sym);
      setChartTradeContext(context || null);

      const isOption =
        /\b(CE|PE)\b/i.test(sym) ||
        sym.toUpperCase().endsWith('CE') ||
        sym.toUpperCase().endsWith('PE');
      if (key && (key.startsWith('NSE_FO|') || key.startsWith('BSE_FO|') || isOption)) {
        setSelectedInstrumentKey(key);
      } else if (isOption) {
        setSelectedInstrumentKey(key || `NSE_FO|${sym}`);
      } else {
        const matched = quotes.find((q) => q.symbol === sym);
        if (matched?.instrumentKey) {
          setSelectedInstrumentKey(matched.instrumentKey);
        } else if (sym.toUpperCase().includes('BANKEX')) {
          setSelectedInstrumentKey('BSE_INDEX|BANKEX');
        } else if (sym.toUpperCase().includes('SENSEX')) {
          setSelectedInstrumentKey('BSE_INDEX|SENSEX');
        } else if (sym.toUpperCase().includes('BANK')) {
          setSelectedInstrumentKey('NSE_INDEX|Nifty Bank');
        } else if (sym.toUpperCase().includes('FIN')) {
          setSelectedInstrumentKey('NSE_INDEX|Nifty Fin Service');
        } else if (sym.toUpperCase().includes('NIFTY')) {
          setSelectedInstrumentKey('NSE_INDEX|Nifty 50');
        } else {
          setSelectedInstrumentKey(key || sym);
        }
      }
      setActiveTab('CHART');
    },
    [quotes],
  );

  // Accurate PnL Calculation: Separate Today's Trading P&L vs Total Cumulative P&L
  const {
    totalNetMtm,
    modeTradeHistory,
    modeOrders,
    todayProfit,
    totalCumulativeProfit,
    paperAccountBalance,
  } = useAccountMetrics({ positions, tradeHistory, orders, mode });

  // Execute signal directly with live Upstox lot size and account capital affordability check
  const { handleExecuteSignal } = useSignalExecution({
    mode,
    availableMargin: apiConfig.availableMargin,
    maxCapitalPerTrade: botConfig.maxCapitalPerTrade,
    paperAccountBalance,
    setBotLogs,
    handlePlaceOrder,
  });

  // Price alert handlers
  const { handleAddAlert, handleRemoveAlert } = usePriceAlerts({
    quotes,
    priceAlerts,
    soundEnabled,
    setPriceAlerts,
  });

  // 1. Live update of open positions & price alerts on quotes tick
  useLivePositionMarks({ quotes, optionChainData, setPositions });

  // 2. Real-Time Backend Algo Bot Sync Loop (see useBackendBotSync)
  useBackendBotSync({
    accessToken: apiConfig.accessToken,
    selectedSymbol,
    lastLivePositionsAtRef,
    fetchLivePositions,
    setBotLogs,
    setSignals,
    setActiveSignal,
  });

  // 3. Auto-load AI analysis when switching to AI tab
  useEffect(() => {
    if (activeTab === 'AI' && !geminiAnalysis && !aiLoading) {
      handleFetchGeminiAnalysis();
    }
  }, [activeTab, geminiAnalysis, aiLoading, handleFetchGeminiAnalysis]);

  // 5. Multi-Tier Audio & Visual Lighting Alert Monitor for Positions & Holdings
  usePositionAlerts({ positions, holdings, soundEnabled, setLightingBanner });

  // Auto-dismiss lighting alert banner after 8 seconds
  useEffect(() => {
    if (!lightingBanner) return;
    const tId = setTimeout(() => setLightingBanner(null), 8000);
    return () => clearTimeout(tId);
  }, [lightingBanner]);

  const t = translations[language];
  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] w-full max-w-full bg-[#070a12] text-slate-100 overflow-hidden font-sans select-none">
      <AppChrome
        header={{
          isWsConnected,
          mode,
          language,
          setLanguage,
          soundEnabled,
          setSoundEnabled,
          apiConfig,
          activePositionsCount: positions.length,
          onSquareOffAll: handleSquareOffAll,
          totalPnL: totalNetMtm,
          dailyProfit: todayProfit,
          cumulativeProfit: totalCumulativeProfit,
          virtualCapital: paperAccountBalance,
          onResetPaperAccount: handleResetPaperAccount,
          botEnabled: botConfig.enabled,
        }}
        onModeChange={handleModeChange}
        onOpenApiSettings={() => setIsApiModalOpen(true)}
        onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
        onOpenAlerts={() => setIsAlertsModalOpen(true)}
        onToggleBot={handleToggleBot}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        topSections={{
          apiConfig,
          language,
          lightingBanner,
          setLightingBanner,
          triggerAlertEvent,
          marketSession,
        }}
        tickerBar={{
          quotes,
          selectedSymbol,
          onSelectSymbol: (sym, key) => {
            setSelectedSymbol(sym);
            if (key) setSelectedInstrumentKey(key);
            handleIndexFocus(sym);
          },
        }}
        inspection={{ botLogs, language }}
        ipNotice={{
          botLogs,
          dismissedIpWarning,
          ipCopiedNotice,
          language,
          setDismissedIpWarning,
          setIpCopiedNotice,
          serverSecondaryIp: apiConfig.actualDetectedIp || apiConfig.serverSecondaryIp,
        }}
      />

      {/* 3. MAIN WORKSPACE */}
      <AppWorkspace
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        setSelectedSymbol={setSelectedSymbol}
        setSelectedInstrumentKey={setSelectedInstrumentKey}
        language={language}
        setOrderModalData={setOrderModalData}
        setIsOrderModalOpen={setIsOrderModalOpen}
        priceAlerts={priceAlerts}
        handleAddAlert={handleAddAlert}
        handleRemoveAlert={handleRemoveAlert}
        desktopNav={{
          t,
          activeTab,
          setActiveTab,
          botConfig,
          currentQuote,
          holdings,
          positions,
          selectedSymbol,
          language,
        }}
        tabContent={{
          activeTab,
          setActiveTab,
          currentQuote,
          chartTradeContext,
          setChartTradeContext,
          candles,
          chartInterval,
          setChartInterval,
          activeSignal,
          optionChainData,
          getStandardIndexLotSize,
          handleFetchGeminiAnalysis,
          aiLoading,
          botConfig,
          setBotConfig,
          setMode,
          botLogs,
          signals,
          handleExecuteSignal,
          handleViewChart,
          handleSquareOffPosition,
          handleSquareOffAll,
          onSquareOffEquityOnly: handleSquareOffEquityOnly,
          positions,
          holdings,
          totalNetMtm,
          fetchHoldings,
          apiConfig,
          setIsApiModalOpen,
          handleSyncHistoryBrokerage,
          optionChainLoading,
          fetchOptionChain,
          modeOrders,
          modeTradeHistory,
          geminiAnalysis,
        }}
      />

      <AppOverlays
        mobileNav={{ activeTab, setActiveTab, botConfig, positions, language }}
        modals={{
          isOrderModalOpen,
          setIsOrderModalOpen,
          orderModalData,
          apiConfig,
          botConfig,
          mode,
          handlePlaceOrder,
          language,
          isApiModalOpen,
          setIsApiModalOpen,
          fetchHoldings,
          fetchLivePositions,
          setApiConfig,
          isAlertsModalOpen,
          priceAlerts,
          setIsAlertsModalOpen,
          handleAddAlert,
          handleRemoveAlert,
          isAndroidModalOpen,
          setIsAndroidModalOpen,
          isOnboardingOpen,
          setIsOnboardingOpen,
          isTerminalLocked,
          setIsTerminalLocked,
          paperAccountBalance,
        }}
        confirmDialogs={{
          language,
          isResetConfirmOpen,
          setIsResetConfirmOpen,
          confirmResetPaperAccount,
          isEquityExitConfirmOpen,
          setIsEquityExitConfirmOpen,
          confirmSquareOffEquityOnly,
        }}
      />
    </div>
  );
};

export default App;
