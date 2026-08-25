const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

// Add import back
code = code.replace("import { createChart, CrosshairMode, LineStyle, IChartApi, ISeriesApi, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';", "import { createChart, CrosshairMode, LineStyle, IChartApi, ISeriesApi, ColorType, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';");

// Add assignment back (find a good place, like after candlestick is assigned)
const attachPoint = `seriesRef.current.candlestick = candlestickSeries;`;
const attachWithMarker = `seriesRef.current.candlestick = candlestickSeries;
    seriesRef.current.candlestickMarkers = createSeriesMarkers(candlestickSeries, []);`;
code = code.replace(attachPoint, attachWithMarker);

// Change setMarkers back
code = code.replace('seriesRef.current.candlestick?.setMarkers(markers);', 'seriesRef.current.candlestickMarkers?.setMarkers(markers);');

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
console.log('Fixed markers');
