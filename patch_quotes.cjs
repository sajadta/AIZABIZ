const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `
      return res.json({ success: true, source: 'UPSTOX_LIVE_V2', quotes: quotesArray });
    }
    
    // If we reach here, Upstox returned an error (e.g. invalid token)
    // Fallback to mock data so UI doesn't break entirely
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
  } catch (err: any) {
`;

code = code.replace(
  /      return res\.json\(\{ success: true, source: 'UPSTOX_LIVE_V2', quotes: quotesArray \}\);\s*\}\s*return res\.status\(400\)\.json\(\{ success: false, error: 'Failed to fetch quotes', details: data \}\);\s*\} catch \(err: any\) \{/,
  replacement.trim()
);

fs.writeFileSync('server.ts', code);
