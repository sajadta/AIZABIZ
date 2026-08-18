const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Add getNextExpiry function
const getNextExpiryFn = `
const getNextExpiry = (symbol: string) => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  let targetDay = 4; // Default to Thursday (Nifty)
  
  if (symbol.includes('BANK')) targetDay = 3; // Wednesday
  else if (symbol.includes('FIN')) targetDay = 2; // Tuesday
  else if (symbol.includes('MIDCP')) targetDay = 1; // Monday
  
  let diff = targetDay - dayOfWeek;
  if (diff < 0) diff += 7;
  
  const expiryDate = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split('T')[0];
};
`;

if (!code.includes('getNextExpiry')) {
  code = code.replace('const PORT = 3000;', getNextExpiryFn + '\nconst PORT = 3000;');
}

// 2. Fix Option Chain to use getNextExpiry instead of today
code = code.replace(
  "const today = new Date().toISOString().split('T')[0]; // Note: Upstox needs exact valid expiry date.",
  "const today = getNextExpiry(symbol); // Dynamically find the nearest correct expiry date for Upstox"
);

// 3. Provide default mock quotes if !token instead of failing hard, so the UI is populated
const defaultQuotesCode = `
  if (!token) {
    // Return standard mock indices so the UI doesn't look broken when no token is present.
    // They will just be static placeholders until a real token is entered.
    return res.json([
      { symbol: 'NIFTY 50', name: 'Nifty 50', ltp: 24500.5, change: 100, changePercent: 0.4, segment: 'INDEX' },
      { symbol: 'NIFTY BANK', name: 'Bank Nifty', ltp: 52000.2, change: -150, changePercent: -0.3, segment: 'INDEX' },
      { symbol: 'NIFTY FIN SERVICE', name: 'Fin Nifty', ltp: 23100.0, change: 25, changePercent: 0.1, segment: 'INDEX' },
      { symbol: 'RELIANCE', name: 'Reliance Ind', ltp: 3100.0, change: 15, changePercent: 0.5, segment: 'EQUITY' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank', ltp: 1650.0, change: 5, changePercent: 0.3, segment: 'EQUITY' }
    ]);
  }
`;

code = code.replace(
  `  if (!token) {
    return res.status(400).json({ success: false, error: 'Token is required for real-time quotes.' });
  }`,
  defaultQuotesCode
);

fs.writeFileSync('server.ts', code);
