const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    const instruments = (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50';
    if (token)  {
        const qRes = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${encodeURIComponent(instruments) }\`, {
          headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
        });
        const qData = await qRes.json();
        if (qData?.data?.[instruments]?.last_price)  {
           currentLiveQuote = qData.data[instruments].last_price;
        }
    }`;

const replaceStr = `    let instruments = [(botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50'];
    activePositions.forEach(p => {
       if (p.instrumentKey && !instruments.includes(p.instrumentKey)) {
           instruments.push(p.instrumentKey);
       }
    });
    
    let liveQuotesMap: any = {};
    if (token)  {
        try {
            const qRes = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${encodeURIComponent(instruments.join(','))}\`, {
              headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
            });
            const qData = await qRes.json();
            if (qData?.data)  {
               liveQuotesMap = qData.data;
               const mainKey = (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50';
               if (liveQuotesMap[mainKey]?.last_price) {
                   currentLiveQuote = liveQuotesMap[mainKey].last_price;
               }
            }
        } catch(e) {}
    }`;

code = code.replace(targetStr, replaceStr);

const targetStr2 = `        for (let pos of activePositions)  {
      if (pos.type === 'BUY' && pos.symbol.includes('CE')  || pos.symbol.includes('PE'))  {
         // It'scan option. We need option LTP.
          // For now, simulate option price  movement based on Index  movement if we don't have live option quotes.
         const ltp = pos.currentLTP || pos.buyPrice; // updated via frontend paper-sync or live sync`;

const replaceStr2 = `        for (let pos of activePositions)  {
      if (pos.type === 'BUY' && pos.symbol.includes('CE')  || pos.symbol.includes('PE'))  {
         // Update LTP natively from backend if we fetched it
         if (pos.instrumentKey && liveQuotesMap[pos.instrumentKey]?.last_price) {
             pos.currentLTP = liveQuotesMap[pos.instrumentKey].last_price;
             pos.pnl = (pos.currentLTP - pos.buyPrice) * pos.quantity;
         }
         const ltp = pos.currentLTP || pos.buyPrice;`;

code = code.replace(targetStr2, replaceStr2);

fs.writeFileSync('server.ts', code);
console.log("Patched server live quotes loop");
