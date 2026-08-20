const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Remove initial mock indices
const mockIndicesTarget = `  if (!token) {
    // Return standard mock indices so the UI doesn't look broken when no token is present.
    // They will just be static placeholders until a real token is entered.
    return res.json([
      { symbol: 'NIFTY 50', name: 'Nifty 50', ltp: 24500.5, change: 100, changePercent: 0.4, segment: 'INDEX' },
      { symbol: 'NIFTY BANK', name: 'Bank Nifty', ltp: 52000.2, change: -150, changePercent: -0.3, segment: 'INDEX' },
      { symbol: 'NIFTY FIN SERVICE', name: 'Fin Nifty', ltp: 23100.0, change: 25, changePercent: 0.1, segment: 'INDEX' },
      { symbol: 'NIFTY MID SELECT', name: 'Midcap Nifty', ltp: 12500.0, change: 80, changePercent: 0.6, segment: 'INDEX' },
      { symbol: 'SENSEX', name: 'BSE Sensex', ltp: 80500.0, change: 300, changePercent: 0.38, segment: 'INDEX' },
      { symbol: 'BANKEX', name: 'BSE Bankex', ltp: 58000.0, change: -200, changePercent: -0.34, segment: 'INDEX' },
      { symbol: 'RELIANCE', name: 'Reliance Ind', ltp: 3100.0, change: 15, changePercent: 0.5, segment: 'EQUITY' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank', ltp: 1650.0, change: 5, changePercent: 0.3, segment: 'EQUITY' }
    ]);
  }`;
const mockIndicesReplacement = `  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Upstox API Token is required.' });
  }`;

if (code.includes(mockIndicesTarget)) {
    code = code.replace(mockIndicesTarget, mockIndicesReplacement);
} else {
    console.log("mockIndicesTarget not found");
}

// 2. Remove fallback dynamic mock data
const mockDynamicTarget = `    // If we reach here, Upstox returned an error (e.g. invalid token)
    // Fallback to dynamic mock data
    const jitter = () => (Math.random() - 0.5) * 5;
    return res.json([
      { symbol: 'NIFTY 50', name: 'Nifty 50', ltp: 24500.5 + jitter(), change: 100 + jitter(), changePercent: 0.4, segment: 'INDEX', high: 24600, low: 24400, volume: 15000000 },
      { symbol: 'NIFTY BANK', name: 'Bank Nifty', ltp: 52000.2 + jitter(), change: -150 + jitter(), changePercent: -0.3, segment: 'INDEX', high: 52200, low: 51800, volume: 12000000 },
      { symbol: 'NIFTY FIN SERVICE', name: 'Fin Nifty', ltp: 23100.0 + jitter(), change: 25 + jitter(), changePercent: 0.1, segment: 'INDEX', high: 23200, low: 23000, volume: 5000000 },
      { symbol: 'NIFTY MID SELECT', name: 'Midcap Nifty', ltp: 12500.0 + jitter(), change: 80 + jitter(), changePercent: 0.6, segment: 'INDEX', high: 12600, low: 12400, volume: 8000000 },
      { symbol: 'SENSEX', name: 'BSE Sensex', ltp: 80500.0 + jitter(), change: 300 + jitter(), changePercent: 0.38, segment: 'INDEX', high: 80800, low: 80200, volume: 10000000 },
      { symbol: 'BANKEX', name: 'BSE Bankex', ltp: 58000.0 + jitter(), change: -200 + jitter(), changePercent: -0.34, segment: 'INDEX', high: 58300, low: 57800, volume: 4000000 },
      { symbol: 'RELIANCE', name: 'Reliance Ind', ltp: 3100.0 + jitter(), change: 15 + jitter(), changePercent: 0.5, segment: 'EQUITY', high: 3150, low: 3080, volume: 8000000 },
      { symbol: 'HDFCBANK', name: 'HDFC Bank', ltp: 1650.0 + jitter(), change: 5 + jitter(), changePercent: 0.3, segment: 'EQUITY', high: 1670, low: 1640, volume: 12000000 },
      { symbol: 'TCS', name: 'TCS', ltp: 4200.0 + jitter(), change: 45 + jitter(), changePercent: 1.1, segment: 'EQUITY', high: 4250, low: 4150, volume: 6000000 },
      { symbol: 'INFY', name: 'Infosys', ltp: 1750.0 + jitter(), change: -10 + jitter(), changePercent: -0.5, segment: 'EQUITY', high: 1780, low: 1740, volume: 9000000 },
      { symbol: 'NASDAQ', name: 'NASDAQ 100', ltp: 19500.0 + jitter()*3, change: 120 + jitter(), changePercent: 0.62, segment: 'GLOBAL', high: 19600, low: 19300, volume: 0 },
      { symbol: 'DOW JONES', name: 'Dow Jones', ltp: 40500.0 + jitter()*2, change: -50 + jitter(), changePercent: -0.12, segment: 'GLOBAL', high: 40600, low: 40300, volume: 0 },
      { symbol: 'S&P 500', name: 'S&P 500', ltp: 5500.0 + jitter(), change: 20 + jitter(), changePercent: 0.36, segment: 'GLOBAL', high: 5520, low: 5480, volume: 0 },
      { symbol: 'GIFT NIFTY', name: 'GIFT Nifty', ltp: 24550.0 + jitter(), change: 50 + jitter(), changePercent: 0.2, segment: 'GLOBAL', high: 24600, low: 24450, volume: 0 }
    ]);`;
const mockDynamicReplacement = `    // If we reach here, Upstox returned an error
    return res.status(400).json({ success: false, error: data.errors?.[0]?.message || 'Failed to fetch Upstox data' });`;

if (code.includes(mockDynamicTarget)) {
    code = code.replace(mockDynamicTarget, mockDynamicReplacement);
} else {
    console.log("mockDynamicTarget not found");
}

// 3. Remove mock candles
const mockCandlesRegex = /if \(\!token \|\| \!symbol\) \{\s*\/\/ Return mock candles so the chart has data in demo mode[\s\S]*?return res\.json\(\{ success: true, symbol, interval, candles: mockCandles \}\);\s*\}/;
const mockCandlesReplacement = `if (!token || !symbol) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Upstox API Token and symbol are required.' });
  }`;

if (mockCandlesRegex.test(code)) {
    code = code.replace(mockCandlesRegex, mockCandlesReplacement);
} else {
    console.log("mockCandlesRegex not found");
}

// 4. Remove mock option chain
const mockOptionsRegex = /if \(\!token\) \{\s*\/\/ Generate a beautiful mock option chain if no token[\s\S]*?totalPutOI: 1700000,\s*\}\);\s*\}/;
const mockOptionsReplacement = `if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Upstox API Token is required.' });
  }`;
  
if (mockOptionsRegex.test(code)) {
    code = code.replace(mockOptionsRegex, mockOptionsReplacement);
} else {
    console.log("mockOptionsRegex not found");
}

fs.writeFileSync('server.ts', code);
