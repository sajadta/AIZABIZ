const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `             const signal = analyzeTradingSignals('NIFTY 50', 'NIFTY 50', 'NSE_INDEX|Nifty 50', enriched, currentLiveQuote, botConfig.selectedStrategy as any);
             
             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL') && signal.confidenceScore >= botConfig.minConfidence) {`;

const replace = `             const signal = analyzeTradingSignals('NIFTY 50', 'NIFTY 50', 'NSE_INDEX|Nifty 50', enriched, currentLiveQuote, botConfig.selectedStrategy as any);
             
             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL')) {
                 botSignals.unshift(signal);
                 if (botSignals.length > 50) botSignals.pop();
             }

             if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL') && signal.confidenceScore >= botConfig.minConfidence) {`;

code = code.replace(target, replace);
fs.writeFileSync('server.ts', code);
console.log('Patched signals generation');
