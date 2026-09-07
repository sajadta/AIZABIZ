const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(
  /indicators,\n        geminiApiKey: apiConfig\.geminiApiKey = analysis\.indicators,\n        geminiApiKey: apiConfig\.geminiApiKey;/g,
  "indicators = analysis.indicators;"
);
fs.writeFileSync('src/App.tsx', code);
