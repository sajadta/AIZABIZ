const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes("'Api-Version': '2.0'")) {
        // If it's a one-liner (contains 'headers: {') and doesn't end with '}'
        if (line.includes('headers:') && !line.trim().endsWith('}') && !line.trim().endsWith('},')) {
            // Remove trailing comma if present
            line = line.replace(/,\s*$/, '');
            line = line + ' },';
            lines[i] = line;
        }
    }
}
fs.writeFileSync('server.ts', lines.join('\n'));
console.log('Fixed explicitly');
