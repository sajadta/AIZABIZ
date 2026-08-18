const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.get\('\/api\/upstox\/quotes'[\s\S]*?\}\);/g;

const replacement = `app.get('/api/upstox/quotes', async (req: Request, res: Response) => {
  const token = (req.headers.authorization?.replace('Bearer ', '') || upstoxConfig.accessToken);
  const symbolsQuery = (req.query.symbols as string) || 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,NSE_INDEX|Nifty Fin Service,NSE_EQ|INE002A01018,NSE_EQ|INE040A01034';

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token is required for real-time quotes.' });
  }

  try {
    const instruments = symbolsQuery.split(',').map(s => encodeURIComponent(s.trim())).join(',');
    const response = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${instruments}\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    if (data.status === 'success' && data.data) {
      // Transform Upstox dictionary format to array of StockQuote expected by frontend
      const quotesArray = Object.keys(data.data).map(key => {
        const item = data.data[key];
        // Calculate change
        const ltp = item.last_price || 0;
        const close = item.ohlc?.close || ltp;
        const change = Number((ltp - close).toFixed(2));
        const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;
        
        // Convert 'NSE_INDEX|Nifty 50' to symbol 'NIFTY 50'
        const symbolParts = key.split('|');
        const symbolDisplay = item.symbol || (symbolParts.length > 1 ? symbolParts[1].toUpperCase() : key);

        return {
          symbol: symbolDisplay,
          name: symbolDisplay,
          instrumentKey: key,
          exchange: 'NSE', // Hardcoded fallback
          segment: key.includes('INDEX') ? 'INDEX' : 'EQUITY',
          ltp: ltp,
          change: change,
          changePercent: changePercent,
          open: item.ohlc?.open || 0,
          high: item.ohlc?.high || 0,
          low: item.ohlc?.low || 0,
          close: close,
          volume: item.volume || 0,
          vwap: item.average_price || ltp,
          lastTradeTime: new Date().toISOString()
        };
      });
      return res.json({ success: true, source: 'UPSTOX_LIVE_V2', quotes: quotesArray });
    }
    return res.status(400).json({ success: false, error: 'Failed to fetch quotes', details: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});`;

server = server.replace(regex, replacement);

fs.writeFileSync('server.ts', server);
console.log('fixed quotes api');
