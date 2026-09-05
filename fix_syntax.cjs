const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/\}\)\)\) \.filter/g, '})) .filter');
fs.writeFileSync('server.ts', code);
console.log("Fixed syntax in server.ts");
