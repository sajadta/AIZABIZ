const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'setupVite();',
  'setupVite().catch(err => { console.error("Fatal error during startup:", err); process.exit(1); });'
);

fs.writeFileSync('server.ts', code);
