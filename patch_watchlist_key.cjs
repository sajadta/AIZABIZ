const fs = require('fs');
let code = fs.readFileSync('src/components/Watchlist.tsx', 'utf8');
code = code.replace(/key=\{q\.instrumentKey\}/g, 'key={q.instrumentKey || q.symbol}');
fs.writeFileSync('src/components/Watchlist.tsx', code);
