const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Patch Option Chain error
code = code.replace(/console\.error\('Error fetching Option Chain:', error\);/g, 'console.warn("Option Chain unavailable (likely missing/invalid token).");');
code = code.replace(/throw new Error\('Failed to fetch contracts'\);/g, 'return res.status(401).json({ error: "Unauthorized. Check API Token.", strikes: [] });');

// Patch WS Error
code = code.replace(/console\.error\("Upstox WS Error:", err\);/g, 'console.warn("Upstox WS disconnected or 401. Check token.");');
code = code.replace(/console\.error\("Upstox WS Connect error", e\)/g, 'console.warn("Upstox WS Connect error (check token).")');
code = code.replace(/console\.error\('WS MSG ERROR:', e\);/g, 'console.warn("WS MSG Warning.");');
code = code.replace(/console\.error\("Failed to init Upstox streamer", err\);/g, 'console.warn("Failed to init Upstox streamer (check token).");');

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts to use console.warn for Upstox 401s");
