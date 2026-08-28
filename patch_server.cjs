const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `             const signal = analyzeTradingSignals((botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50', enriched, currentLiveQuote, botConfig.selectedStrategy as any);
             
             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL')) {`;

const replaceStr = `             let signal = analyzeTradingSignals((botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50', enriched, currentLiveQuote, botConfig.selectedStrategy as any);
             
             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL')) {
                 if (token) {
                     const optInstrumentKey = 'NSE_FO|' + signal.symbol;
                     try {
                         const optRes = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${encodeURIComponent(optInstrumentKey)}\`, {
                            headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
                         });
                         const optData = await optRes.json();
                         if (optData?.data?.[optInstrumentKey]?.last_price) {
                            const realOptionPrice = optData.data[optInstrumentKey].last_price;
                            signal = analyzeTradingSignals((botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedSymbol || 'NIFTY 50', (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50', enriched, currentLiveQuote, botConfig.selectedStrategy as any, realOptionPrice);
                         }
                     } catch(e) {}
                 }
                 
                 botSignals.unshift(signal);`;

code = code.replace(targetStr, replaceStr);

// Also update paper trading execution to use signal.price if real
const targetStr2 = `                   let optionPrice = 150; // default fallback
                   try {
                       const optRes = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${encodeURIComponent('NSE_FO|'+optionSymbol) }\`, {
                          headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
                       });
                       const optData = await optRes.json();
                       const optKey = 'NSE_FO|' + optionSymbol;
                       if (optData?.data?.[optKey]?.last_price)  {
                          optionPrice = optData.data[optKey].last_price;
                       }
                   } catch(e)  {}`;

const replaceStr2 = `                   let optionPrice = signal.price;`;

code = code.replace(targetStr2, replaceStr2);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
