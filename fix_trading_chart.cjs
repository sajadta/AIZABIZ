const fs = require('fs');
let code = fs.readFileSync('src/components/TradingChart.tsx', 'utf-8');
code = code.replace(/import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';/, "import { createChart, ColorType, ISeriesApi, CandlestickSeries } from 'lightweight-charts';");
code = code.replace(/chart.addCandlestickSeries/g, "chart.addSeries(CandlestickSeries, ");
code = code.replace(/downColor: '#ef4444',/g, "downColor: '#ef4444',\n      borderVisible: false,\n      wickUpColor: '#22c55e',\n      wickDownColor: '#ef4444',");
code = code.replace(/}\);/g, "});");
fs.writeFileSync('src/components/TradingChart.tsx', code);
