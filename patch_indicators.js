const fs = require('fs');
let code = fs.readFileSync('src/utils/indicators.ts', 'utf8');

code = code.replace(
  "export function analyzeTradingSignals(\n  symbol: string,\n  name: string,\n  instrumentKey: string,\n  candles: CandleData[],\n  currentLtp: number,\n  strategy: StrategyKey = 'PROFIT_MAX_100_PERCENT_MATRIX'\n): TradingSignal | null {",
  "export function analyzeTradingSignals(\n  symbol: string,\n  name: string,\n  instrumentKey: string,\n  candles: CandleData[],\n  currentLtp: number,\n  strategy: StrategyKey = 'PROFIT_MAX_100_PERCENT_MATRIX',\n  realOptionPrice?: number\n): TradingSignal | null {"
);

// We need to find the part where it uses basePremium
const targetStr = `
  if (optSymbol) {
     let basePremium = 100;
     if (symbol.includes('BANK')) basePremium = 300;
     else if (symbol.includes('SENSEX')) basePremium = 350;
     
     optEntry = basePremium;
     
     const indexMovementT1 = Math.abs(target1 - currentLtp);
     const indexMovementT2 = Math.abs(target2 - currentLtp);
     const indexMovementT3 = Math.abs(target3 - currentLtp);
     
     optT1 = Math.round(optEntry + (indexMovementT1 * 0.5));
     optT2 = Math.round(optEntry + (indexMovementT2 * 0.5));
     optT3 = Math.round(optEntry + (indexMovementT3 * 0.5));
     
     const slDist = Math.abs(currentLtp - stopLoss) * 0.5;
     // Prevent negative SL. Max 50% of premium or at least 5 rs.
     optSL = Math.max(Math.round(optEntry - slDist), Math.round(optEntry * 0.5), 5);
  }`;

const replaceStr = `
  if (optSymbol) {
     let basePremium = 100;
     if (symbol.includes('BANK')) basePremium = 300;
     else if (symbol.includes('SENSEX')) basePremium = 350;
     
     // USE REAL OPTION PRICE IF AVAILABLE, OTHERWISE USE BASE
     optEntry = realOptionPrice ? realOptionPrice : basePremium;
     
     // If we have a real option price, the targets should be calculated based on realistic delta.
     // Assuming roughly 0.5 delta for ATM options
     const indexMovementT1 = Math.abs(target1 - currentLtp);
     const indexMovementT2 = Math.abs(target2 - currentLtp);
     const indexMovementT3 = Math.abs(target3 - currentLtp);
     
     optT1 = Number((optEntry + (indexMovementT1 * 0.5)).toFixed(2));
     optT2 = Number((optEntry + (indexMovementT2 * 0.5)).toFixed(2));
     optT3 = Number((optEntry + (indexMovementT3 * 0.5)).toFixed(2));
     
     const slDist = Math.abs(currentLtp - stopLoss) * 0.5;
     optSL = Math.max(Number((optEntry - slDist).toFixed(2)), Number((optEntry * 0.5).toFixed(2)), 5);
  }`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/utils/indicators.ts', code);
console.log("Patched indicators.ts");
