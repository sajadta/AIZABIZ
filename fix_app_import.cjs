const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/import \{ analyzeTradingSignals, enrichCandlesWithIndicators \} from '\.\/utils\/indicators,\n        geminiApiKey: apiConfig\.geminiApiKey';/, "import { analyzeTradingSignals, enrichCandlesWithIndicators } from './utils/indicators';");
code = code.replace(/geminiApiKey: apiConfig\.geminiApiKey,\n        geminiApiKey: apiConfig\.geminiApiKey/g, "geminiApiKey: apiConfig.geminiApiKey");
fs.writeFileSync('src/App.tsx', code);
