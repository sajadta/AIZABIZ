const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /const DB_FILE = path\.join\(process\.cwd\(\), "local_db\.json"\);/,
  'const DB_FILE = process.env.NODE_ENV === "production" ? "/tmp/local_db.json" : path.join(process.cwd(), "local_db.json");'
);
fs.writeFileSync('server.ts', code);
