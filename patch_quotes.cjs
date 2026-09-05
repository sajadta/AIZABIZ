const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/high: v\.high \|\| 0,/g, 'high: v.ohlc?.high || v.high || 0,');
code = code.replace(/low: v\.low \|\| 0,/g, 'low: v.ohlc?.low || v.low || 0,');
code = code.replace(/close: v\.close \|\| \(v\.last_price - v\.net_change\)/g, 'close: v.ohlc?.close || v.close || (v.last_price - v.net_change)');

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts quotes");
