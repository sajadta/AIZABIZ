const fs = require('fs');
let code = fs.readFileSync('src/components/Watchlist.tsx', 'utf8');

code = code.replace(
  "onSelectSymbol: (symbol: string) => void;",
  "onSelectSymbol: (symbol: string, instrumentKey?: string) => void;"
);

code = code.replace(
  "onClick={() => onSelectSymbol(q.symbol)}",
  "onClick={() => onSelectSymbol(q.symbol, q.instrumentKey)}"
);

fs.writeFileSync('src/components/Watchlist.tsx', code);
console.log('Patched Watchlist.tsx');
