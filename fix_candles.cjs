const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.get\('\/api\/upstox\/candles', async \(req: Request, res: Response\) => \{[\s\S]*?\}\s*catch[^\}]*\}\s*\}\);/m;

const replacement = `app.get('/api/upstox/candles', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string);
  const interval = (req.query.interval as string) || '1m';
  const token = (req.headers.authorization?.replace('Bearer ', '') || upstoxConfig.accessToken);
  if (!token || !symbol) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Upstox API Token and symbol are required.' });
  }

  try {
    const instrumentKey = getInstrumentKey(symbol);
    let url = '';
    
    // Upstox API v2 historical candle interval accepts one of (1minute,30minute,day,week,month)
    if (interval === '1d') {
      const today = new Date();
      const toDate = today.toISOString().split('T')[0];
      const fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      url = \`https://api.upstox.com/v2/historical-candle/\${encodeURIComponent(instrumentKey)}/day/\${toDate}/\${fromDate}\`;
    } else {
      url = \`https://api.upstox.com/v2/historical-candle/intraday/\${encodeURIComponent(instrumentKey)}/1minute\`;
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json();
    
    if (data.status === 'success' && data.data && data.data.candles) {
      let rawCandles = data.data.candles.map((c: any) => ({
        timestamp: new Date(c[0]).getTime(),
        timeStr: new Date(c[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5]
      })).reverse();
      
      // Aggregate if needed
      let candles = rawCandles;
      if (interval === '5m') {
        candles = aggregateCandles(rawCandles, 5 * 60 * 1000);
      } else if (interval === '15m') {
        candles = aggregateCandles(rawCandles, 15 * 60 * 1000);
      } else if (interval === '30m') {
        candles = aggregateCandles(rawCandles, 30 * 60 * 1000);
      } else if (interval === '1h') {
        candles = aggregateCandles(rawCandles, 60 * 60 * 1000);
      }

      return res.json({ success: true, symbol, interval, candles });
    }
    return res.json({ success: true, symbol, interval, candles: [] });
  } catch (err: any) {
    return res.json({ success: true, symbol, interval, candles: [] }); 
  }
});`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  
  // Add aggregateCandles function if not exists
  if (!code.includes('function aggregateCandles')) {
    const aggFunc = `
function aggregateCandles(candles: any[], intervalMs: number) {
  if (!candles || candles.length === 0) return [];
  const aggregated: any[] = [];
  let currentGroup = null;
  
  for (const candle of candles) {
    // align timestamp to interval boundary
    const alignedTime = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    
    if (!currentGroup || currentGroup.timestamp !== alignedTime) {
      if (currentGroup) aggregated.push(currentGroup);
      currentGroup = {
        timestamp: alignedTime,
        timeStr: new Date(alignedTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      };
    } else {
      currentGroup.high = Math.max(currentGroup.high, candle.high);
      currentGroup.low = Math.min(currentGroup.low, candle.low);
      currentGroup.close = candle.close;
      currentGroup.volume += candle.volume;
    }
  }
  if (currentGroup) aggregated.push(currentGroup);
  return aggregated;
}
`;
    // Insert after getInstrumentKey
    code = code.replace(/const getInstrumentKey =/, aggFunc + '\nconst getInstrumentKey =');
  }
  
  fs.writeFileSync('server.ts', code);
  console.log('Fixed candles logic!');
} else {
  console.log('Regex did not match!');
}
