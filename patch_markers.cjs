const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

// Remove import
code = code.replace(', createSeriesMarkers', '');

// Remove assignment
code = code.replace('seriesRef.current.candlestickMarkers = createSeriesMarkers(candlestickSeries, []);', '');

// Change setMarkers
code = code.replace('seriesRef.current.candlestickMarkers?.setMarkers(markers);', 'seriesRef.current.candlestick?.setMarkers(markers);');

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
console.log('Patched markers');
