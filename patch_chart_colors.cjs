const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

code = code.replace("import { createChart, CrosshairMode, LineStyle, IChartApi, ISeriesApi } from 'lightweight-charts';", "import { createChart, CrosshairMode, LineStyle, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';");
code = code.replace("background: { type: 'solid', color: '#070a12' },", "background: { type: ColorType.Solid, color: '#070a12' },");

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
console.log('Colors patched');
