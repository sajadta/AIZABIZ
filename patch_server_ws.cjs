const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// 1. Add a global map for live quotes
if (!content.includes('const globalLiveQuotes')) {
    content = content.replace('let paperTradeHistory: any[] = [];', 'let paperTradeHistory: any[] = [];\nconst globalLiveQuotes: Record<string, any> = {};');
}

// 2. Update globalLiveQuotes in WS message handler
const wsHandlerUpdate = `
                       if (ltp > 0) {
                           globalLiveQuotes[key] = { last_price: ltp };
                           quotesList.push({
`;
content = content.replace(/if \(ltp > 0\) \{\s*quotesList\.push\(\{/g, wsHandlerUpdate);

// 3. Fallback to globalLiveQuotes in bot loop if REST fetch fails
const botLoopUpdate = `
            if (qData?.data)  {
               liveQuotesMap = qData.data;
               const mainKey = (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50';
               if (liveQuotesMap[mainKey]?.last_price) {
                   currentLiveQuote = liveQuotesMap[mainKey].last_price;
               }
            }
        } catch(e) {}
    }
    
    // Merge with global WS quotes
    for (const k in globalLiveQuotes) {
        if (!liveQuotesMap[k]) liveQuotesMap[k] = globalLiveQuotes[k];
    }
`;
content = content.replace(/if \(qData\?\.data\)  \{\s*liveQuotesMap = qData\.data;\s*const mainKey = \(botConfig as any\)\.selectedInstrumentKey \|\| 'NSE_INDEX\|Nifty 50';\s*if \(liveQuotesMap\[mainKey\]\?\.last_price\) \{\s*currentLiveQuote = liveQuotesMap\[mainKey\]\.last_price;\s*\}\s*\}\s*\} catch\(e\) \{\}\s*\}/, botLoopUpdate);

// 4. Update the bot's Signal Deduplication to update price
const signalDedupe = `
                 // Prevent spamming the same signal
                 const lastSignal = botSignals[0];
                 if (!lastSignal || lastSignal.symbol !== signal.symbol || lastSignal.signalType !== signal.signalType) {
                     botSignals.unshift(signal);
                     if (botSignals.length > 50) botSignals.length = 50;
                 } else {
                     lastSignal.price = signal.price;
                     lastSignal.timestamp = signal.timestamp;
                 }
`;
content = content.replace(/\/\/ Prevent spamming the same signal[\s\S]*?if \(botSignals\.length > 50\) botSignals\.length = 50;\s*\}/, signalDedupe);

fs.writeFileSync('server.ts', content);
