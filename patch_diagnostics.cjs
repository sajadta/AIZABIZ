const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const diagCode = `
app.get('/api/bot/diagnostics', (req, res) => {
    res.json({
        systemTime: new Date().toISOString(),
        botEnabled: botConfig.enabled,
        tradingMode: botConfig.mode,
        hasUpstoxToken: !!upstoxConfig.accessToken,
        upstoxWsConnected: typeof upstoxWsConnected !== 'undefined' ? upstoxWsConnected : false,
        subscribedKeysCount: typeof subscribedKeys !== 'undefined' ? subscribedKeys.size : 0,
        activePaperPositions: typeof paperPositions !== 'undefined' ? paperPositions.length : 0,
        liveQuotesTracked: typeof globalLiveQuotes !== 'undefined' ? Object.keys(globalLiveQuotes).length : 0,
        lastQuoteTime: typeof globalLiveQuotes !== 'undefined' && globalLiveQuotes['last_update'] ? globalLiveQuotes['last_update'] : null
    });
});
`;

if (!content.includes('/api/bot/diagnostics')) {
    content = content.replace("app.get('/api/bot/logs',", diagCode + "\napp.get('/api/bot/logs',");
    
    // Also track last quote time
    content = content.replace("globalLiveQuotes[key] = { last_price: ltp };", "globalLiveQuotes[key] = { last_price: ltp };\n                           globalLiveQuotes['last_update'] = new Date().toISOString();");

    fs.writeFileSync('server.ts', content);
}
