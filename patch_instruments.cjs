const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const instTarget = `const getInstrumentKey = (symbol: string) => {
  const s = symbol.toUpperCase();
  if (s.includes('NIFTY 50')) return 'NSE_INDEX|Nifty 50';
  if (s.includes('BANK')) return 'NSE_INDEX|Nifty Bank';
  if (s.includes('FIN')) return 'NSE_INDEX|Nifty Fin Service';
  if (s.includes('RELIANCE')) return 'NSE_EQ|INE002A01018';
  if (s.includes('HDFC')) return 'NSE_EQ|INE040A01034';
  return symbol;
};`;

const instReplacement = `const getInstrumentKey = (symbol: string) => {
  const s = symbol.toUpperCase();
  if (s.includes('NIFTY 50')) return 'NSE_INDEX|Nifty 50';
  if (s.includes('NIFTY BANK') || s === 'BANKNIFTY') return 'NSE_INDEX|Nifty Bank';
  if (s.includes('FIN SERVICE') || s === 'FINNIFTY') return 'NSE_INDEX|Nifty Fin Service';
  if (s.includes('MID SELECT')) return 'NSE_INDEX|NIFTY MID SELECT';
  if (s.includes('SENSEX')) return 'BSE_INDEX|SENSEX';
  if (s.includes('BANKEX')) return 'BSE_INDEX|BANKEX';
  if (s.includes('RELIANCE')) return 'NSE_EQ|INE002A01018';
  if (s.includes('HDFCBANK') || s === 'HDFC') return 'NSE_EQ|INE040A01034';
  if (s.includes('TCS')) return 'NSE_EQ|INE467B01029';
  if (s.includes('INFY')) return 'NSE_EQ|INE009A01021';
  return symbol;
};`;

code = code.replace(instTarget, instReplacement);

const mockQuotesTarget = `    // Fallback to mock data so UI doesn't break entirely
    return res.json([
      { symbol: 'NIFTY 50', name: 'Nifty 50', ltp: 24500.5, change: 100, changePercent: 0.4, segment: 'INDEX' },
      { symbol: 'NIFTY BANK', name: 'Bank Nifty', ltp: 52000.2, change: -150, changePercent: -0.3, segment: 'INDEX' },
      { symbol: 'NIFTY FIN SERVICE', name: 'Fin Nifty', ltp: 23100.0, change: 25, changePercent: 0.1, segment: 'INDEX' },
      { symbol: 'NIFTY MID SELECT', name: 'Midcap Nifty', ltp: 12500.0, change: 80, changePercent: 0.6, segment: 'INDEX' },
      { symbol: 'SENSEX', name: 'BSE Sensex', ltp: 80500.0, change: 300, changePercent: 0.38, segment: 'INDEX' },
      { symbol: 'BANKEX', name: 'BSE Bankex', ltp: 58000.0, change: -200, changePercent: -0.34, segment: 'INDEX' },
      { symbol: 'RELIANCE', name: 'Reliance Ind', ltp: 3100.0, change: 15, changePercent: 0.5, segment: 'EQUITY' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank', ltp: 1650.0, change: 5, changePercent: 0.3, segment: 'EQUITY' }
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
      { symbol: 'INFY', name: 'Infosys', ltp: 1750.0 + jitter(), change: -10 + jitter(), changePercent: -0.5, segment: 'EQUITY', high: 1780, low: 1740, volume: 9000000 }
    ]);`;

code = code.replace(mockQuotesTarget, mockQuotesReplacement);

fs.writeFileSync('server.ts', code);
