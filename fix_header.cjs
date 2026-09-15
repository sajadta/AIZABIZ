const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf-8');

// Destructure onOpenAlerts
code = code.replace(/  dailyProfit,\n  isWsConnected,\n  \}\) => \{/, '  dailyProfit,\n  isWsConnected,\n  onOpenAlerts,\n  }) => {');

// Import BellRing
code = code.replace(/import \{ \n/g, 'import {\n  BellRing,\n');

fs.writeFileSync('src/components/Header.tsx', code);
