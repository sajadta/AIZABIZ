const fs = require('fs');

const code = `import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  TrendingDown, 
  Maximize2, 
  Sliders, 
  Zap, 
  Sparkles, 
  Layers, 
  Eye, 
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { createChart, CrosshairMode, LineStyle, IChartApi, ISeriesApi } from 'lightweight-charts';
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
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  const seriesRef = useRef<{
    candlestick?: ISeriesApi<"Candlestick">;
    volume?: ISeriesApi<"Histogram">;
    supertrend?: ISeriesApi<"Line">;
    ema9?: ISeriesApi<"Line">;
    ema21?: ISeriesApi<"Line">;
    ema50?: ISeriesApi<"Line">;
  }>({});

  const displayCandles = useMemo(() => {
    if (candles.length === 0) return [];
    const currentCandles = [...candles];
    const lastCandleIndex = currentCandles.length - 1;
    
    if (quote && quote.ltp) {
       const lastCandle = { ...currentCandles[lastCandleIndex] };
       lastCandle.close = quote.ltp;
       if (quote.ltp > lastCandle.high) lastCandle.high = quote.ltp;
       if (quote.ltp < lastCandle.low) lastCandle.low = quote.ltp;
       currentCandles[lastCandleIndex] = lastCandle;
    }
    return currentCandles;
  }, [candles, quote]);

  const intervals = ['1m', '3m', '5m', '15m', '1h', '1D'];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: 'solid', color: '#070a12' },
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

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current.candlestick = candlestickSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    seriesRef.current.volume = volumeSeries;

    // EMA Series
    seriesRef.current.ema9 = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1.5, crosshairMarkerVisible: false });
    seriesRef.current.ema21 = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, crosshairMarkerVisible: false });
    seriesRef.current.ema50 = chart.addLineSeries({ color: '#a855f7', lineWidth: 1.5, crosshairMarkerVisible: false });

    // Supertrend Series
    seriesRef.current.supertrend = chart.addLineSeries({ color: '#10b981', lineWidth: 2, crosshairMarkerVisible: false });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current.candlestick || displayCandles.length === 0) return;

    // Prepare data
    const candlestickData = displayCandles.map(c => ({
      time: (c.timestamp / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = displayCandles.map(c => ({
      time: (c.timestamp / 1000) as any,
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

    displayCandles.forEach((c) => {
      const time = (c.timestamp / 1000) as any;
      if (c.ema9) ema9Data.push({ time, value: c.ema9 });
      if (c.ema21) ema21Data.push({ time, value: c.ema21 });
      if (c.ema50) ema50Data.push({ time, value: c.ema50 });
      if (c.supertrend) supertrendData.push({ time, value: c.supertrend });

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

    seriesRef.current.candlestick.setMarkers(markers);

  }, [displayCandles, showEMA, showSupertrend]);

  const currentLtp = quote?.ltp || (displayCandles[displayCandles.length - 1]?.close || 0);
  const currentChange = quote?.changePercent || 0;
  const isPositive = currentChange >= 0;

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] text-slate-200">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between p-3 border-b border-[#1d2335] bg-[#070a12] gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-slate-100">{symbol}</h2>
            <div className="flex items-center gap-2">
              <span className={\`text-lg font-mono font-bold \${isPositive ? 'text-emerald-400' : 'text-rose-400'}\`}>
                ₹{currentLtp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={\`text-xs px-1.5 py-0.5 rounded font-bold \${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}\`}>
                {isPositive ? '+' : ''}{currentChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
            {intervals.map((int) => (
              <button
                key={int}
                onClick={() => onChangeInterval(int)}
                className={\`px-3 py-1 text-xs font-bold rounded-md transition-colors \${
                  interval === int
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }\`}
              >
                {int}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
             <button
              onClick={() => setShowSupertrend(!showSupertrend)}
              className={\`p-1.5 rounded-md transition-colors \${showSupertrend ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}\`}
              title="Toggle Supertrend"
            >
              <TrendingUp size={16} />
            </button>
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={\`p-1.5 rounded-md transition-colors \${showEMA ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}\`}
              title="Toggle EMA"
            >
              <Layers size={16} />
            </button>
            <button
              onClick={() => setActiveSubChart(activeSubChart === 'RSI' ? 'MACD' : activeSubChart === 'MACD' ? 'NONE' : 'RSI')}
              className={\`p-1.5 rounded-md transition-colors \${activeSubChart !== 'NONE' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:bg-slate-800'}\`}
              title="Toggle Sub-chart (RSI/MACD)"
            >
              <Sliders size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <button 
              onClick={() => onOpenOrderModal('BUY', symbol, currentLtp)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/20"
            >
              BUY
            </button>
            <button 
              onClick={() => onOpenOrderModal('SELL', symbol, currentLtp)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-rose-900/20"
            >
              SELL
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col min-h-0 bg-[#070a12]">
         {/* Main Chart Container */}
         <div ref={chartContainerRef} className="flex-1 w-full relative" />
         
         {/* AI Signal Overlay - if generated */}
         {signal && (
           <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-2xl max-w-xs z-10 animate-in slide-in-from-left-2">
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    <span className="font-bold text-amber-400 text-sm">AI Analysis</span>
                 </div>
                 <button onClick={() => onGenerateAiAnalysis()} className="text-slate-400 hover:text-white">
                   <RefreshCw size={14} className={aiLoading ? "animate-spin" : ""} />
                 </button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                 <span className="text-xs text-slate-400">Action:</span>
                 <span className={\`text-sm font-black \${signal.action === 'BUY' ? 'text-emerald-400' : signal.action === 'SELL' ? 'text-rose-400' : 'text-slate-300'}\`}>
                    {signal.action}
                 </span>
                 <span className="text-xs text-slate-400 ml-auto">Conf: {signal.confidence}%</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                 {signal.reason}
              </p>
           </div>
         )}
      </div>
    </div>
  );
};
`;

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
