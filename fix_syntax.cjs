const fs = require('fs');
let code = fs.readFileSync('src/components/LiveAiSupport.tsx', 'utf8');

code = code.replace(
  "diagMsg += '❌ Upstox API Disconnected! Go to Settings (Key icon) and enter today\\\\'s Access Token.\\n';",
  "diagMsg += \"❌ Upstox API Disconnected! Go to Settings (Key icon) and enter today's Access Token.\\n\";"
);

fs.writeFileSync('src/components/LiveAiSupport.tsx', code);
