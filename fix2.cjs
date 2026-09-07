const fs = require('fs');
let code = fs.readFileSync('src/components/TradingChart.tsx', 'utf-8');
code = code.replace(/chart\.addSeries\(CandlestickSeries, \(\{/g, 'chart.addSeries(CandlestickSeries, {');
fs.writeFileSync('src/components/TradingChart.tsx', code);
