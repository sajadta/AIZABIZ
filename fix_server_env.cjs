const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = `process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || "") + " --dns-result-order=ipv4first";\n` + code;
fs.writeFileSync('server.ts', code);
