const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const analysis = analyzeTradingSignals\(candles\);/;
const replacement = `const currentLtp = quote?.ltp || (candles[candles.length - 1]?.close || 0);
        const analysis = analyzeTradingSignals(
          selectedSymbol,
          selectedSymbol,
          quote?.instrumentKey || '',
          candles,
          currentLtp,
          botConfig.selectedStrategy || 'PROFIT_MAX_100_PERCENT_MATRIX'
        );`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Fixed analyzeTradingSignals call in App.tsx!');
} else {
  console.log('Regex did not match!');
}
