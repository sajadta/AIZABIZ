const fs = require('fs');

// server.ts
let serverCode = fs.readFileSync('server.ts', 'utf-8');
serverCode = serverCode.replace(/\/api\/upstox\//g, '/api/market/');
fs.writeFileSync('server.ts', serverCode);

// App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');
appCode = appCode.replace(/\/api\/upstox\//g, '/api/market/');
fs.writeFileSync('src/App.tsx', appCode);

console.log("Renamed API endpoints to /api/market/");
