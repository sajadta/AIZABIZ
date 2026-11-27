import React, { useState, useEffect } from 'react';
import {
  BotConfig,
  BotLog,
  TradingSignal,
  Language,
  OptionChainData,
  StockQuote,
  Position,
} from '../types';
import { translations } from '../translations';
import {
  hudTickerStepsEn,
  hudTickerStepsMl,
  scanMessagesEn,
  scanMessagesMl,
} from './algobot/panelCopy';
import { useMultiIndexAlpha } from './algobot/useMultiIndexAlpha';
import { useSupervisorAudit } from './algobot/useSupervisorAudit';

import { AlgoBotHeader } from './algobot/AlgoBotHeader';
import { AlgoBotTabs } from './algobot/AlgoBotTabs';
import { SignalsTab } from './algobot/SignalsTab';
import { AiSupervisorTab } from './algobot/AiSupervisorTab';
import { InstitutionalTab } from './algobot/InstitutionalTab';
import { SettingsTab } from './algobot/SettingsTab';
import { BacktestTab } from './algobot/BacktestTab';
import { TelegramTab } from './algobot/TelegramTab';
import { LogsTab } from './algobot/LogsTab';

interface AlgoBotPanelProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  botLogs: BotLog[];
  signals: TradingSignal[];
  language: Language;
  onExecuteSignal: (signal: TradingSignal) => void;
  optionChainData?: OptionChainData | null;
  quotes?: StockQuote[];
  tradeHistory?: Position[];
  activeSignal?: TradingSignal | null;
  onSelectOptionTrade?: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
  selectedSymbol?: string;
}

export const AlgoBotPanel: React.FC<AlgoBotPanelProps> = ({
  botConfig,
  onUpdateBotConfig,
  botLogs,
  signals,
  language,
  onExecuteSignal,
  optionChainData = null,
  quotes = [],
  tradeHistory = [],
  activeSignal = null,
  onSelectOptionTrade,
  onSelectSymbol,
  selectedSymbol = '',
}) => {
  const t = translations[language];
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const [hudTickerIndex, setHudTickerIndex] = useState(0);
  const [showIndexIntelligence, setShowIndexIntelligence] = useState(false);
  const { multiIndexData } = useMultiIndexAlpha();

  useEffect(() => {
    const timer = setInterval(() => {
      setHudTickerIndex((prev) => (prev + 1) % 6);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!botConfig.enabled) return;
    const interval = setInterval(() => {
      setScanMessageIndex((prev) => (prev + 1) % 8);
    }, 2800);
    return () => clearInterval(interval);
  }, [botConfig.enabled]);

  const [activeTab, setActiveTab] = useState<
    'SIGNALS' | 'AI_SUPERVISOR' | 'INSTITUTIONAL' | 'SETTINGS' | 'BACKTEST' | 'TELEGRAM' | 'LOGS'
  >('SIGNALS');
  const {
    supervisorAudit,
    deepAiScanning,
    supervisorQuestion,
    setSupervisorQuestion,
    handleRunDeepAiSupervisorScan,
    testAlertSending,
    testAlertResult,
    handleSendTestTelegramAlert,
  } = useSupervisorAudit({ activeTab, botConfig, language });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AlgoBotHeader
        t={t}
        botConfig={botConfig}
        onUpdateBotConfig={onUpdateBotConfig}
        language={language}
      />

      <AlgoBotTabs
        t={t}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        supervisorAudit={supervisorAudit}
        botConfig={botConfig}
        signals={signals}
        language={language}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto smooth-scroll overscroll-contain p-2.5 sm:p-4 pb-36 sm:pb-8">
        {activeTab === 'SIGNALS' && (
          <SignalsTab
            t={t}
            botConfig={botConfig}
            onUpdateBotConfig={onUpdateBotConfig}
            signals={signals}
            language={language}
            scanMessageIndex={scanMessageIndex}
            multiIndexData={multiIndexData}
            showIndexIntelligence={showIndexIntelligence}
            setShowIndexIntelligence={setShowIndexIntelligence}
            scanMessagesEn={scanMessagesEn}
            scanMessagesMl={scanMessagesMl}
            onExecuteSignal={onExecuteSignal}
            quotes={quotes}
            onSelectOptionTrade={onSelectOptionTrade}
            onSelectSymbol={onSelectSymbol}
            selectedSymbol={selectedSymbol}
          />
        )}

        {activeTab === 'AI_SUPERVISOR' && (
          <AiSupervisorTab
            supervisorAudit={supervisorAudit}
            botConfig={botConfig}
            language={language}
            deepAiScanning={deepAiScanning}
            supervisorQuestion={supervisorQuestion}
            handleRunDeepAiSupervisorScan={handleRunDeepAiSupervisorScan}
            setSupervisorQuestion={setSupervisorQuestion}
          />
        )}

        {activeTab === 'INSTITUTIONAL' && (
          <InstitutionalTab
            signals={signals}
            language={language}
            quotes={quotes}
            optionChainData={optionChainData}
            activeSignal={activeSignal}
          />
        )}

        {activeTab === 'SETTINGS' && (
          <SettingsTab
            botConfig={botConfig}
            onUpdateBotConfig={onUpdateBotConfig}
            language={language}
            quotes={quotes}
            hudTickerIndex={hudTickerIndex}
            hudTickerStepsMl={hudTickerStepsMl}
            hudTickerStepsEn={hudTickerStepsEn}
          />
        )}

        {activeTab === 'BACKTEST' && (
          <BacktestTab language={language} tradeHistory={tradeHistory} />
        )}

        {activeTab === 'TELEGRAM' && (
          <TelegramTab
            botConfig={botConfig}
            onUpdateBotConfig={onUpdateBotConfig}
            language={language}
            handleSendTestTelegramAlert={handleSendTestTelegramAlert}
            testAlertSending={testAlertSending}
            testAlertResult={testAlertResult}
          />
        )}

        {activeTab === 'LOGS' && <LogsTab language={language} botLogs={botLogs} />}
      </div>
    </div>
  );
};
