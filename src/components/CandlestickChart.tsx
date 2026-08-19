import React, { useState, useRef, useMemo } from 'react';
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
  const [showBollinger, setShowBollinger] = useState(false);
  const [activeSubChart, setActiveSubChart] = useState<'RSI' | 'MACD' | 'NONE'>('RSI');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);


  const displayCandles = useMemo(() => {
    if (candles.length === 0) return [];
    
    // Create a copy of the candles
    const currentCandles = [...candles];
    const lastCandleIndex = currentCandles.length - 1;
    
    // If we have a live quote, update the last candle's close, high, and low dynamically
    if (quote && quote.ltp) {
       const lastCandle = { ...currentCandles[lastCandleIndex] };
       
       // Update close to current LTP
       lastCandle.close = quote.ltp;
       
       // Expand high/low if current LTP exceeds them
       if (quote.ltp > lastCandle.high) lastCandle.high = quote.ltp;
       if (quote.ltp < lastCandle.low) lastCandle.low = quote.ltp;
       
       currentCandles[lastCandleIndex] = lastCandle;
    }
    
    return currentCandles;
  }, [candles, quote]);


  const intervals = ['1m', '3m', '5m', '15m', '1h', '1D'];

  // Calculate scales
  const chartHeight = 340;
  const subChartHeight = 90;
  const paddingY = 25;

  const validCandles = useMemo(() => {
    return displayCandles.slice(-50);
  }, [candles]);

  const { minPrice, maxPrice, maxVol, minRsi, maxRsi, maxMacd } = useMemo(() => {
    if (!validCandles || validCandles.length === 0) {
      return { minPrice: 0, maxPrice: 100, maxVol: 1, minRsi: 0, maxRsi: 100, maxMacd: 1 };
    }

    let min = Infinity;
    let max = -Infinity;
    let maxV = 0;
    let maxM = 0;

    validCandles.forEach(c => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (showSupertrend && c.supertrend) {
        if (c.supertrend < min) min = c.supertrend;
        if (c.supertrend > max) max = c.supertrend;
      }
      if (showEMA) {
        if (c.ema9 && c.ema9 < min) min = c.ema9;
        if (c.ema9 && c.ema9 > max) max = c.ema9;
        if (c.ema50 && c.ema50 < min) min = c.ema50;
        if (c.ema50 && c.ema50 > max) max = c.ema50;
      }
      if (c.volume > maxV) maxV = c.volume;
      if (c.macdHist && Math.abs(c.macdHist) > maxM) maxM = Math.abs(c.macdHist);
    });

    const priceBuffer = (max - min) * 0.05 || 10;
    return {
      minPrice: min - priceBuffer,
      maxPrice: max + priceBuffer,
      maxVol: maxV || 1,
      minRsi: 0,
      maxRsi: 100,
      maxMacd: Math.max(1, maxM * 1.3),
    };
  }, [validCandles, showSupertrend, showEMA]);

  const priceToY = (price: number) => {
    if (maxPrice === minPrice) return chartHeight / 2;
    return chartHeight - paddingY - ((price - minPrice) / (maxPrice - minPrice)) * (chartHeight - paddingY * 2);
  };

  const rsiToY = (val: number) => {
    return subChartHeight - ((val - 0) / 100) * (subChartHeight - 16) - 8;
  };

  const macdToY = (val: number) => {
    const zero = subChartHeight / 2;
    return zero - (val / maxMacd) * (subChartHeight / 2 - 8);
  };

  const hoveredCandle = hoverIndex !== null && validCandles[hoverIndex] ? validCandles[hoverIndex] : validCandles[validCandles.length - 1];

  const currentLtp = quote?.ltp ?? (validCandles[validCandles.length - 1]?.close || 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Toolbar */}
      <div className="pb-3 border-b border-[#1d2335] flex items-center justify-between gap-3 flex-wrap">
        
        {/* Symbol & Price Overview */}
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>{symbol}</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700/80">
                  {quote?.exchange || 'NSE'}
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono-num mt-0.5">
              <span className="text-base font-black text-white">
                ₹{currentLtp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              {quote && (
                <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  quote.change >= 0 
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                    : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                }`}>
                  {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePercent}%)
                </span>
              )}
            </div>
          </div>

          {/* Signal Tag */}
          {signal && (
            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-black shadow-sm ${
              signal.signalType === 'BUY'
                ? 'bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 border-emerald-500/50 text-emerald-400'
                : signal.signalType === 'SELL'
                ? 'bg-gradient-to-r from-rose-950/60 to-rose-900/40 border-rose-500/50 text-rose-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Zap className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span>{signal.signalType} @ {signal.confidenceScore}% ACCURACY</span>
            </div>
          )}
        </div>

        {/* Action Controls & AI Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe selector */}
          <div className="bg-[#070b16] p-0.5 rounded-xl border border-[#1d2335] flex items-center shadow-inner">
            {intervals.map((int) => (
              <button
                key={int}
                onClick={() => onChangeInterval(int)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition ${
                  interval === int
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {int}
              </button>
            ))}
          </div>

          {/* Indicator Pills */}
          <div className="hidden sm:flex items-center gap-1 bg-[#070b16] p-0.5 rounded-xl border border-[#1d2335] text-[11px]">
            <button
              onClick={() => setShowSupertrend(!showSupertrend)}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                showSupertrend ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              ST (10,3)
            </button>
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                showEMA ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              EMA 9/21/50
            </button>
            <button
              onClick={() => setShowBollinger(!showBollinger)}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                showBollinger ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              BB (20,2)
            </button>
          </div>

          {/* Subchart toggle */}
          <div className="flex items-center bg-[#070b16] p-0.5 rounded-xl border border-[#1d2335] text-[11px]">
            <button
              onClick={() => setActiveSubChart(activeSubChart === 'RSI' ? 'NONE' : 'RSI')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                activeSubChart === 'RSI' ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400'
              }`}
            >
              RSI
            </button>
            <button
              onClick={() => setActiveSubChart(activeSubChart === 'MACD' ? 'NONE' : 'MACD')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                activeSubChart === 'MACD' ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400'
              }`}
            >
              MACD
            </button>
          </div>

          {/* Gemini AI Scan Button */}
          <button
            id="btn-gemini-scan"
            onClick={onGenerateAiAnalysis}
            disabled={aiLoading}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-950/60 transition active:scale-95 disabled:opacity-50 border border-purple-400/30"
          >
            {aiLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            )}
            <span className="hidden sm:inline">AI Analysis</span>
          </button>
        </div>
      </div>

      {/* Candlestick Tooltip Bar */}
      {hoveredCandle && (
        <div className="bg-[#090d16] px-3 sm:px-4 py-1.5 border-b border-[#1d2335]/50 flex items-center gap-3 sm:gap-5 text-[11px] font-mono text-slate-300 overflow-x-auto no-scrollbar">
          <span className="text-slate-400">{hoveredCandle.timeStr}</span>
          <span>O: <strong className="text-white">₹{hoveredCandle.open}</strong></span>
          <span>H: <strong className="text-emerald-400">₹{hoveredCandle.high}</strong></span>
          <span>L: <strong className="text-rose-400">₹{hoveredCandle.low}</strong></span>
          <span>C: <strong className={hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'}>₹{hoveredCandle.close}</strong></span>
          <span className="text-slate-400">Vol: <strong className="text-white">{(hoveredCandle.volume / 1000).toFixed(1)}k</strong></span>
          {showEMA && hoveredCandle.ema9 && (
            <span className="text-cyan-400 hidden sm:inline">EMA9: ₹{hoveredCandle.ema9}</span>
          )}
          {showEMA && hoveredCandle.ema21 && (
            <span className="text-amber-400 hidden sm:inline">EMA21: ₹{hoveredCandle.ema21}</span>
          )}
          {showSupertrend && hoveredCandle.supertrend && (
            <span className={`hidden sm:inline font-bold ${hoveredCandle.supertrendDir === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
              ST: ₹{hoveredCandle.supertrend} ({hoveredCandle.supertrendDir})
            </span>
          )}
          {activeSubChart === 'RSI' && hoveredCandle.rsi && (
            <span className="text-purple-400">RSI: {hoveredCandle.rsi}</span>
          )}
        </div>
      )}

      {/* SVG Interactive Canvas */}
      <div 
        ref={containerRef}
        className="relative flex-1 bg-[#080c14] overflow-hidden select-none cursor-crosshair"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg 
          className="w-full h-[340px]"
          viewBox={`0 0 800 ${chartHeight}`}
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const candleWidth = rect.width / (validCandles.length || 1);
            const idx = Math.min(validCandles.length - 1, Math.max(0, Math.floor(mouseX / candleWidth)));
            setHoverIndex(idx);
          }}
        >
          {/* Horizontal Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const price = minPrice + (maxPrice - minPrice) * ratio;
            const y = priceToY(price);
            return (
              <g key={ratio}>
                <line x1="0" y1={y} x2="800" y2={y} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.8" />
                <text x="792" y={y - 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="JetBrains Mono">
                  ₹{price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Candlesticks & Volume */}
          {validCandles.map((c, i) => {
            const total = validCandles.length;
            const candleStep = 800 / total;
            const x = i * candleStep + candleStep / 2;
            const barWidth = Math.max(3, candleStep * 0.65);

            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);


            const isGreen = c.close >= c.open;
            const color = isGreen ? '#10b981' : '#ef4444';
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            // Determine if there is a signal crossover for this candle
            const prevCandle = i > 0 ? validCandles[i - 1] : null;
            let showBuyArrow = false;
            let showSellArrow = false;

            if (c.supertrendDir === 'BUY' && (!prevCandle || prevCandle.supertrendDir === 'SELL')) {
              showBuyArrow = true;
            } else if (c.supertrendDir === 'SELL' && (!prevCandle || prevCandle.supertrendDir === 'BUY')) {
              showSellArrow = true;
            }

            // Volume bar
            const volHeight = (c.volume / maxVol) * 50;
            const volY = chartHeight - volHeight;

            return (
              <g key={c.timestamp || i}>
                {/* Volume Bar */}
                <rect
                  x={x - barWidth / 2}
                  y={volY}
                  width={barWidth}
                  height={volHeight}
                  fill={isGreen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
                />

                {/* Wick */}
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1.2" />

                {/* Body */}
                <rect
                  x={x - barWidth / 2}
                  y={bodyY}
                  width={barWidth}
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />

                {/* Buy Arrow */}
                {showBuyArrow && (
                  <g transform={`translate(${x}, ${Math.min(chartHeight - 30, lowY + 15)})`}>
                    <polygon points="-5,5 5,5 0,-5" fill="#10b981" />
                    <text y="15" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">BUY</text>
                  </g>
                )}

                {/* Sell Arrow */}
                {showSellArrow && (
                  <g transform={`translate(${x}, ${Math.max(30, highY - 15)})`}>
                    <polygon points="-5,-5 5,-5 0,5" fill="#ef4444" />
                    <text y="-10" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">SELL</text>
                  </g>
                )}
              </g>
            );

          })}

          {/* Supertrend Line */}
          {showSupertrend && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              points={validCandles
                .map((c, i) => {
                  if (!c.supertrend) return null;
                  const candleStep = 800 / validCandles.length;
                  const x = i * candleStep + candleStep / 2;
                  const y = priceToY(c.supertrend);
                  return `${x},${y}`;
                })
                .filter(Boolean)
                .join(' ')}
            />
          )}

          {/* EMA 9 Line */}
          {showEMA && (
            <polyline
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.5"
              points={validCandles
                .map((c, i) => {
                  if (!c.ema9) return null;
                  const candleStep = 800 / validCandles.length;
                  const x = i * candleStep + candleStep / 2;
                  const y = priceToY(c.ema9);
                  return `${x},${y}`;
                })
                .filter(Boolean)
                .join(' ')}
            />
          )}

          {/* EMA 21 Line */}
          {showEMA && (
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.5"
              points={validCandles
                .map((c, i) => {
                  if (!c.ema21) return null;
                  const candleStep = 800 / validCandles.length;
                  const x = i * candleStep + candleStep / 2;
                  const y = priceToY(c.ema21);
                  return `${x},${y}`;
                })
                .filter(Boolean)
                .join(' ')}
            />
          )}

          {/* EMA 50 Line */}
          {showEMA && (
            <polyline
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.5"
              points={validCandles
                .map((c, i) => {
                  if (!c.ema50) return null;
                  const candleStep = 800 / validCandles.length;
                  const x = i * candleStep + candleStep / 2;
                  const y = priceToY(c.ema50);
                  return `${x},${y}`;
                })
                .filter(Boolean)
                .join(' ')}
            />
          )}

          {/* Current LTP Horizontal Line & Badge */}
          {currentLtp && (
            <g>
              <line
                x1="0"
                y1={priceToY(currentLtp)}
                x2="800"
                y2={priceToY(currentLtp)}
                stroke="#38bdf8"
                strokeDasharray="4 2"
                strokeWidth="1.2"
              />
              <rect
                x="725"
                y={priceToY(currentLtp) - 9}
                width="72"
                height="18"
                fill="#0284c7"
                rx="4"
              />
              <text
                x="761"
                y={priceToY(currentLtp) + 3}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                fontFamily="JetBrains Mono"
              >
                ₹{currentLtp.toFixed(1)}
              </text>
            </g>
          )}

          {/* Crosshair on Hover */}
          {hoverIndex !== null && validCandles[hoverIndex] && (
            <g>
              <line
                x1={hoverIndex * (800 / validCandles.length) + (800 / validCandles.length) / 2}
                y1="0"
                x2={hoverIndex * (800 / validCandles.length) + (800 / validCandles.length) / 2}
                y2={chartHeight}
                stroke="#94a3b8"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
            </g>
          )}
        </svg>

        {/* Sub Chart: RSI or MACD */}
        {activeSubChart !== 'NONE' && (
          <div className="border-t border-[#1d2335] bg-[#070a12] p-2 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                {activeSubChart === 'RSI' ? 'RSI (14) Momentum Indicator' : 'MACD (12, 26, 9) Oscillator'}
              </span>
              <span className="text-[10px] font-mono text-purple-400 font-bold">
                {activeSubChart === 'RSI' 
                  ? `Val: ${hoveredCandle?.rsi ?? 50}` 
                  : `Hist: ${hoveredCandle?.macdHist ?? 0}`}
              </span>
            </div>

            <svg className="w-full h-[80px]" viewBox={`0 0 800 ${subChartHeight}`} preserveAspectRatio="none">
              {activeSubChart === 'RSI' ? (
                <g>
                  {/* RSI Overbought (70) and Oversold (30) levels */}
                  <line x1="0" y1={rsiToY(70)} x2="800" y2={rsiToY(70)} stroke="#ef4444" strokeDasharray="3 3" strokeWidth="0.8" />
                  <line x1="0" y1={rsiToY(30)} x2="800" y2={rsiToY(30)} stroke="#10b981" strokeDasharray="3 3" strokeWidth="0.8" />
                  <line x1="0" y1={rsiToY(50)} x2="800" y2={rsiToY(50)} stroke="#475569" strokeDasharray="2 2" strokeWidth="0.6" />

                  <polyline
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth="1.8"
                    points={validCandles
                      .map((c, i) => {
                        const candleStep = 800 / validCandles.length;
                        const x = i * candleStep + candleStep / 2;
                        const y = rsiToY(c.rsi ?? 50);
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                </g>
              ) : (
                <g>
                  <line x1="0" y1={subChartHeight / 2} x2="800" y2={subChartHeight / 2} stroke="#475569" strokeWidth="0.8" />
                  {validCandles.map((c, i) => {
                    const candleStep = 800 / validCandles.length;
                    const x = i * candleStep + candleStep / 2;
                    const val = c.macdHist ?? 0;
                    const y = macdToY(val);
                    const zero = subChartHeight / 2;
                    const height = Math.abs(y - zero);
                    const barY = val >= 0 ? y : zero;
                    const color = val >= 0 ? '#10b981' : '#ef4444';

                    return (
                      <rect
                        key={i}
                        x={x - 2}
                        y={barY}
                        width="4"
                        height={Math.max(1, height)}
                        fill={color}
                      />
                    );
                  })}
                </g>
              )}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
