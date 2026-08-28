const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    // 2. If no positions, look for entry
    if (activePositions.length === 0)  {
       // Fetch candles
       if (token)  {
          const today = new Date();
          const toDate = today.toISOString() .split('T') [0];
          const url = \`https://api.upstox.com/v2/historical-candle/intraday/\${encodeURIComponent((botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50')}/1minute\`;
          
          const cRes = await fetch(url, { headers: { 'Accept': 'application/json', 'Api-Version': '2.0' } });
          const cData = await cRes.json();
          if (cData.status === 'success' && cData.data?.candles)  {
             let rawCandles = cData.data.candles.map((c: any)  => ({
                timestamp: new Date(c[0]) .getTime(),
                timeStr: new Date(c[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
                open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
             })) .reverse();
             
             const enriched = enrichCandlesWithIndicators(rawCandles);
             let signal = analyzeTradingSignals((botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50', enriched, currentLiveQuote, botConfig.selectedStrategy as any);
             
             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL')) {`;

const replaceStr = `    // 2. If no positions, look for entry
    if (activePositions.length === 0 && token)  {
       const scanIndices = [
          { key: 'NSE_INDEX|Nifty 50', symbol: 'NIFTY 50' },
          { key: 'NSE_INDEX|Nifty Bank', symbol: 'NIFTY BANK' },
          { key: 'BSE_INDEX|SENSEX', symbol: 'SENSEX' },
          { key: 'NSE_INDEX|Nifty Fin Service', symbol: 'NIFTY FIN SERVICE' }
       ];
       
       for (const idx of scanIndices) {
          const today = new Date();
          const toDate = today.toISOString().split('T')[0];
          const url = \`https://api.upstox.com/v2/historical-candle/intraday/\${encodeURIComponent(idx.key)}/1minute\`;
          
          try {
              const cRes = await fetch(url, { headers: { 'Accept': 'application/json', 'Api-Version': '2.0' } });
              const cData = await cRes.json();
              
              if (cData.status === 'success' && cData.data?.candles)  {
                 let rawCandles = cData.data.candles.map((c: any)  => ({
                    timestamp: new Date(c[0]).getTime(),
                    timeStr: new Date(c[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
                    open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
                 })).reverse();
                 
                 const enriched = enrichCandlesWithIndicators(rawCandles);
                 
                 // Get live quote for this specific index
                 let liveLtp = rawCandles[rawCandles.length-1].close;
                 const qRes = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${encodeURIComponent(idx.key)}\`, {
                    headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
                 });
                 const qData = await qRes.json();
                 if (qData?.data?.[idx.key]?.last_price) {
                     liveLtp = qData.data[idx.key].last_price;
                 }

                 let signal = analyzeTradingSignals(idx.symbol, idx.symbol, idx.key, enriched, liveLtp, botConfig.selectedStrategy as any);
                 
                 if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL')) {`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log("Patched server bot loop part 1");
