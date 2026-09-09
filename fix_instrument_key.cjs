const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The issue is that the instrument key logic might fall back to "NSE_FO|NIFTY 23550 PE" which is an invalid format.
// And if it doesn't get the real instrument key, the WebSocket won't stream its LTP, 
// AND if it does get the underlying instrument key via a bug, it will stream the underlying's LTP (23500) and compare it against the option price (100).
