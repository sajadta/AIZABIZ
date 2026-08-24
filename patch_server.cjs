const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Fix Option Chain Expiry Selection
const oldExpiryLogic = `     // Find nearest expiry date
     const expiryDate = contractData.data[0].expiry; // Assume first is nearest, or sort by date. Upstox returns sorted.`;

const newExpiryLogic = `     // Find nearest valid expiry date
     const today = new Date();
     today.setHours(0,0,0,0);
     const validExpiries = contractData.data
         .map((c) => c.expiry)
         .filter((e) => new Date(e).getTime() >= today.getTime())
         .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
     const expiryDate = validExpiries.length > 0 ? validExpiries[0] : contractData.data[0].expiry;`;

code = code.replace(oldExpiryLogic, newExpiryLogic);

// 2. Fix historical candles API to accept instrumentKey from query
const oldCandleLogic = `  try {
    const instrumentKey = getInstrumentKey(symbol);
    let url = '';`;

const newCandleLogic = `  try {
    let instrumentKey = (req.query.instrumentKey) || getInstrumentKey(symbol);
    let url = '';`;

code = code.replace(oldCandleLogic, newCandleLogic);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
