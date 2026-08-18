const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regexOptions = /\/\/ Fallback dynamic generation if Upstox option chain fails[\s\S]*?return res\.json\(defaultEmptyResponse\);/g;

const emptyOptionResp = `// Fallback dynamic generation if Upstox option chain fails (due to wrong expiry etc)
    // We strictly DO NOT return fake option data anymore. Return empty instead.
    return res.json(defaultEmptyResponse);`;

code = code.replace(regexOptions, emptyOptionResp);
fs.writeFileSync('server.ts', code);
