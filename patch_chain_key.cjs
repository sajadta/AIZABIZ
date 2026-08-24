const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldKeyLogic = `  const instrumentKey = symbol.includes('BANK') ? 'NSE_INDEX|Nifty Bank' : (symbol.includes('NIFTY') ? 'NSE_INDEX|Nifty 50' : \`NSE_INDEX|\${symbol}\`);`;
const newKeyLogic = `  const instrumentKey = getInstrumentKey(symbol);`;

code = code.replace(oldKeyLogic, newKeyLogic);
fs.writeFileSync('server.ts', code);
console.log('Patched option chain instrument key');
