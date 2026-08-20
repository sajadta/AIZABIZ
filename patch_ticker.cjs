const fs = require('fs');
let code = fs.readFileSync('src/components/TickerBar.tsx', 'utf8');
code = code.replace(/key=\{q\.instrumentKey\}/, 'key={q.instrumentKey || q.symbol}');
fs.writeFileSync('src/components/TickerBar.tsx', code);
