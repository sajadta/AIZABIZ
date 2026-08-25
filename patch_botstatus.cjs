const fs = require('fs');
let code = fs.readFileSync('src/components/AlgoBotPanel.tsx', 'utf8');

code = code.replace(/botStatus\.isActive/g, 'botConfig.enabled');

fs.writeFileSync('src/components/AlgoBotPanel.tsx', code);
console.log('Patched botStatus to botConfig.enabled');
