const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
    "console.log('WS MSG RAW:', data.toString().substring(0, 100));",
    "botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: 'WS MSG RAW: ' + data.toString().substring(0, 100), type: 'INFO' });"
);
fs.writeFileSync('server.ts', content);
console.log("Patched WS logging to botLogs.");
