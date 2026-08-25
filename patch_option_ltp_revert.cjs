const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `                 callLTP: call.market_data?.ltp || call.market_data?.close_price || call.market_data?.last_price || 0,
                 putLTP: put.market_data?.ltp || put.market_data?.close_price || put.market_data?.last_price || 0,`;

const replace = `                 callLTP: call.market_data?.ltp || 0,
                 putLTP: put.market_data?.ltp || 0,`;

code = code.replace(target, replace);
fs.writeFileSync('server.ts', code);
console.log('Reverted LTP fallback to match Upstox app');
