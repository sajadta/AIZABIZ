const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "const symbolsQuery = (req.query.symbols as string) || 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,NSE_INDEX|Nifty Fin Service,NSE_EQ|INE002A01018,NSE_EQ|INE040A01034';",
  "const symbolsQuery = (req.query.symbols as string) || 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX,BSE_INDEX|BANKEX,NSE_INDEX|Nifty Fin Service';"
);

fs.writeFileSync('server.ts', code);
console.log('Fixed quotes symbols');
