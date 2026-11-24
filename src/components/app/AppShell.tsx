// Presentational shell for the app: page frame, chrome, workspace and overlays.
import React from 'react';
import { AppChrome } from './AppChrome';
import { AppWorkspace } from './AppWorkspace';
import { AppOverlays } from './AppOverlays';

export interface AppShellProps {
  [key: string]: any;
}

export const AppShell: React.FC<AppShellProps> = (props) => {
  const {
    t,
    isWsConnected,
    mode,
    language,
    setLanguage,
    soundEnabled,
    setSoundEnabled,
    apiConfig,
    positions,
    handleSquareOffAll,
    totalNetMtm,
    todayProfit,
    totalCumulativeProfit,
    paperAccountBalance,
    handleResetPaperAccount,
    botConfig,
    handleModeChange,
    setIsApiModalOpen,
    setIsAndroidModalOpen,
    setIsAlertsModalOpen,
    handleToggleBot,
    lightingBanner,
    setLightingBanner,
    triggerAlertEvent,
    marketSession,
    quotes,
    selectedSymbol,
    setSelectedSymbol,
    setSelectedInstrumentKey,
    handleIndexFocus,
    botLogs,
    dismissedIpWarning,
    ipCopiedNotice,
    setDismissedIpWarning,
    setIpCopiedNotice,
    setOrderModalData,
    setIsOrderModalOpen,
    priceAlerts,
    handleAddAlert,
    handleRemoveAlert,
    activeTab,
    setActiveTab,
    currentQuote,
    holdings,
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
    setBotConfig,
    setMode,
    signals,
    handleExecuteSignal,
    handleViewChart,
    handleSquareOffPosition,
    handleSquareOffEquityOnly,
    fetchHoldings,
    handleSyncHistoryBrokerage,
    optionChainLoading,
    fetchOptionChain,
    modeOrders,
    modeTradeHistory,
    geminiAnalysis,
    orderModalData,
    handlePlaceOrder,
    fetchLivePositions,
    setApiConfig,
    isApiModalOpen,
    isOrderModalOpen,
    isAlertsModalOpen,
    isAndroidModalOpen,
    setIsOnboardingOpen,
    isOnboardingOpen,
    isTerminalLocked,
    setIsTerminalLocked,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    confirmResetPaperAccount,
    isEquityExitConfirmOpen,
    setIsEquityExitConfirmOpen,
    confirmSquareOffEquityOnly,
  } = props;

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
