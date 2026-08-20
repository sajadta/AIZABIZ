const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Remove import from middle of file
code = code.replace("import { analyzeTradingSignals, enrichCandlesWithIndicators } from './src/utils/indicators';", "");

// Add to top
code = "import { analyzeTradingSignals, enrichCandlesWithIndicators } from './src/utils/indicators';\n" + code;

fs.writeFileSync('server.ts', code);
console.log('Fixed imports');
