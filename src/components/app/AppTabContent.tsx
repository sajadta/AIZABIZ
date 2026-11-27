import React from 'react';
import { WatchlistTab } from './tabs/WatchlistTab';
import { ChartTab } from './tabs/ChartTab';
import { BotTab } from './tabs/BotTab';
import { OptionsTab } from './tabs/OptionsTab';
import { OrdersTab } from './tabs/OrdersTab';
import { HoldingsTab } from './tabs/HoldingsTab';
import { HeatmapTab } from './tabs/HeatmapTab';
import { AiTab } from './tabs/AiTab';
import { InvestTab } from './tabs/InvestTab';
import type {
  BotConfig,
  BotLog,
  CandleData,
  ChartTradeContext,
  ExecutionMode,
  GeminiMarketAnalysis,
  Holding,
  Language,
  OptionChainData,
  Order,
  Position,
  PriceAlert,
  StockQuote,
  TradingSignal,
  UpstoxApiConfig,
} from '../../types';
import { getStandardIndexLotSize } from '../../utils/quotes';
import type { OrderModalData, TabKey } from './types';

interface AppTabContentProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  quotes: StockQuote[];
  selectedSymbol: string;
  setSelectedSymbol: (v: string) => void;
  setSelectedInstrumentKey: (v: string) => void;
  language: Language;
  setOrderModalData: (v: OrderModalData) => void;
  setIsOrderModalOpen: (v: boolean) => void;
  priceAlerts: PriceAlert[];
  handleAddAlert: (
    symbol: string,
    instrumentKey: string,
    targetPrice: number,
    condition: 'GREATER_THAN' | 'LESS_THAN',
  ) => void;
  handleRemoveAlert: (id: string) => void;
  currentQuote: StockQuote;
  chartTradeContext?: ChartTradeContext | null;
  setChartTradeContext: (v: ChartTradeContext | null) => void;
  candles: CandleData[];
  chartInterval: string;
  setChartInterval: (v: string) => void;
  activeSignal?: TradingSignal | null;
  optionChainData: OptionChainData | null;
  getStandardIndexLotSize: typeof getStandardIndexLotSize;
  handleFetchGeminiAnalysis: () => Promise<void>;
  aiLoading: boolean;
  botConfig: BotConfig;
  setBotConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  setMode: React.Dispatch<React.SetStateAction<ExecutionMode>>;
  botLogs: BotLog[];
  signals: TradingSignal[];
  handleExecuteSignal: (sig: TradingSignal) => Promise<void>;
  handleViewChart: (sym: string, key?: string, context?: ChartTradeContext) => void;
  handleSquareOffPosition: (id: string) => Promise<void>;
  handleSquareOffAll: () => void;
  onSquareOffEquityOnly?: () => void;
  positions: Position[];
  holdings: Holding[];
  totalNetMtm: number;
  fetchHoldings: () => Promise<void>;
  apiConfig: UpstoxApiConfig;
  setIsApiModalOpen: (v: boolean) => void;
  handleSyncHistoryBrokerage: () => Promise<void>;
  optionChainLoading: boolean;
  fetchOptionChain: (expiryOverride?: string, symbolOverride?: string) => Promise<void>;
  modeOrders: Order[];
  modeTradeHistory: Position[];
  geminiAnalysis: GeminiMarketAnalysis | null;
}

export const AppTabContent: React.FC<AppTabContentProps> = ({
  activeTab,
  setActiveTab,
  quotes,
  selectedSymbol,
  setSelectedSymbol,
  setSelectedInstrumentKey,
  language,
  setOrderModalData,
  setIsOrderModalOpen,
  priceAlerts,
  handleAddAlert,
  handleRemoveAlert,
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
  onSquareOffEquityOnly,
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
}) => (
  <>
    <div className="flex-1 w-full max-w-full min-w-0 min-h-0 overflow-hidden relative">
      {activeTab === 'WATCHLIST' && (
        <WatchlistTab
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
        />
      )}

      {activeTab === 'CHART' && (
        <ChartTab
          setActiveTab={setActiveTab}
          selectedSymbol={selectedSymbol}
          language={language}
          setOrderModalData={setOrderModalData}
          setIsOrderModalOpen={setIsOrderModalOpen}
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
        />
      )}

      {activeTab === 'BOT' && (
        <BotTab
          quotes={quotes}
          selectedSymbol={selectedSymbol}
          setSelectedSymbol={setSelectedSymbol}
          setSelectedInstrumentKey={setSelectedInstrumentKey}
          language={language}
          setOrderModalData={setOrderModalData}
          setIsOrderModalOpen={setIsOrderModalOpen}
          activeSignal={activeSignal}
          optionChainData={optionChainData}
          botConfig={botConfig}
          setBotConfig={setBotConfig}
          setMode={setMode}
          botLogs={botLogs}
          signals={signals}
          handleExecuteSignal={handleExecuteSignal}
          modeTradeHistory={modeTradeHistory}
        />
      )}

      {activeTab === 'OPTIONS' && (
        <OptionsTab
          quotes={quotes}
          selectedSymbol={selectedSymbol}
          setSelectedSymbol={setSelectedSymbol}
          setSelectedInstrumentKey={setSelectedInstrumentKey}
          language={language}
          setOrderModalData={setOrderModalData}
          setIsOrderModalOpen={setIsOrderModalOpen}
          optionChainData={optionChainData}
          handleViewChart={handleViewChart}
          optionChainLoading={optionChainLoading}
          fetchOptionChain={fetchOptionChain}
        />
      )}

      {activeTab === 'ORDERS' && (
        <OrdersTab
          language={language}
          setOrderModalData={setOrderModalData}
          setIsOrderModalOpen={setIsOrderModalOpen}
          handleViewChart={handleViewChart}
          handleSquareOffPosition={handleSquareOffPosition}
          handleSquareOffAll={handleSquareOffAll}
          onSquareOffEquityOnly={onSquareOffEquityOnly}
          positions={positions}
          holdings={holdings}
          totalNetMtm={totalNetMtm}
          fetchHoldings={fetchHoldings}
          apiConfig={apiConfig}
          setIsApiModalOpen={setIsApiModalOpen}
          handleSyncHistoryBrokerage={handleSyncHistoryBrokerage}
          modeOrders={modeOrders}
          modeTradeHistory={modeTradeHistory}
        />
      )}

      {activeTab === 'HOLDINGS' && (
        <HoldingsTab
          language={language}
          setOrderModalData={setOrderModalData}
          setIsOrderModalOpen={setIsOrderModalOpen}
          handleViewChart={handleViewChart}
          handleSquareOffPosition={handleSquareOffPosition}
          handleSquareOffAll={handleSquareOffAll}
          onSquareOffEquityOnly={onSquareOffEquityOnly}
          positions={positions}
          holdings={holdings}
          totalNetMtm={totalNetMtm}
          fetchHoldings={fetchHoldings}
          apiConfig={apiConfig}
          setIsApiModalOpen={setIsApiModalOpen}
          handleSyncHistoryBrokerage={handleSyncHistoryBrokerage}
          modeOrders={modeOrders}
          modeTradeHistory={modeTradeHistory}
        />
      )}

      {activeTab === 'HEATMAP' && <HeatmapTab quotes={quotes} />}

      {activeTab === 'AI' && (
        <AiTab
          quotes={quotes}
          selectedSymbol={selectedSymbol}
          language={language}
          handleFetchGeminiAnalysis={handleFetchGeminiAnalysis}
          aiLoading={aiLoading}
          apiConfig={apiConfig}
          geminiAnalysis={geminiAnalysis}
        />
      )}

      {activeTab === 'INVEST' && <InvestTab language={language} />}
    </div>
  </>
);
