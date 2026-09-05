const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Patch App.tsx error logs
code = code.replace(/console\.error\("Upstox Candles API Error:", data\.error, data\.raw\);/g, 'console.warn("Upstox Candles API Error:", data.error);');
code = code.replace(/console\.error\("Upstox Candles HTTP Error:", errText\);/g, 'console.warn("Upstox Candles HTTP Error:", errText);');
code = code.replace(/console\.error\("Upstox Candles Fetch Error:", err\);/g, 'console.warn("Upstox Candles Fetch Error:", err.message);');

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx error logs");
