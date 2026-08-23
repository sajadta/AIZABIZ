const fs = require('fs');
let lines = fs.readFileSync('server.ts', 'utf8').split('\n');

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// 6. Option Chain Data')) {
        startIndex = i;
    }
    if (startIndex !== -1 && i > startIndex && lines[i].includes('});') && lines[i-1] && lines[i-1].includes('totalPutOI')) {
        endIndex = i;
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `// 6. Option Chain Data (Real Upstox API with Fallback)
let lastKnownOptionChain: any = {};

app.get('/api/upstox/optionchain', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || 'NIFTY 50';
  const instrumentKey = symbol.includes('BANK') ? 'NSE_INDEX|Nifty Bank' : (symbol.includes('NIFTY') ? 'NSE_INDEX|Nifty 50' : \`NSE_INDEX|\${symbol}\`);
  const token = upstoxConfig.accessToken;

  if (!token) {
     if (lastKnownOptionChain[symbol]) {
        return res.json(lastKnownOptionChain[symbol]);
     }
     return res.json({ error: 'Upstox Token Missing', strikes: [] });
  }

  try {
     // Fetch contract to get expiry dates
     const contractRes = await fetch(\`https://api.upstox.com/v2/option/contract?instrument_key=\${encodeURIComponent(instrumentKey)}\`, {
         headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json' }
     });
     
     if (!contractRes.ok) {
         throw new Error('Failed to fetch contracts');
     }
     
     const contractData = await contractRes.json();
     if (!contractData.data || contractData.data.length === 0) {
         throw new Error('No contracts found');
     }
     
     // Find nearest expiry date
     const expiryDate = contractData.data[0].expiry; // Assume first is nearest, or sort by date. Upstox returns sorted.

     // Fetch option chain
     const chainRes = await fetch(\`https://api.upstox.com/v2/option/chain?instrument_key=\${encodeURIComponent(instrumentKey)}&expiry_date=\${expiryDate}\`, {
         headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json' }
     });
     
     if (!chainRes.ok) {
         throw new Error('Failed to fetch option chain');
     }
     
     const chainData = await chainRes.json();
     
     if (chainData && chainData.data) {
         let totalCallOI = 0;
         let totalPutOI = 0;
         const strikes = chainData.data.map((item: any) => {
             const call = item.call_options || {};
             const put = item.put_options || {};
             const callOI = call.market_data?.oi || 0;
             const putOI = put.market_data?.oi || 0;
             totalCallOI += callOI;
             totalPutOI += putOI;
             
             return {
                 strikePrice: item.strike_price,
                 callLTP: call.market_data?.ltp || 0,
                 putLTP: put.market_data?.ltp || 0,
                 callOI,
                 putOI,
                 callChangeOI: call.market_data?.oi_change || 0,
                 putChangeOI: put.market_data?.oi_change || 0,
                 callVolume: call.market_data?.volume || 0,
                 putVolume: put.market_data?.volume || 0,
                 callDelta: call.option_greeks?.delta || 0,
                 putDelta: put.option_greeks?.delta || 0,
                 callIV: call.option_greeks?.iv || 0,
                 putIV: put.option_greeks?.iv || 0,
                 callInstrumentKey: call.instrument_key || '',
                 putInstrumentKey: put.instrument_key || ''
             };
         });
         
         const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 1;
         
         const result = {
            underlyingSymbol: symbol,
            underlyingLTP: chainData.data[0]?.underlying_price || 0,
            timestamp: new Date().toISOString(),
            expiryDates: [expiryDate],
            selectedExpiry: expiryDate,
            strikes,
            pcr,
            maxPain: strikes.length > 0 ? strikes[Math.floor(strikes.length/2)].strikePrice : 0,
            totalCallOI,
            totalPutOI
         };
         
         lastKnownOptionChain[symbol] = result;
         return res.json(result);
     }
     throw new Error('Invalid chain data');
  } catch (error) {
     console.error('Error fetching Option Chain:', error);
     // Fallback to last known if available
     if (lastKnownOptionChain[symbol]) {
         return res.json(lastKnownOptionChain[symbol]);
     }
     return res.status(500).json({ error: 'Failed to fetch option chain', strikes: [] });
  }
});`;

    lines.splice(startIndex, endIndex - startIndex + 1, replacement);
    fs.writeFileSync('server.ts', lines.join('\n'));
    console.log('Replaced lines from', startIndex, 'to', endIndex);
} else {
    console.log('Could not find start or end index', startIndex, endIndex);
}
