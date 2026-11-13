import React from 'react';
import { Watchlist } from '../Watchlist';
import { CandlestickChart } from '../CandlestickChart';
import { AlgoBotPanel } from '../AlgoBotPanel';
import { OptionChainView } from '../OptionChainView';
import { OrderBookPositions } from '../OrderBookPositions';
import { MarketHeatmap } from '../MarketHeatmap';
import { GeminiAiAdvisor } from '../GeminiAiAdvisor';
import { LiveAiSupport } from '../LiveAiSupport';
import { AdvancedAnalytics } from '../AdvancedAnalytics';
import { CumulativePnLChart } from '../CumulativePnLChart';
import { PerformanceOverviewCard } from '../PerformanceOverviewCard';
import { ErrorBoundary } from '../ErrorBoundary';
import { InvestmentPortal } from '../InvestmentPortal';
import type {
  BotConfig,
  BotLog,
  CandleData,
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
  chartTradeContext?: any;
  setChartTradeContext: (v: any) => void;
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
  handleViewChart: (sym: string, key?: string, context?: any) => void;
  handleSquareOffPosition: (id: string) => Promise<void>;
  handleSquareOffAll: () => void;
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
        <div className="h-full w-full max-w-full min-w-0 overflow-hidden p-1 sm:p-2 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <Watchlist
            quotes={quotes}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym, key) => {
              setSelectedSymbol(sym);
              if (key) setSelectedInstrumentKey(key);
              setActiveTab('CHART');
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
      )}

      {activeTab === 'CHART' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-hidden flex flex-col">
          {chartTradeContext && (
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-500/40 px-3 py-2 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2 shadow-md">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                    chartTradeContext.isOption !== false
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {chartTradeContext.isOption !== false
                    ? '🎯 OPTION PREMIUM CHART'
                    : '📈 INSTRUMENT CHART'}
                </span>
                <strong className="text-white font-mono text-sm">
                  {chartTradeContext.symbol || selectedSymbol}
                </strong>
                {chartTradeContext.buyPrice && (
                  <span className="text-slate-300 font-mono text-xs">
                    {language === 'ml' ? 'വാങ്ങിയത്' : 'Entry'}:{' '}
                    <strong className="text-slate-100">
                      ₹{chartTradeContext.buyPrice.toFixed(2)}
                    </strong>
                  </span>
                )}
                {chartTradeContext.target && (
                  <span className="text-emerald-400 font-mono text-xs">
                    {language === 'ml' ? 'ടാർഗെറ്റ്' : 'Target'}:{' '}
                    <strong>₹{chartTradeContext.target.toFixed(2)}</strong>
                  </span>
                )}
                {chartTradeContext.stopLoss && (
                  <span className="text-rose-400 font-mono text-xs">
                    {language === 'ml' ? 'സ്റ്റോപ്പ് ലോസ്' : 'SL'}:{' '}
                    <strong>₹{chartTradeContext.stopLoss.toFixed(2)}</strong>
                  </span>
                )}
                {chartTradeContext.currentLTP && (
                  <span className="text-cyan-300 font-mono text-xs">
                    LTP: <strong>₹{chartTradeContext.currentLTP.toFixed(2)}</strong>
                  </span>
                )}
                {chartTradeContext.pnl !== undefined && (
                  <span
                    className={`font-mono text-xs font-bold ${chartTradeContext.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    P&L: {chartTradeContext.pnl >= 0 ? '+' : ''}₹
                    {Number(chartTradeContext.pnl).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChartTradeContext(null);
                    setActiveTab('ORDERS');
                  }}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <span>⬅️ {language === 'ml' ? 'തിരികെ ഓർഡറുകളിലേക്ക്' : 'Back to Orders'}</span>
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 w-full max-w-full min-w-0 overflow-hidden">
            <CandlestickChart
              symbol={selectedSymbol}
              quote={currentQuote}
              candles={candles}
              interval={chartInterval}
              onChangeInterval={setChartInterval}
              language={language}
              onOpenOrderModal={(type, sym, prc) => {
                const isIndex =
                  sym.includes('INDEX') ||
                  sym.includes('NIFTY') ||
                  sym.includes('SENSEX') ||
                  sym.includes('BANKEX');
                if (isIndex && activeSignal?.recommendedOptionStrike?.optionSymbol) {
                  const opt = activeSignal.recommendedOptionStrike;
                  const stdLot = getStandardIndexLotSize(opt.optionSymbol || selectedSymbol);
                  setOrderModalData({
                    symbol: opt.optionSymbol || selectedSymbol,
                    price: opt.ltp || activeSignal.price || 100,
                    type: 'BUY',
                    instrumentKey: opt.instrumentKey || activeSignal.instrumentKey,
                    quantity: opt.lotSize || stdLot,
                    lotSize: opt.lotSize || stdLot,
                  });
                } else if (isIndex && optionChainData?.strikes?.length) {
                  const sorted = [...optionChainData.strikes].sort(
                    (a, b) => Math.abs(a.strikePrice - prc) - Math.abs(b.strikePrice - prc),
                  );
                  const atm = sorted[0];
                  const isCall = type === 'BUY';
                  const optSymbol = `${selectedSymbol.replace(' 50', '')} ${atm.strikePrice} ${isCall ? 'CE' : 'PE'}`;
                  const optLtp = isCall ? atm.callLTP : atm.putLTP;
                  const optKey = isCall ? atm.callInstrumentKey : atm.putInstrumentKey;
                  const lotSz =
                    atm.lotSize ||
                    optionChainData.lotSize ||
                    getStandardIndexLotSize(selectedSymbol);
                  setOrderModalData({
                    symbol: optSymbol,
                    price: optLtp || 100,
                    type: 'BUY',
                    instrumentKey: optKey,
                    quantity: lotSz,
                    lotSize: lotSz,
                  });
                } else {
                  setOrderModalData({ symbol: sym, price: prc, type });
                }
                setIsOrderModalOpen(true);
              }}
              onGenerateAiAnalysis={handleFetchGeminiAnalysis}
              aiLoading={aiLoading}
              signal={activeSignal}
            />
          </div>
        </div>
      )}

      {activeTab === 'BOT' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-hidden">
          <AlgoBotPanel
            botConfig={botConfig}
            onUpdateBotConfig={(cfg) => {
              if (cfg.mode) {
                try {
                  localStorage.setItem('aizabiz_preferred_trading_mode', cfg.mode);
                } catch {
                  // Ignored
                }
                setMode(cfg.mode);
              }
              setBotConfig((prev) => {
                const updated = { ...prev, ...cfg };
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
            botLogs={botLogs}
            signals={signals}
            language={language}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym, key) => {
              setSelectedSymbol(sym);
              if (key) setSelectedInstrumentKey(key);
              else {
                const matched = quotes.find((q) => q.symbol === sym);
                if (matched?.instrumentKey) setSelectedInstrumentKey(matched.instrumentKey);
              }
            }}
            onExecuteSignal={handleExecuteSignal}
            optionChainData={optionChainData}
            quotes={quotes}
            tradeHistory={modeTradeHistory}
            activeSignal={activeSignal}
            onSelectOptionTrade={(type, optSym, prc, instrKey, liveLotSize) => {
              setOrderModalData({
                symbol: optSym,
                price: prc,
                type,
                instrumentKey: instrKey,
                quantity: liveLotSize && liveLotSize > 0 ? liveLotSize : undefined,
                lotSize: liveLotSize,
              });
              setIsOrderModalOpen(true);
            }}
          />
        </div>
      )}

      {activeTab === 'OPTIONS' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-hidden">
          <OptionChainView
            data={optionChainData}
            quotes={quotes}
            loading={optionChainLoading}
            onRefresh={fetchOptionChain}
            language={language}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym, key) => {
              setSelectedSymbol(sym);
              if (key) setSelectedInstrumentKey(key);
              fetchOptionChain(undefined, sym);
            }}
            onSelectOptionTrade={(type, optSym, prc, instrKey, liveLotSize) => {
              setOrderModalData({
                symbol: optSym,
                price: prc,
                type,
                instrumentKey: instrKey,
                quantity: liveLotSize && liveLotSize > 0 ? liveLotSize : undefined,
                lotSize: liveLotSize,
              });
              setIsOrderModalOpen(true);
            }}
            onViewChart={(sym, key) => handleViewChart(sym, key)}
          />
        </div>
      )}

      {activeTab === 'ORDERS' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-y-auto smooth-scroll space-y-4 pb-28 lg:pb-4">
          {/* Performance Overview: Total Realized + Open MTM PnL, Win/Loss Ratio, Avg Trade Duration */}
          <PerformanceOverviewCard
            tradeHistory={modeTradeHistory}
            activePositions={positions}
            language={language}
          />

          <OrderBookPositions
            positions={positions}
            orders={modeOrders}
            tradeHistory={modeTradeHistory}
            holdings={holdings}
            language={language}
            onSquareOffPosition={handleSquareOffPosition}
            onSquareOffAll={handleSquareOffAll}
            totalPnL={totalNetMtm}
            onRefreshHoldings={fetchHoldings}
            isConnected={apiConfig.isConnected}
            onOpenApiModal={() => setIsApiModalOpen(true)}
            onViewChart={handleViewChart}
            onSyncHistoryBrokerage={handleSyncHistoryBrokerage}
            onOpenOrderModal={(type, sym, prc, opts) => {
              setOrderModalData({ symbol: sym, price: prc, type, ...opts });
              setIsOrderModalOpen(true);
            }}
          />

          {/* Visual Performance Overview: Daily Cumulative PnL Line Chart */}
          <CumulativePnLChart tradeHistory={modeTradeHistory} language={language} />

          <div className="mt-4">
            <AdvancedAnalytics history={modeTradeHistory as any} />
          </div>
        </div>
      )}

      {activeTab === 'HOLDINGS' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-y-auto smooth-scroll space-y-4 pb-28 lg:pb-4">
          <OrderBookPositions
            positions={positions}
            orders={modeOrders}
            tradeHistory={modeTradeHistory}
            holdings={holdings}
            language={language}
            onSquareOffPosition={handleSquareOffPosition}
            onSquareOffAll={handleSquareOffAll}
            totalPnL={totalNetMtm}
            initialTab="HOLDINGS"
            onRefreshHoldings={fetchHoldings}
            isConnected={apiConfig.isConnected}
            onOpenApiModal={() => setIsApiModalOpen(true)}
            onViewChart={handleViewChart}
            onSyncHistoryBrokerage={handleSyncHistoryBrokerage}
            onOpenOrderModal={(type, sym, prc, opts) => {
              setOrderModalData({ symbol: sym, price: prc, type, ...opts });
              setIsOrderModalOpen(true);
            }}
          />
        </div>
      )}

      {activeTab === 'HEATMAP' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-hidden pb-28 lg:pb-4">
          <MarketHeatmap quotes={quotes} />
        </div>
      )}

      {activeTab === 'AI' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-y-auto smooth-scroll grid grid-cols-1 lg:grid-cols-2 gap-4 pb-28 lg:pb-4">
          <ErrorBoundary fallbackTitle="AI മാർക്കറ്റ് അഡ്വൈസർ ലോഡ് ചെയ്യുന്നതിൽ പിശക് (AI Advisor Error)">
            <GeminiAiAdvisor
              analysis={geminiAnalysis}
              loading={aiLoading}
              onRefreshAnalysis={handleFetchGeminiAnalysis}
              language={language}
              symbol={selectedSymbol}
            />
          </ErrorBoundary>
          <ErrorBoundary fallbackTitle="ലൈവ് AI സപ്പോർട്ട് ലോഡ് ചെയ്യുന്നതിൽ പിശക് (Live AI Support Error)">
            <LiveAiSupport apiConfig={apiConfig} quotesCount={quotes.length} />
          </ErrorBoundary>
        </div>
      )}

      {activeTab === 'INVEST' && (
        <div className="h-full w-full max-w-full min-w-0 overflow-y-auto smooth-scroll pb-28 lg:pb-4">
          <InvestmentPortal language={language} />
        </div>
      )}
    </div>
  </>
);
