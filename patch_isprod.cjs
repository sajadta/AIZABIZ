const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'if (process.env.NODE_ENV !== "production") {',
  'const isProd = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;\n  if (!isProd) {'
);

fs.writeFileSync('server.ts', code);
