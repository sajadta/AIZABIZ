const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// A safer way is to create an authenticated fetch function inside App.tsx
// But App.tsx already has apiConfig.accessToken in state.

code = code.replace(
  /const res = await fetch\(\`\/api\/market\/candles\?symbol=\$\{encodeURIComponent\(symbol\)\}&instrumentKey=\$\{encodeURIComponent\(instKey\)\}&interval=\$\{tf\}\`\);/,
  "const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&instrumentKey=${encodeURIComponent(instKey)}&interval=${tf}`, { headers: { 'Authorization': `Bearer ${apiConfig.accessToken}` } });"
);

code = code.replace(
  /const res = await fetch\(\`\/api\/market\/quotes\`\);/,
  "const res = await fetch(`/api/market/quotes`, { headers: { 'Authorization': `Bearer ${apiConfig.accessToken}` } });"
);

code = code.replace(
  /const res = await fetch\(\`\/api\/market\/optionchain\?symbol=\$\{encodeURIComponent\(symbol\)\}\`\);/,
  "const res = await fetch(`/api/market/optionchain?symbol=${encodeURIComponent(symbol)}`, { headers: { 'Authorization': `Bearer ${apiConfig.accessToken}` } });"
);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx fetches");
