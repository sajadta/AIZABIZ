const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL') && signal.confidenceScore >= botConfig.minConfidence) {
                // Execute Trade on Option!
                const isBullish = signal.signalType === 'BUY';
                let step = 50;
                let optPrefix = 'NIFTY';
                const sym = (botConfig as any).selectedSymbol || 'NIFTY 50';
                if (sym.includes('BANK')) { step = 100; optPrefix = 'BANKNIFTY'; }
                else if (sym.includes('SENSEX')) { step = 100; optPrefix = 'SENSEX'; }
                else if (sym.includes('FIN')) { step = 50; optPrefix = 'FINNIFTY'; }
                const strike = Math.round(currentLiveQuote / step)  * step;
                const optionSymbol = \`\${optPrefix} \${strike} \${isBullish ? 'CE': 'PE'}\`;
                
                botLogs.unshift({ id: Date.now() .toString(), time: new Date() .toLocaleTimeString(), message: \`Signal Detected: \${isBullish ? 'BULLISH': 'BEARISH'}. Buying \${optionSymbol} at market.\`, type: 'TRADE' });
                
                if (botConfig.mode === 'PAPER_TRADING')  {
                   // Fetch real option price
                   let optionPrice = signal.price;
                   
                   const botQty = await getDynamicLotSize(optionSymbol, token);`;

const replaceStr = `             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL') && signal.confidenceScore >= botConfig.minConfidence) {
                // Execute Trade on Option!
                const isBullish = signal.signalType === 'BUY';
                const optionSymbol = signal.symbol;
                
                botLogs.unshift({ id: Date.now() .toString(), time: new Date() .toLocaleTimeString(), message: \`Signal Detected: \${isBullish ? 'BULLISH': 'BEARISH'}. Buying \${optionSymbol} at market.\`, type: 'TRADE' });
                
                if (botConfig.mode === 'PAPER_TRADING')  {
                   // Fetch real option price
                   let optionPrice = signal.price;
                   
                   const botQty = await getDynamicLotSize(optionSymbol, token);`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log("Patched server execute block");
