const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(
  /let indicators,\n        geminiApiKey: apiConfig\.geminiApiKey = null;/g,
  "let indicators = null;"
);
fs.writeFileSync('src/App.tsx', code);
