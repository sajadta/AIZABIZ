const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "import { analyzeConfluence } from './utils/indicators';",
  "import { analyzeTradingSignals } from './utils/indicators';"
);
code = code.replace(
  "const analysis = analyzeConfluence(candles);",
  "const analysis = analyzeTradingSignals(candles);"
);

fs.writeFileSync('src/App.tsx', code);
