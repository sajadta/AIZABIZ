const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `                 botSignals.unshift(signal);
                 botSignals.unshift(signal);
                 if (botSignals.length > 50) botSignals.pop();`;

const replaceStr = `                 // Prevent spamming the same signal
                 const lastSignal = botSignals[0];
                 if (!lastSignal || lastSignal.symbol !== signal.symbol || lastSignal.signalType !== signal.signalType) {
                     botSignals.unshift(signal);
                     if (botSignals.length > 50) botSignals.length = 50;
                 }`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts 2");
