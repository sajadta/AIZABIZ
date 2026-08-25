const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix 1: Timezone issue in historical candles
code = code.replace(
  /timeStr: new Date\(c\[0\]\) \.toLocaleTimeString\('en-IN', \{ hour: '2-digit', minute: '2-digit' \}\)/g,
  "timeStr: new Date(c[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })"
);

// Fix 2: Gemini Analysis Prompt to include advanced greeks and fake moves
const oldPromptPart = `Analyze the given trading data and provide a concise market analysis.`;
const newPromptPart = `Analyze the given trading data and provide a concise, high-level institutional market analysis. 
Consider and explicitly mention advanced factors like Option Greeks (IV, Theta, Gamma), potential Fake Breakouts (Trap moves), Corporate Action impacts, and institutional volume patterns even if inferred from the candlestick structures.`;

code = code.replace(oldPromptPart, newPromptPart);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts for time and prompt');
