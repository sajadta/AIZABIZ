const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Add new config fields
code = code.replace(
    /dailyMaxLossLimit: 500/,
    `dailyMaxLossLimit: 500,
  enableAtrStopLoss: true, // Auto adjust SL based on volatility
  enableEmaSupertrendExit: true, // Exit on trend reversal
  enablePartialBooking: true, // Book 50% at target, trail rest
  enableTimeDecayProtection: true, // Auto exit options before 3 PM
  enableIndexCorrelation: true // Check main NIFTY/BANKNIFTY chart`
);

fs.writeFileSync('server.ts', code);
console.log("Patched advanced bot configs");
