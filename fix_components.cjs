const fs = require('fs');

const files = [
  'src/components/OrderBookPositions.tsx',
  'src/components/UpstoxApiModal.tsx',
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf-8');
  code = code.replace(/\/api\/upstox\//g, '/api/market/');
  fs.writeFileSync(file, code);
  console.log("Patched " + file);
}
