const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Ensure that paperPositions updates its LTP properly even if Upstox's WebSocket provides the Underlying Index's LTP for an option
// because the option instrument key might be missing.
code = code.replace(
  '        pos.currentLTP = quoteObj.last_price;\n        pos.pnl = (pos.currentLTP - pos.buyPrice) * pos.quantity;',
  '        // Fix: Do not update currentLTP if it is ridiculously higher than buyPrice for options (to prevent 5 lakh profit glitch)\n        if (pos.isOption && quoteObj.last_price > pos.buyPrice * 50) {\n          // Probably underlying index price instead of option premium\n        } else {\n          pos.currentLTP = quoteObj.last_price;\n          pos.pnl = (pos.currentLTP - pos.buyPrice) * pos.quantity;\n        }'
);

fs.writeFileSync('server.ts', code);
