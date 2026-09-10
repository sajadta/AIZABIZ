const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('process.env.NODE_ENV = process.env.NODE_ENV')) {
  code = 'process.env.NODE_ENV = process.env.NODE_ENV || (process.env.K_SERVICE ? "production" : "development");\n' + code;
  fs.writeFileSync('server.ts', code);
}
