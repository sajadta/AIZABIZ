const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\}\);\s*\}\s*try\s*\{\s*\/\/ Validate with real Upstox API v2[\s\S]*?\}\);\s*\}\s*\/\/ Clear token endpoint/m;
const replacement = `});

// Clear token endpoint`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code);
  console.log('Fixed syntax error');
} else {
  console.log('Could not find duplicate block');
}
