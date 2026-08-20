const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The issue is some lines end with 'Api-Version': '2.0' } followed by },
code = code.replace(/'Api-Version': '2\.0' \}/g, "'Api-Version': '2.0'");
code = code.replace(/'Api-Version': '2\.0'\}/g, "'Api-Version': '2.0'");

// Then for single-line headers like:
// headers: { 'Authorization': ..., 'Accept': 'application/json', 'Api-Version': '2.0' 
// We need to make sure they close with }
const regex2 = /headers:\s*\{[^}]*'Api-Version': '2\.0'\s*,?\s*(\n|")/g;

fs.writeFileSync('server.ts', code);
console.log('Fixed extra braces');
