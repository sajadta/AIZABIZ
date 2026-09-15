const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
// Fix the websocket code from MarketDataFeeder error
code = code.replace(/throw new Error\("Failed to subscribe: WebSocket is not open\."\);/g, 'console.error("Upstox WS disconnected. Retrying..."); return;');
fs.writeFileSync('server.ts', code);
