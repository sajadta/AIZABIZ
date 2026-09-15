const fs = require('fs');
let code = fs.readFileSync('src/components/CumulativePnLChart.tsx', 'utf-8');
code = code.replace(/tradeHistory\.forEach/g, '(tradeHistory || []).forEach');
fs.writeFileSync('src/components/CumulativePnLChart.tsx', code);
