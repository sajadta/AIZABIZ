const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(/catch \(err\) \{\n\s*console\.error\("Token validation error:", data\.errors\);/g, 'catch (err) {\n        console.error("Token validation error:", err);');
fs.writeFileSync('server.ts', code);
