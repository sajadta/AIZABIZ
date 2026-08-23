const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

code = code.replace("chart.addSeries(HistogramSeries, {\n      color: '#26a69a',\n      priceFormat: { type: 'volume' },\n      priceScaleId: '', \n      scaleMargins: {\n        top: 0.8,\n        bottom: 0,\n      },\n    });", 
`chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });`);

code = code.replace("lineWidth: 1.5", "lineWidth: 2");
code = code.replace("lineWidth: 1.5", "lineWidth: 2");
code = code.replace("lineWidth: 1.5", "lineWidth: 2");

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
console.log('Options patched');
