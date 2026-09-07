const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');

const advancedFields = `
  // Advanced Institutional Settings
  marketRegimeFilter?: boolean; // Sideways market detection
  dynamicPositionSizing?: boolean; // AI confidence based sizing
  newsSentimentFilter?: boolean; // Gemini API news checks
  ivCrushProtection?: boolean; // Options Greek IV checks
  autoKillSwitch?: boolean; // Emotionless kill switch on max loss
  maxConsecutiveLosses?: number;
`;

code = code.replace(
  /dailyLossLocked\?: boolean;/,
  `dailyLossLocked?: boolean;${advancedFields}`
);

fs.writeFileSync('src/types.ts', code);
console.log("Patched types.ts");
