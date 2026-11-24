import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { ChartToolbar } from './chart/ChartToolbar';
import { SignalOverlay } from './chart/SignalOverlay';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
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

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const seriesRef = useRef<{
    candlestick?: any;
    candlestickMarkers?: any;
    volume?: any;
    supertrend?: any;
    ema9?: any;
    ema21?: any;
    ema50?: any;
  }>({});

  const displayCandles = useMemo(() => {
    if (candles.length === 0) return [];
    const currentCandles = candles
      .filter((c) => c && c.close > 0 && c.high > 0 && c.low > 0 && c.open > 0)
      .map((c) => ({ ...c }));
    if (currentCandles.length === 0) return [];
    const lastCandleIndex = currentCandles.length - 1;

    if (quote && quote.ltp && quote.ltp > 0) {
      const lastCandle = { ...currentCandles[lastCandleIndex] };
      // Only merge live quote if it belongs to the same price scale (<15% difference)
      const diffRatio = Math.abs(quote.ltp - lastCandle.close) / lastCandle.close;
      if (diffRatio <= 0.15) {
        const intervalMinutesMap: Record<string, number> = {
          '1m': 1,
          '3m': 3,
          '5m': 5,
          '15m': 15,
          '1h': 60,
        };
        const intervalMins = intervalMinutesMap[interval] || 0;
        const intervalMs = intervalMins * 60 * 1000;
        const IST_MARKET_OPEN_OFFSET_MS = (3 * 60 + 45) * 60 * 1000;
        const nowMs = Date.now();
        const currentBucketStart =
          intervalMs > 0
            ? Math.floor((nowMs - IST_MARKET_OPEN_OFFSET_MS) / intervalMs) * intervalMs +
              IST_MARKET_OPEN_OFFSET_MS
            : lastCandle.timestamp;

        if (
          intervalMs > 0 &&
          currentBucketStart > lastCandle.timestamp &&
          currentBucketStart - lastCandle.timestamp <= intervalMs * 4
        ) {
          // A new minute/5m bar has started: append the new live bar immediately so the chart never waits for historical API lag!
          currentCandles.push({
            ...lastCandle,
            timestamp: currentBucketStart,
            open: lastCandle.close,
            high: Math.max(lastCandle.close, quote.ltp),
            low: Math.min(lastCandle.close, quote.ltp),
            close: quote.ltp,
            volume: 0,
          });
        } else {
          lastCandle.close = quote.ltp;
          if (quote.ltp > lastCandle.high) lastCandle.high = quote.ltp;
          if (quote.ltp < lastCandle.low) lastCandle.low = quote.ltp;
          currentCandles[lastCandleIndex] = lastCandle;
        }
      }
    }
    return currentCandles;
  }, [candles, quote?.ltp, interval]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#070a12' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b', style: LineStyle.SparseDotted },
        horzLines: { color: '#1e293b', style: LineStyle.SparseDotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current.candlestick = candlestickSeries;
    seriesRef.current.candlestickMarkers = createSeriesMarkers(candlestickSeries, []);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume_scale',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume_scale').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
      visible: false,
    });
    seriesRef.current.volume = volumeSeries;

    // EMA Series
    seriesRef.current.ema9 = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    });
    seriesRef.current.ema21 = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    });
    seriesRef.current.ema50 = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    });

    // Supertrend Series
    seriesRef.current.supertrend = chart.addSeries(LineSeries, {
      color: '#10b981',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    });

    return () => {
      chart.remove();
    };
  }, []);

  const lastFittedKeyRef = useRef<string>('');

  useEffect(() => {
    if (!seriesRef.current.candlestick) return;

    if (displayCandles.length === 0) {
      seriesRef.current.candlestick.setData([]);
      seriesRef.current.volume?.setData([]);
      seriesRef.current.ema9?.setData([]);
      seriesRef.current.ema21?.setData([]);
      seriesRef.current.ema50?.setData([]);
      seriesRef.current.supertrend?.setData([]);
      seriesRef.current.candlestickMarkers?.setMarkers([]);
      return;
    }

    // Convert UTC epoch to IST (+5 hours 30 minutes = 19800 seconds) for Lightweight Charts display so axis shows exact Indian Market Time (09:15 - 15:30 IST)
    const IST_OFFSET_SECONDS = 19800;

    // Prepare data - ensure unique timestamps and integers
    const uniqueCandlesMap = new Map();
    displayCandles.forEach((c) => {
      const istSec = Math.floor(c.timestamp / 1000) + IST_OFFSET_SECONDS;
      uniqueCandlesMap.set(istSec, { ...c, _istSec: istSec });
    });

    const uniqueCandles = Array.from(uniqueCandlesMap.values()).sort(
      (a, b) => a._istSec - b._istSec,
    );

    const candlestickData = uniqueCandles.map((c) => ({
      time: c._istSec as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = uniqueCandles.map((c) => ({
      time: c._istSec as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    }));

    // Generate valid times to ensure matching timestamps
    seriesRef.current.candlestick.setData(candlestickData);
    seriesRef.current.volume?.setData(volumeData);

    const ema9Data: any[] = [];
    const ema21Data: any[] = [];
    const ema50Data: any[] = [];
    const supertrendData: any[] = [];
    const markers: any[] = [];

    uniqueCandles.forEach((c) => {
      const time = c._istSec as any;
      if (c.ema9 && c.ema9 > 0) ema9Data.push({ time, value: c.ema9 });
      if (c.ema21 && c.ema21 > 0) ema21Data.push({ time, value: c.ema21 });
      if (c.ema50 && c.ema50 > 0) ema50Data.push({ time, value: c.ema50 });
      if (c.supertrend && c.supertrend > 0) supertrendData.push({ time, value: c.supertrend });

      // Add Buy/Sell Markers
      if (c.signal === 'BUY') {
        markers.push({
          time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: 'BUY',
        });
      } else if (c.signal === 'SELL') {
        markers.push({
          time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'SELL',
        });
      }
    });

    if (showEMA) {
      seriesRef.current.ema9?.setData(ema9Data);
      seriesRef.current.ema21?.setData(ema21Data);
      seriesRef.current.ema50?.setData(ema50Data);
    } else {
      seriesRef.current.ema9?.setData([]);
      seriesRef.current.ema21?.setData([]);
      seriesRef.current.ema50?.setData([]);
    }

    if (showSupertrend) {
      seriesRef.current.supertrend?.setData(supertrendData);
    } else {
      seriesRef.current.supertrend?.setData([]);
    }

    seriesRef.current.candlestickMarkers?.setMarkers(markers);

    const currentFitKey = `${symbol}_${interval}`;
    if (lastFittedKeyRef.current !== currentFitKey && chartRef.current) {
      lastFittedKeyRef.current = currentFitKey;
      chartRef.current.priceScale('right').applyOptions({ autoScale: true });
      chartRef.current.timeScale().fitContent();
    }
  }, [displayCandles, showEMA, showSupertrend, symbol, interval]);

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
