const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const mockOptions = `
  if (!token) {
    // Generate a beautiful mock option chain if no token
    const strikes = [];
    const baseLTP = symbol.includes('BANK') ? 52000 : (symbol.includes('FIN') ? 23000 : 24500);
    for (let i = -5; i <= 5; i++) {
       const strikePrice = baseLTP + (i * 50);
       strikes.push({
          strikePrice,
          callOI: Math.floor(Math.random() * 100000),
          callChangeOI: Math.floor(Math.random() * 50000) - 25000,
          callLTP: Math.max(0.5, 200 - (i * 15) + Math.random() * 10),
          callIV: 15 + Math.random() * 5,
          callVolume: Math.floor(Math.random() * 500000),
          callDelta: 0.5 - (i * 0.08),
          putOI: Math.floor(Math.random() * 100000),
          putChangeOI: Math.floor(Math.random() * 50000) - 25000,
          putLTP: Math.max(0.5, 200 + (i * 15) + Math.random() * 10),
          putIV: 15 + Math.random() * 5,
          putVolume: Math.floor(Math.random() * 500000),
          putDelta: -0.5 - (i * 0.08),
       });
    }
    return res.json({
      underlyingSymbol: symbol,
      underlyingLTP: baseLTP,
      expiryDates: [new Date().toISOString().split('T')[0], '2026-08-27'],
      selectedExpiry: new Date().toISOString().split('T')[0],
      strikes,
      pcr: 1.15,
      maxPain: baseLTP,
      totalCallOI: 1500000,
      totalPutOI: 1700000,
    });
  }
`;

code = code.replace(
  `  if (!token || !symbol) {
    return res.json(defaultEmptyResponse);
  }`,
  `  if (!symbol) return res.json(defaultEmptyResponse);\n${mockOptions}`
);

fs.writeFileSync('server.ts', code);
