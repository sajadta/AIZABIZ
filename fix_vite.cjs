const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  'if (process.env.NODE_ENV !== "production" && !process.env.K_SERVICE) {',
  'if (process.env.NODE_ENV !== "production") {'
);
fs.writeFileSync('server.ts', code);
