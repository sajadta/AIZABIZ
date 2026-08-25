const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `const call = item.call_options || {};`;
const replacement = `const call = item.call_options || {};
             if (strikes.length === 0) { console.log("OPTION CHAIN ITEM: ", JSON.stringify(item)); }`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('Patched Option Chain Log');
