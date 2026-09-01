const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

if (!content.includes('WS MSG RAW:')) {
    content = content.replace(
        "try {\n               const parsed = typeof data",
        "try {\n               console.log('WS MSG RAW:', data.toString().substring(0, 100));\n               const parsed = typeof data"
    );
    fs.writeFileSync('server.ts', content);
    console.log("Patched WS logging.");
}
