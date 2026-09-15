const fs = require('fs');
let code = fs.readFileSync('src/components/CumulativePnLChart.tsx', 'utf-8');

code = code.replace(/if \(!tradeHistory || tradeHistory\.length === 0\) return \[\];/, '');
code = code.replace(/if \(chartData\.length === 0\) \{\n\s*return null;\n\s*\}/, '');

fs.writeFileSync('src/components/CumulativePnLChart.tsx', code);
