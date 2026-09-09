const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The issue is in /api/trading/paper-sync:
// If the frontend sends the active option quotes, it only sends them if it's subscribed to them.
// But the frontend only subscribes to defaultKeys + activePositions.
// Wait, is activePositions' instrumentKey sent to frontend?
// Let's check /api/trading/positions
