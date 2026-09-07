const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const advancedFields = `
  dailyMaxLossLimit: 500,
  enableAtrStopLoss: true, // Auto adjust SL based on volatility
  enableEmaSupertrendExit: true, // Exit on trend reversal
  enablePartialBooking: true, // Book 50% at target, trail rest
  enableTimeDecayProtection: true, // Auto exit options before 3 PM
  enableIndexCorrelation: true, // Check main NIFTY/BANKNIFTY chart
  marketRegimeFilter: true, // Sideways market detection
  dynamicPositionSizing: true, // AI confidence based sizing
  newsSentimentFilter: true, // News checks
  ivCrushProtection: true, // Options Greek IV checks
  autoKillSwitch: true, // Emotionless kill switch on max loss
  maxConsecutiveLosses: 3
`;

// It might be dailyMaxLossLimit: 500, enableAtrStopLoss: true...
// Let's just do a regex replace from dailyMaxLossLimit to enableIndexCorrelation: true
code = code.replace(
  /dailyMaxLossLimit: 500,[\s\S]*enableIndexCorrelation: true \/\/ Check main NIFTY\/BANKNIFTY chart/,
  advancedFields
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts botConfig");
