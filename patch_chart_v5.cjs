const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

code = code.replace("import { createChart, CrosshairMode, LineStyle, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';", "import { createChart, CrosshairMode, LineStyle, IChartApi, ISeriesApi, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';");

// Replace addCandlestickSeries -> addSeries(CandlestickSeries, ...)
code = code.replace("chart.addCandlestickSeries({", "chart.addSeries(CandlestickSeries, {");
code = code.replace("chart.addHistogramSeries({", "chart.addSeries(HistogramSeries, {");
code = code.replace("chart.addLineSeries({", "chart.addSeries(LineSeries, {");
code = code.replace("chart.addLineSeries({", "chart.addSeries(LineSeries, {");
code = code.replace("chart.addLineSeries({", "chart.addSeries(LineSeries, {");
code = code.replace("chart.addLineSeries({", "chart.addSeries(LineSeries, {");

// Also replace interface usage for types
code = code.replace('candlestick?: ISeriesApi<"Candlestick">;', 'candlestick?: any;');
code = code.replace('volume?: ISeriesApi<"Histogram">;', 'volume?: any;');
code = code.replace('supertrend?: ISeriesApi<"Line">;', 'supertrend?: any;');
code = code.replace('ema9?: ISeriesApi<"Line">;', 'ema9?: any;');
code = code.replace('ema21?: ISeriesApi<"Line">;', 'ema21?: any;');
code = code.replace('ema50?: ISeriesApi<"Line">;', 'ema50?: any;');

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
console.log('v5 series patched');
