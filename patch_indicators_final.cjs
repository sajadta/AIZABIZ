const fs = require('fs');
let code = fs.readFileSync('src/utils/indicators.ts', 'utf8');

const rx = /if \(optSymbol\) \{[\s\S]*?optSL = Math.max\(.*?\);[\s\S]*?\}/m;

const replaceStr = `if (optSymbol) {
     let basePremium = 100;
     if (symbol.includes('BANK')) basePremium = 300;
     else if (symbol.includes('SENSEX')) basePremium = 350;
     
     // USE REAL OPTION PRICE IF AVAILABLE, OTHERWISE USE BASE
     optEntry = realOptionPrice ? realOptionPrice : basePremium;
     
     // Option Stop Loss: typically 20% of premium
     optSL = Number((optEntry * 0.8).toFixed(2));
     const risk = optEntry - optSL;
     
     // Targets based on Risk/Reward multipliers on the premium itself
     optT1 = Number((optEntry + risk * 1.5).toFixed(2));
     optT2 = Number((optEntry + risk * 2.5).toFixed(2));
     optT3 = Number((optEntry + risk * 4.0).toFixed(2));
  }`;

code = code.replace(rx, replaceStr);
fs.writeFileSync('src/utils/indicators.ts', code);
console.log("Patched indicators.ts completely");
