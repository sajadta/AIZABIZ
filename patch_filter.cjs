const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/\}\)\) \.reverse\(\);/g, '}))) .filter(c => !isNaN(c.timestamp)) .reverse();');
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts timestamp filter");
