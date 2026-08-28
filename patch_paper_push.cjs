const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = "                   paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: botQty, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY', isOption: true });";

const replaceStr = "                   const optInstrumentKey = signal.instrumentKey || 'NSE_FO|' + optionSymbol;\n                   paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, instrumentKey: optInstrumentKey, quantity: botQty, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY', isOption: true });";

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log("Patched paper positions push");
