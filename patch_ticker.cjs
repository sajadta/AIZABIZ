const fs = require('fs');
let code = fs.readFileSync('src/components/TickerBar.tsx', 'utf8');

code = code.replace(
  "onSelectSymbol: (symbol: string) => void;",
  "onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;"
);

code = code.replace(
  "onClick={() => onSelectSymbol(q.symbol)}",
  "onClick={() => onSelectSymbol && onSelectSymbol(q.symbol, q.instrumentKey)}"
);

fs.writeFileSync('src/components/TickerBar.tsx', code);
console.log('Patched TickerBar.tsx');
