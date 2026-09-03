const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Insert circuit breaker check
if (!code.includes('Check Circuit Breaker')) {
    code = code.replace(
        "if (activePositions.length === 0 && token)",
        "// Check Circuit Breaker\n    let todayRealizedPnL = paperTradeHistory.reduce((acc, trade) => acc + (trade.realizedPnL || 0), 0);\n    if (todayRealizedPnL <= -botConfig.dailyMaxLossLimit) {\n        if (!botConfig.dailyLossLocked) {\n            botConfig.dailyLossLocked = true;\n            botConfig.enabled = false;\n            botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: `Circuit Breaker: Daily max loss limit (₹${botConfig.dailyMaxLossLimit}) reached. Bot disabled for the day.`, type: 'ERROR' });\n        }\n    }\n    \n    // 2. If no positions, look for entry\n    if (activePositions.length === 0 && token && !botConfig.dailyLossLocked)"
    );
    fs.writeFileSync('server.ts', code);
    console.log("Patched circuit breaker.");
}
