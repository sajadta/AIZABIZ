const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Remove lastKnownOptionChain
code = code.replace('let lastKnownOptionChain: any = {};', '');
code = code.replace(`     if (lastKnownOptionChain[symbol]) {
        return res.json(lastKnownOptionChain[symbol]);
     }`, `     // No fallback. Return error if disconnected.
     return res.status(401).json({ error: 'Upstox Token Missing', strikes: [] });`);

code = code.replace(`     if (lastKnownOptionChain[symbol]) {
         return res.json(lastKnownOptionChain[symbol]);
     }`, `     return res.status(500).json({ error: 'Failed to fetch option chain', strikes: [] });`);

code = code.replace(`         lastKnownOptionChain[symbol] = result;`, ``);


// 2. Fix Candles endpoint Auth Header
const candlesTarget = `    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'Api-Version': '2.0' }
    });`;
const candlesReplace = `    const response = await fetch(url, {
      headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
    });`;
code = code.replace(candlesTarget, candlesReplace);

fs.writeFileSync('server.ts', code);
console.log('Patches 1 and 2 applied');
