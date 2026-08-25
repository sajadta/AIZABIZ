const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix 1: short-ter -positions -> short-term-positions
code = code.replace(/short-ter -positions/g, 'short-term-positions');

// Fix 2: long-ter -holdings -> long-term-holdings
code = code.replace(/long-ter -holdings/g, 'long-term-holdings');

fs.writeFileSync('server.ts', code);
console.log('Fixed upstox endpoint typos in server.ts');
