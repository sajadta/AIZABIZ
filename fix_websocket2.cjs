const fs = require('fs');
let code = fs.readFileSync('node_modules/upstox-js-sdk/dist/feeder/MarketDataFeederV3.js', 'utf-8');
code = code.replace(/throw new Error\("Failed to subscribe: WebSocket is not open\."\);/g, 'console.error("Upstox WS disconnected. Retrying..."); return;');
fs.writeFileSync('node_modules/upstox-js-sdk/dist/feeder/MarketDataFeederV3.js', code);
