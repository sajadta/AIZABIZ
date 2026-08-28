const fs = require('fs');
let code = fs.readFileSync('src/components/OrderBookPositions.tsx', 'utf8');

code = code.replace(
    /encodeURIComponent\(pos\.symbol\)/g,
    "encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))"
);

fs.writeFileSync('src/components/OrderBookPositions.tsx', code);
console.log("Patched OrderBookPositions brokerage symbols");
