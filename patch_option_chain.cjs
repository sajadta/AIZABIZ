const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const buggyCode = `const call = item.call_options || {};
             if (strikes.length === 0) { console.log("OPTION CHAIN ITEM: ", JSON.stringify(item)); }`;
const fixedCode = `const call = item.call_options || {};`;

code = code.replace(buggyCode, fixedCode);
fs.writeFileSync('server.ts', code);
console.log('Fixed strikes initialization error');
