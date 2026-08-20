const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const mockQuotesTarget = `    // Fallback to dynamic mock data
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
      { symbol: 'INFY', name: 'Infosys', ltp: 1750.0 + jitter(), change: -10 + jitter(), changePercent: -0.5, segment: 'EQUITY', high: 1780, low: 1740, volume: 9000000 }
    ]);`;

const mockQuotesReplacement = `    // Fallback to dynamic mock data
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

code = code.replace(mockQuotesTarget, mockQuotesReplacement);
fs.writeFileSync('server.ts', code);
