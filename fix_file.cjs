const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancedAnalytics.tsx', 'utf-8');
code = code.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('src/components/AdvancedAnalytics.tsx', code);
