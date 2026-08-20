const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');
const match = code.match(/analyzeTradingSignals\([^)]+\)/);
console.log(match ? match[0] : 'Not found');
