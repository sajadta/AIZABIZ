const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `                 if (token) {
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
                 }`;

const replaceStr = `                 if (token) {
                     try {
                         // Get index instrument key
                         const idxKey = (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50';
                         // Get expiry dates
                         const contractRes = await fetch(\`https://api.upstox.com/v2/option/contract?instrument_key=\${encodeURIComponent(idxKey)}\`, {
                             headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json' }
                         });
                         const contractData = await contractRes.json();
                         if (contractData?.data?.length > 0) {
                             const today = new Date();
                             today.setHours(0,0,0,0);
                             const validExpiries = contractData.data
                                 .map((c: any) => c.expiry)
                                 .filter((e: any) => new Date(e).getTime() >= today.getTime())
                                 .sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime());
                             const expiryDate = validExpiries.length > 0 ? validExpiries[0] : contractData.data[0].expiry;
                             
                             const chainRes = await fetch(\`https://api.upstox.com/v2/option/chain?instrument_key=\${encodeURIComponent(idxKey)}&expiry_date=\${expiryDate}\`, {
                                 headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json' }
                             });
                             const chainData = await chainRes.json();
                             if (chainData?.data) {
                                 // Determine the strike from the signal
                                 const match = signal.symbol.match(/(\\d+)/);
                                 if (match) {
                                     const strike = parseInt(match[1]);
                                     const isCE = signal.symbol.includes('CE');
                                     const optionData = chainData.data.find((item: any) => item.strike_price === strike);
                                     if (optionData) {
                                         const opt = isCE ? optionData.call_options : optionData.put_options;
                                         if (opt && opt.market_data && opt.market_data.ltp) {
                                             const realOptionPrice = opt.market_data.ltp;
                                             // Re-run the analyzer with real option price
                                             signal = analyzeTradingSignals(
                                                 (botConfig as any).selectedSymbol || 'NIFTY 50', 
                                                 (botConfig as any).selectedSymbol || 'NIFTY 50', 
                                                 idxKey, 
                                                 enriched, 
                                                 currentLiveQuote, 
                                                 botConfig.selectedStrategy as any, 
                                                 realOptionPrice
                                             );
                                             // Also update the instrument key in the signal for future use
                                             if (opt.instrument_key) {
                                                 signal.instrumentKey = opt.instrument_key;
                                             }
                                         }
                                     }
                                 }
                             }
                         }
                     } catch(e) {}
                 }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts option chain logic");
