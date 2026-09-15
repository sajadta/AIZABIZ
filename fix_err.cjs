const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(/console\.error\("Token validation error:", err\);/g, 'console.error("Token validation error:", data.errors);');
fs.writeFileSync('server.ts', code);
