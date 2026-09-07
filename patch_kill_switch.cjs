const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const botLoopStart = `
setInterval(async ()  => {
  if (!botConfig.enabled)  return;
  try {
    // === AUTO KILL SWITCH CHECK ===
    if (botConfig.autoKillSwitch) {
        let dailyRealizedPnL = 0;
        const nowIstStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
        const todayDate = new Date(nowIstStr).toDateString();
        
        let tradeList = botConfig.mode === 'PAPER_TRADING' ? paperTradeHistory : []; // Would need live history if UPSTOX_LIVE
        
        tradeList.forEach((t) => {
            if (t.closeTime) {
                const closeDate = new Date(t.closeTime).toDateString();
                if (closeDate === todayDate) {
                    dailyRealizedPnL += (t.realizedPnL || 0);
                }
            }
        });
        
        if (dailyRealizedPnL < -botConfig.dailyMaxLossLimit) {
            botConfig.enabled = false;
            botLogs.unshift({ 
                id: Date.now().toString(), 
                time: new Date().toLocaleTimeString(), 
                message: \`[KILL SWITCH] Max Daily Loss Limit (-\u20B9\${botConfig.dailyMaxLossLimit}) reached. Bot shutting down to protect capital.\`, 
                type: 'ERROR' 
            });
            console.warn("Bot Kill Switch Activated. Shutting down.");
            return; // Stop execution
        }
    }
`;

code = code.replace(
  /setInterval\(async \(\)  => \{\n  if \(\!botConfig\.enabled\)  return;\n  try \{/,
  botLoopStart
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts Kill Switch");
