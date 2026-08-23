const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Remove hardcoded UPSTOX_ACCESS_TOKEN
code = code.replace("accessToken: process.env.UPSTOX_ACCESS_TOKEN || '',", "accessToken: '', // Removed hardcoded to avoid confusion");

// Enhance bot mode display
const targetMode = `  res.json({ success: false, error: 'Invalid mode' });`;
// I don't need to patch that.

fs.writeFileSync('server.ts', code);
console.log('Removed hardcoded token');
