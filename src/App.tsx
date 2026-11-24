import React, { useState, useEffect, useRef } from 'react';
import { BotConfig, BotLog, TradingSignal } from './types';
import { getStandardIndexLotSize } from './utils/quotes';
import { deriveCurrentQuote } from './utils/currentQuote';
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
import { translations } from './translations';
import { useAccountMetrics } from './hooks/useAccountMetrics';
import { usePriceAlerts } from './hooks/usePriceAlerts';
import { usePositionAlerts } from './hooks/usePositionAlerts';
import { useMarketSessionClock } from './hooks/useMarketSessionClock';
import { useAppUiState } from './hooks/useAppUiState';
import { useAppShellActions } from './hooks/useAppShellActions';
import { useTradingState } from './hooks/useTradingState';
import { useAppChartFocus } from './hooks/useAppChartFocus';
import { useChartTradeContextSync, useCandleTickSync } from './hooks/useAppChartSync';
import { AppShell } from './components/app/AppShell';
import { triggerAlertEvent } from './utils/soundAlerts';

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

  const {
    quotes,
    setQuotes,
    candles,
    setCandles,
    activeSignal,
    setActiveSignal,
    positions,
    setPositions,
    orders,
    setOrders,
    holdings,
    setHoldings,
    tradeHistory,
    setTradeHistory,
    optionChainData,
    setOptionChainData,
    optionChainLoading,
    setOptionChainLoading,
    geminiAnalysis,
    setGeminiAnalysis,
    apiConfig,
    setApiConfig,
  } = useTradingState();

  // Bot state
  const [botConfig, setBotConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);

  const { handleModeChange, handleToggleBot, handleIndexFocus } = useAppShellActions({
    setMode,
    setBotConfig,
  });
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);

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

  // Dedicated Option Premium & Instrument Chart Handler (see useAppChartFocus)
  const handleViewChart = useAppChartFocus({
    quotes,
    setSelectedSymbol,
    setSelectedInstrumentKey,
    setChartTradeContext,
    setActiveTab,
  });

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
    <AppShell
      t={t}
      isWsConnected={isWsConnected}
      mode={mode}
      language={language}
      setLanguage={setLanguage}
      soundEnabled={soundEnabled}
      setSoundEnabled={setSoundEnabled}
      apiConfig={apiConfig}
      positions={positions}
      handleSquareOffAll={handleSquareOffAll}
      totalNetMtm={totalNetMtm}
      todayProfit={todayProfit}
      totalCumulativeProfit={totalCumulativeProfit}
      paperAccountBalance={paperAccountBalance}
      handleResetPaperAccount={handleResetPaperAccount}
      botConfig={botConfig}
      handleModeChange={handleModeChange}
      setIsApiModalOpen={setIsApiModalOpen}
      setIsAndroidModalOpen={setIsAndroidModalOpen}
      setIsAlertsModalOpen={setIsAlertsModalOpen}
      handleToggleBot={handleToggleBot}
      lightingBanner={lightingBanner}
      setLightingBanner={setLightingBanner}
      triggerAlertEvent={triggerAlertEvent}
      marketSession={marketSession}
      quotes={quotes}
      selectedSymbol={selectedSymbol}
      setSelectedSymbol={setSelectedSymbol}
      setSelectedInstrumentKey={setSelectedInstrumentKey}
      handleIndexFocus={handleIndexFocus}
      botLogs={botLogs}
      dismissedIpWarning={dismissedIpWarning}
      ipCopiedNotice={ipCopiedNotice}
      setDismissedIpWarning={setDismissedIpWarning}
      setIpCopiedNotice={setIpCopiedNotice}
      setOrderModalData={setOrderModalData}
      setIsOrderModalOpen={setIsOrderModalOpen}
      priceAlerts={priceAlerts}
      handleAddAlert={handleAddAlert}
      handleRemoveAlert={handleRemoveAlert}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      currentQuote={currentQuote}
      holdings={holdings}
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
      setBotConfig={setBotConfig}
      setMode={setMode}
      signals={signals}
      handleExecuteSignal={handleExecuteSignal}
      handleViewChart={handleViewChart}
      handleSquareOffPosition={handleSquareOffPosition}
      handleSquareOffEquityOnly={handleSquareOffEquityOnly}
      fetchHoldings={fetchHoldings}
      handleSyncHistoryBrokerage={handleSyncHistoryBrokerage}
      optionChainLoading={optionChainLoading}
      fetchOptionChain={fetchOptionChain}
      modeOrders={modeOrders}
      modeTradeHistory={modeTradeHistory}
      geminiAnalysis={geminiAnalysis}
      orderModalData={orderModalData}
      handlePlaceOrder={handlePlaceOrder}
      fetchLivePositions={fetchLivePositions}
      setApiConfig={setApiConfig}
      isApiModalOpen={isApiModalOpen}
      isOrderModalOpen={isOrderModalOpen}
      isAlertsModalOpen={isAlertsModalOpen}
      isAndroidModalOpen={isAndroidModalOpen}
      setIsOnboardingOpen={setIsOnboardingOpen}
      isOnboardingOpen={isOnboardingOpen}
      isTerminalLocked={isTerminalLocked}
      setIsTerminalLocked={setIsTerminalLocked}
      isResetConfirmOpen={isResetConfirmOpen}
      setIsResetConfirmOpen={setIsResetConfirmOpen}
      confirmResetPaperAccount={confirmResetPaperAccount}
      isEquityExitConfirmOpen={isEquityExitConfirmOpen}
      setIsEquityExitConfirmOpen={setIsEquityExitConfirmOpen}
      confirmSquareOffEquityOnly={confirmSquareOffEquityOnly}
    />
  );
};

export default App;
