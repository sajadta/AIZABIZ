const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regexImport = /import \{ analyzeTradingSignals \}/;
const replacementImport = "import { analyzeTradingSignals, enrichCandlesWithIndicators }";

code = code.replace(regexImport, replacementImport);

const regexSetCandles = /setCandles\(list\);/;
const replacementSetCandles = "setCandles(enrichCandlesWithIndicators(list));";

code = code.replace(regexSetCandles, replacementSetCandles);

fs.writeFileSync('src/App.tsx', code);
console.log('Fixed enrichCandlesWithIndicators in App.tsx');
