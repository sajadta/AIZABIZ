import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ChartToolbar } from './chart/ChartToolbar';
import { SignalOverlay } from './chart/SignalOverlay';
import { useLightweightChart } from './chart/useLightweightChart';
import { CandleData, StockQuote, Language, TradingSignal } from '../types';

interface CandlestickChartProps {
  symbol: string;
  quote?: StockQuote;
  candles: CandleData[];
  interval: string;
  onChangeInterval: (interval: string) => void;
  language: Language;
  onOpenOrderModal: (type: 'BUY' | 'SELL', symbol: string, price: number) => void;
  onGenerateAiAnalysis: () => void;
  aiLoading?: boolean;
  signal?: TradingSignal | null;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  quote,
  candles,
  interval,
  onChangeInterval,
  language,
  onOpenOrderModal,
  onGenerateAiAnalysis,
  aiLoading,
  signal,
}) => {
  const [showSupertrend, setShowSupertrend] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [activeSubChart, setActiveSubChart] = useState<'RSI' | 'MACD' | 'NONE'>('RSI');
  const [isAiOverlayMinimized, setIsAiOverlayMinimized] = useState(false);

  const { chartContainerRef, displayCandles } = useLightweightChart({
    symbol,
    quote,
    candles,
    interval,
    showSupertrend,
    showEMA,
  });

  const isMatchingQuote = Boolean(
    quote &&
    (quote.symbol === symbol ||
      symbol.includes(quote.symbol) ||
      quote.symbol.includes(symbol) ||
      (quote.instrumentKey && quote.instrumentKey.includes(symbol))),
  );

  const candleClose = displayCandles[displayCandles.length - 1]?.close || 0;
  const candleOpen = displayCandles[0]?.open || candleClose;
  const currentLtp =
    isMatchingQuote && (quote?.ltp || 0) > 0 ? quote?.ltp || 0 : candleClose || quote?.ltp || 0;
  const currentChangePts =
    isMatchingQuote && quote?.change !== undefined
      ? quote.change
      : displayCandles.length > 1
        ? Number((candleClose - candleOpen).toFixed(2))
        : 0;
  const currentChange =
    isMatchingQuote && quote?.changePercent !== undefined
      ? quote.changePercent
      : candleOpen > 0
        ? Number((((candleClose - candleOpen) / candleOpen) * 100).toFixed(2))
        : 0;
  const isPositive = currentChange >= 0 && currentChangePts >= 0;

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 bg-slate-900/80 text-slate-200 overflow-hidden">
      <ChartToolbar
        symbol={symbol}
        currentLtp={currentLtp}
        currentChange={currentChange}
        currentChangePts={currentChangePts}
        isPositive={isPositive}
        interval={interval}
        onChangeInterval={onChangeInterval}
        showSupertrend={showSupertrend}
        setShowSupertrend={setShowSupertrend}
        showEMA={showEMA}
        setShowEMA={setShowEMA}
        activeSubChart={activeSubChart}
        setActiveSubChart={setActiveSubChart}
        onOpenOrderModal={onOpenOrderModal}
      />
      <div className="relative flex-1 flex flex-col w-full max-w-full min-w-0 min-h-0 bg-[#070a12] overflow-hidden">
        {/* Main Chart Container */}
        <div className="flex-1 w-full h-full relative min-h-0 min-w-0 overflow-hidden">
          <div ref={chartContainerRef} className="absolute inset-0 w-full h-full overflow-hidden" />
        </div>

        {/* Live Candlestick Feed Loading State */}
        {displayCandles.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070a12]/80 backdrop-blur-sm z-20">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
            <p className="text-xs sm:text-sm font-bold text-slate-200">
              {language === 'ml'
                ? 'ലൈവ് കാൻഡിൽസ്റ്റിക്കുകൾ ലോഡ് ചെയ്യുന്നു...'
                : 'Loading Live Market Candlesticks...'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              100% Real-Time NSE / BSE Live Exchange Feed
            </p>
          </div>
        )}

        <SignalOverlay
          signal={signal as TradingSignal}
          minimized={isAiOverlayMinimized}
          onToggleMinimize={() => setIsAiOverlayMinimized(!isAiOverlayMinimized)}
          onRefresh={onGenerateAiAnalysis}
          aiLoading={aiLoading}
        />
      </div>
    </div>
  );
};
