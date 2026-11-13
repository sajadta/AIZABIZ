import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, Sliders, Sparkles, Layers, RefreshCw } from 'lucide-react';
import { createChart, CrosshairMode, LineStyle, IChartApi, ColorType, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { CandleData, StockQuote, Language, TradingSignal } from '../types';
import { translations } from '../translations';

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
  const t = translations[language];
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

        if (intervalMs > 0 && currentBucketStart > lastCandle.timestamp && currentBucketStart - lastCandle.timestamp <= intervalMs * 4) {
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

  const intervals = ['1m', '3m', '5m', '15m', '1h', '1D'];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartContainerRef.current) {
         chartRef.current?.applyOptions({ 
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight
         });
      }
    };

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
    seriesRef.current.ema9 = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false });
    seriesRef.current.ema21 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false });
    seriesRef.current.ema50 = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false });

    // Supertrend Series
    seriesRef.current.supertrend = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false });

    const resizeObserver = new ResizeObserver(() => {
       handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
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
    displayCandles.forEach(c => {
       const istSec = Math.floor(c.timestamp / 1000) + IST_OFFSET_SECONDS;
       uniqueCandlesMap.set(istSec, { ...c, _istSec: istSec });
    });
    
    const uniqueCandles = Array.from(uniqueCandlesMap.values()).sort((a, b) => a._istSec - b._istSec);

    const candlestickData = uniqueCandles.map(c => ({
      time: c._istSec as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = uniqueCandles.map(c => ({
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
        markers.push({ time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'BUY' });
      } else if (c.signal === 'SELL') {
        markers.push({ time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'SELL' });
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
        (quote.instrumentKey && quote.instrumentKey.includes(symbol)))
  );

  const candleClose = displayCandles[displayCandles.length - 1]?.close || 0;
  const candleOpen = displayCandles[0]?.open || candleClose;
  const currentLtp = isMatchingQuote && (quote?.ltp || 0) > 0 ? (quote?.ltp || 0) : (candleClose || quote?.ltp || 0);
  const currentChangePts = isMatchingQuote && quote?.change !== undefined
    ? quote.change
    : (displayCandles.length > 1 ? Number((candleClose - candleOpen).toFixed(2)) : 0);
  const currentChange = isMatchingQuote && quote?.changePercent !== undefined
    ? quote.changePercent
    : (candleOpen > 0 ? Number((((candleClose - candleOpen) / candleOpen) * 100).toFixed(2)) : 0);
  const isPositive = currentChange >= 0 && currentChangePts >= 0;

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 bg-slate-900/80 text-slate-200 overflow-hidden">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 border-b border-slate-800/90 bg-[#080c16] gap-1.5 sm:gap-3 shrink-0 w-full max-w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight">{symbol}</h2>
            <div className="flex items-center gap-1.5 font-mono-num">
              <span className={`text-sm sm:text-base font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentLtp > 0 ? `₹${currentLtp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Live...'}
              </span>
              {currentLtp > 0 && (
                <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold border ${isPositive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                  {isPositive ? '+' : ''}{currentChangePts.toFixed(2)} ({isPositive ? '+' : ''}{currentChange.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>

          {/* Quick Buy/Sell for mobile right top */}
          <div className="flex sm:hidden items-center gap-1.5">
            <button 
              onClick={() => onOpenOrderModal('BUY', symbol, currentLtp)}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-emerald-950"
            >
              BUY
            </button>
            <button 
              onClick={() => onOpenOrderModal('SELL', symbol, currentLtp)}
              className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-rose-950"
            >
              SELL
            </button>
          </div>
        </div>

        {/* Intervals & Indicators */}
        <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex bg-slate-900/90 rounded-xl p-0.5 border border-slate-800 shrink-0">
            {intervals.map((int) => (
              <button
                key={int}
                onClick={() => onChangeInterval(int)}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all ${
                  interval === int
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                {int}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 border-l border-slate-800 pl-2 shrink-0">
             <button
              onClick={() => setShowSupertrend(!showSupertrend)}
              className={`p-1 sm:p-1.5 rounded-lg border transition-colors ${showSupertrend ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
              title="Toggle Supertrend"
            >
              <TrendingUp size={15} />
            </button>
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={`p-1 sm:p-1.5 rounded-lg border transition-colors ${showEMA ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
              title="Toggle EMA (9/21)"
            >
              <Layers size={15} />
            </button>
            <button
              onClick={() => setActiveSubChart(activeSubChart === 'RSI' ? 'MACD' : activeSubChart === 'MACD' ? 'NONE' : 'RSI')}
              className={`p-1 sm:p-1.5 rounded-lg border transition-colors ${activeSubChart !== 'NONE' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
              title="Toggle Sub-chart (RSI/MACD)"
            >
              <Sliders size={15} />
            </button>
          </div>

          {/* Desktop Buy/Sell */}
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3 shrink-0">
            <button 
              onClick={() => onOpenOrderModal('BUY', symbol, currentLtp)}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-emerald-950"
            >
              BUY
            </button>
            <button 
              onClick={() => onOpenOrderModal('SELL', symbol, currentLtp)}
              className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white px-3.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-rose-950"
            >
              SELL
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col w-full max-w-full min-w-0 min-h-0 bg-[#070a12] overflow-hidden">
         {/* Main Chart Container */}
         <div className="flex-1 w-full h-full relative min-h-0 min-w-0 overflow-hidden"><div ref={chartContainerRef} className="absolute inset-0 w-full h-full overflow-hidden" /></div>

         {/* Live Candlestick Feed Loading State */}
         {displayCandles.length === 0 && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070a12]/80 backdrop-blur-sm z-20">
             <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
             <p className="text-xs sm:text-sm font-bold text-slate-200">
               {language === 'ml' ? 'ലൈവ് കാൻഡിൽസ്റ്റിക്കുകൾ ലോഡ് ചെയ്യുന്നു...' : 'Loading Live Market Candlesticks...'}
             </p>
             <p className="text-[11px] text-slate-400 mt-1">100% Real-Time NSE / BSE Live Exchange Feed</p>
           </div>
         )}
         
         {/* AI Signal Overlay - if generated */}
         {signal && (
           <div className={`absolute top-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl z-10 transition-all duration-200 ${
             isAiOverlayMinimized ? 'p-2 max-w-[220px]' : 'p-3.5 max-w-xs'
           }`}>
              <div className="flex items-center justify-between gap-2">
                 <div 
                   className="flex items-center gap-1.5 cursor-pointer select-none"
                   onClick={() => setIsAiOverlayMinimized(!isAiOverlayMinimized)}
                   title={isAiOverlayMinimized ? "Expand AI Analysis" : "Minimize AI Analysis"}
                 >
                    <Sparkles size={14} className="text-amber-400 shrink-0" />
                    <span className="font-bold text-amber-300 text-xs">AI Analysis</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                      (signal.action || signal.signalType) === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : (signal.action || signal.signalType) === 'SELL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-300'
                    }`}>
                      {signal.action || signal.signalType}
                    </span>
                 </div>
                 <div className="flex items-center gap-1">
                   <button
                     onClick={() => onGenerateAiAnalysis()}
                     className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                     title="Refresh AI Analysis"
                   >
                     <RefreshCw size={12} className={aiLoading ? "animate-spin" : ""} />
                   </button>
                   <button
                     onClick={() => setIsAiOverlayMinimized(!isAiOverlayMinimized)}
                     className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition text-xs font-mono font-bold"
                     title={isAiOverlayMinimized ? "Expand" : "Minimize"}
                   >
                     {isAiOverlayMinimized ? "➕" : "➖"}
                   </button>
                 </div>
              </div>

              {!isAiOverlayMinimized && (
                <div className="mt-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                    <span className="text-slate-400 text-[11px]">Confidence:</span>
                    <span className="font-bold text-cyan-300">{signal.confidence ?? signal.confidenceScore}%</span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed">
                    {signal.reason || signal.rationale}
                  </p>
                </div>
              )}
           </div>
         )}
      </div>
    </div>
  );
};
