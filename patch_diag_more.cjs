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
        lastQuoteTime: typeof globalLiveQuotes !== 'undefined' && globalLiveQuotes['last_update'] ? globalLiveQuotes['last_update'] : null,
        tokenPrefix: upstoxConfig.accessToken ? upstoxConfig.accessToken.substring(0, 10) : 'none',
        lastWsError: typeof globalLastWsError !== 'undefined' ? globalLastWsError : null
    });
});
`;

content = content.replace(/app\.get\('\/api\/bot\/diagnostics',[\s\S]*?\}\);/, diagCode);

if (!content.includes('globalLastWsError')) {
    content = content.replace('let upstoxWsConnected = false;', 'let upstoxWsConnected = false;\nlet globalLastWsError = null;');
    content = content.replace('upstoxStreamer.on(\'error\', (err) => {', 'upstoxStreamer.on(\'error\', (err) => {\n           globalLastWsError = err ? err.toString() : "Unknown Error";');
    content = content.replace('upstoxStreamer.on(\'close\', () => {', 'upstoxStreamer.on(\'close\', () => {\n           globalLastWsError = "WS Closed";');
    fs.writeFileSync('server.ts', content);
}

