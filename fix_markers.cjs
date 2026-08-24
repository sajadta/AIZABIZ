const fs = require('fs');
let content = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

// 1. Add createSeriesMarkers to lightweight-charts import
content = content.replace(
  "CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';",
  "CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';"
);

// 2. Add candlestickMarkers to seriesRef
content = content.replace(
  "candlestick?: any;",
  "candlestick?: any;\n    candlestickMarkers?: any;"
);

// 3. Initialize candlestickMarkers
content = content.replace(
  "seriesRef.current.candlestick = candlestickSeries;",
  "seriesRef.current.candlestick = candlestickSeries;\n    seriesRef.current.candlestickMarkers = createSeriesMarkers(candlestickSeries, []);"
);

// 4. Update the usage of setMarkers
content = content.replace(
  "seriesRef.current.candlestick.setMarkers(markers);",
  "seriesRef.current.candlestickMarkers?.setMarkers(markers);"
);

fs.writeFileSync('src/components/CandlestickChart.tsx', content);
console.log('Fixed markers!');
