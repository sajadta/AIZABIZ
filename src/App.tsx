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
import { useChartTradeContextSync, useCandleTickSync } from './hooks/useAppChartSync';
import { Header } from './components/Header';
import { TickerBar } from './components/TickerBar';
import { Watchlist } from './components/Watchlist';
import { AppTopSections } from './components/app/AppTopSections';
import { AppInspectionBanner } from './components/app/AppInspectionBanner';
import { AppIpWhitelistNotice } from './components/app/AppIpWhitelistNotice';
import { AppDesktopNav } from './components/app/AppDesktopNav';
import { AppTabContent } from './components/app/AppTabContent';
import { AppMobileNav } from './components/app/AppMobileNav';
import { AppModals } from './components/app/AppModals';
import { AppConfirmDialogs } from './components/app/AppConfirmDialogs';
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
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'WATCHLIST' | 'CHART' | 'BOT' | 'OPTIONS' | 'ORDERS' | 'HOLDINGS' | 'HEATMAP' | 'AI' | 'INVEST'
  >('CHART');

  // App configurations
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
  const marketSession = useMarketSessionClock({ soundEnabled, setLightingBanner });

  // Quotes and Selection
  const [quotes, setQuotes] = useState<StockQuote[]>(INITIAL_WATCHLIST_SYMBOLS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>('NSE_INDEX|Nifty 50');
  const [chartTradeContext, setChartTradeContext] = useState<any>(null);
  const [ipCopiedNotice, setIpCopiedNotice] = useState(false);
  const [dismissedIpWarning, setDismissedIpWarning] = useState(false);

  // Chart data (100% Real Live Candles)
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [chartInterval, setChartInterval] = useState<string>('5m');
  const [activeSignal, setActiveSignal] = useState<TradingSignal | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Bot state
  const [botConfig, setBotConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
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

  // Price Alerts
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalData, setOrderModalData] = useState<{
    symbol: string;
    price: number;
    type: OrderTransactionType;
    quantity?: number;
    lotSize?: number;
    heldQuantity?: number;
    productType?: 'INTRADAY' | 'DELIVERY';
    instrumentKey?: string;
  }>({
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
      <Header
        isWsConnected={isWsConnected}
        mode={mode}
        setMode={(newMode) => {
          safeStorage.setItem('aizabiz_preferred_trading_mode', newMode);
          setMode(newMode);
          setBotConfig((prev) => {
            const updated = { ...prev, mode: newMode };
            fetch('/api/bot/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(() => {
              /* ignore */
            });
            return updated;
          });
        }}
        language={language}
        setLanguage={setLanguage}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        apiConfig={apiConfig}
        onOpenApiSettings={() => setIsApiModalOpen(true)}
        onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
        activePositionsCount={positions.length}
        onSquareOffAll={handleSquareOffAll}
        totalPnL={totalNetMtm}
        dailyProfit={todayProfit}
        cumulativeProfit={totalCumulativeProfit}
        virtualCapital={paperAccountBalance}
        onOpenAlerts={() => setIsAlertsModalOpen(true)}
        onResetPaperAccount={handleResetPaperAccount}
        botEnabled={botConfig.enabled}
        onToggleBot={() => {
          const newState = !botConfig.enabled;
          setBotConfig((prev) => {
            const updated = { ...prev, enabled: newState, dailyLossLocked: false };
            fetch('/api/bot/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(() => {
              /* ignore */
            });
            return updated;
          });
        }}
      />

      <AppTopSections
        apiConfig={apiConfig}
        language={language}
        lightingBanner={lightingBanner}
        setLightingBanner={setLightingBanner}
        triggerAlertEvent={triggerAlertEvent}
        marketSession={marketSession}
      />

      <TickerBar
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={(sym, key) => {
          setSelectedSymbol(sym);
          if (key) setSelectedInstrumentKey(key);

          // Auto-sync Algo Bot focus when clicking an index in the ticker bar
          const indexPriorityMap: Record<string, string> = {
            'NIFTY 50': 'NIFTY_50_ONLY',
            BANKNIFTY: 'BANKNIFTY_ONLY',
            SENSEX: 'SENSEX_ONLY',
            FINNIFTY: 'FINNIFTY_ONLY',
            MIDCPNIFTY: 'MIDCPNIFTY_ONLY',
            BANKEX: 'BANKEX_ONLY',
          };

          if (indexPriorityMap[sym]) {
            setBotConfig((prev) => {
              const updated = { ...prev, selectedIndexPriority: indexPriorityMap[sym] as any };
              fetch('/api/bot/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
              }).catch(() => {
                /* ignore */
              });
              return updated;
            });
          }
        }}
      />

      <AppInspectionBanner botLogs={botLogs} language={language} />

      <AppIpWhitelistNotice
        botLogs={botLogs}
        dismissedIpWarning={dismissedIpWarning}
        ipCopiedNotice={ipCopiedNotice}
        language={language}
        setDismissedIpWarning={setDismissedIpWarning}
        setIpCopiedNotice={setIpCopiedNotice}
        setIsApiModalOpen={setIsApiModalOpen}
        serverSecondaryIp={apiConfig.actualDetectedIp || apiConfig.serverSecondaryIp}
      />

      {/* 3. MAIN WORKSPACE */}
      <div className="flex flex-1 w-full max-w-full min-w-0 min-h-0 overflow-hidden">
        <div className="hidden lg:flex w-72 border-r border-slate-800/80 bg-slate-950/40 p-3 flex-col shrink-0 min-h-0">
          <Watchlist
            quotes={quotes}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym, key) => {
              setSelectedSymbol(sym);
              if (key) setSelectedInstrumentKey(key);
            }}
            language={language}
            onOpenOrderModal={(type, sym, prc) => {
              setOrderModalData({ symbol: sym, price: prc, type });
              setIsOrderModalOpen(true);
            }}
            priceAlerts={priceAlerts}
            onAddAlert={handleAddAlert}
            onRemoveAlert={handleRemoveAlert}
          />
        </div>

        <div className="flex-1 flex flex-col w-full max-w-full min-w-0 min-h-0 overflow-hidden p-1 sm:p-3">
          <AppDesktopNav
            t={t}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            botConfig={botConfig}
            currentQuote={currentQuote}
            holdings={holdings}
            positions={positions}
            selectedSymbol={selectedSymbol}
            language={language}
            setIsOrderModalOpen={setIsOrderModalOpen}
            setOrderModalData={setOrderModalData}
          />

          {/* View Container */}
          <AppTabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
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
            currentQuote={currentQuote}
            chartTradeContext={chartTradeContext}
            setChartTradeContext={setChartTradeContext}
            candles={candles}
            chartInterval={chartInterval}
            setChartInterval={setChartInterval}
            activeSignal={activeSignal}
            optionChainData={optionChainData}
            getStandardIndexLotSize={getStandardIndexLotSize}
            handleFetchGeminiAnalysis={handleFetchGeminiAnalysis}
            aiLoading={aiLoading}
            botConfig={botConfig}
            setBotConfig={setBotConfig}
            setMode={setMode}
            botLogs={botLogs}
            signals={signals}
            handleExecuteSignal={handleExecuteSignal}
            handleViewChart={handleViewChart}
            handleSquareOffPosition={handleSquareOffPosition}
            handleSquareOffAll={handleSquareOffAll}
            onSquareOffEquityOnly={handleSquareOffEquityOnly}
            positions={positions}
            holdings={holdings}
            totalNetMtm={totalNetMtm}
            fetchHoldings={fetchHoldings}
            apiConfig={apiConfig}
            setIsApiModalOpen={setIsApiModalOpen}
            handleSyncHistoryBrokerage={handleSyncHistoryBrokerage}
            optionChainLoading={optionChainLoading}
            fetchOptionChain={fetchOptionChain}
            modeOrders={modeOrders}
            modeTradeHistory={modeTradeHistory}
            geminiAnalysis={geminiAnalysis}
          />
        </div>
      </div>

      <AppMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        botConfig={botConfig}
        positions={positions}
        language={language}
      />

      <AppModals
        isOrderModalOpen={isOrderModalOpen}
        setIsOrderModalOpen={setIsOrderModalOpen}
        orderModalData={orderModalData}
        apiConfig={apiConfig}
        botConfig={botConfig}
        mode={mode}
        handlePlaceOrder={handlePlaceOrder}
        language={language}
        isApiModalOpen={isApiModalOpen}
        setIsApiModalOpen={setIsApiModalOpen}
        fetchHoldings={fetchHoldings}
        fetchLivePositions={fetchLivePositions}
        setApiConfig={setApiConfig}
        isAlertsModalOpen={isAlertsModalOpen}
        priceAlerts={priceAlerts}
        setIsAlertsModalOpen={setIsAlertsModalOpen}
        handleAddAlert={handleAddAlert}
        handleRemoveAlert={handleRemoveAlert}
        isAndroidModalOpen={isAndroidModalOpen}
        setIsAndroidModalOpen={setIsAndroidModalOpen}
        isOnboardingOpen={isOnboardingOpen}
        setIsOnboardingOpen={setIsOnboardingOpen}
        isTerminalLocked={isTerminalLocked}
        setIsTerminalLocked={setIsTerminalLocked}
        paperAccountBalance={paperAccountBalance}
      />

      <AppConfirmDialogs
        language={language}
        isResetConfirmOpen={isResetConfirmOpen}
        setIsResetConfirmOpen={setIsResetConfirmOpen}
        confirmResetPaperAccount={confirmResetPaperAccount}
        isEquityExitConfirmOpen={isEquityExitConfirmOpen}
        setIsEquityExitConfirmOpen={setIsEquityExitConfirmOpen}
        confirmSquareOffEquityOnly={confirmSquareOffEquityOnly}
      />
    </div>
  );
};

export default App;
