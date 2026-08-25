const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace gemini-pro with gemini-2.5-flash
code = code.replace(/model:\s*'gemini-pro'/g, "model: 'gemini-1.5-flash'");

fs.writeFileSync('server.ts', code);
console.log('Patched Gemini Model');
