const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  /const \{ symbol, ltp, changePercent, indicators, interval \} = req\.body;/g,
  "const { symbol, ltp, changePercent, indicators, interval, geminiApiKey } = req.body;\n    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;"
);
fs.writeFileSync('server.ts', code);
