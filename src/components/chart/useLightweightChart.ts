import { useEffect, useMemo, useRef } from 'react';
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
import type { CandleData, StockQuote } from '../../types';
import { buildDisplayCandles } from './displayCandles';

interface UseLightweightChartOptions {
  symbol: string;
  quote?: StockQuote;
  candles: CandleData[];
  interval: string;
  showSupertrend: boolean;
  showEMA: boolean;
}

/** Owns the lightweight-charts instance, its series and the candle data sync effects. */
export function useLightweightChart({
  symbol,
  quote,
  candles,
  interval,
  showSupertrend,
  showEMA,
}: UseLightweightChartOptions) {
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

  const displayCandles = useMemo(
    () => buildDisplayCandles(candles, quote, interval),
    [candles, quote, interval],
  );

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
      // Never inherit navigator.language: non-Intl tags such as "en-US@posix"
      // make lightweight-charts throw when it formats axis tick marks.
      localization: {
        locale: 'en-IN',
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

    // Shift UTC epoch to IST (+5h30m) so the axis labels match exchange time.
    const IST_OFFSET_SECONDS = 19800;

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

  return { chartContainerRef, displayCandles };
}
