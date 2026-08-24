const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
    "console.error('SSE Error:', err);",
    "console.log('SSE connection interrupted, attempting to reconnect...');"
);

fs.writeFileSync('src/App.tsx', code);
console.log('Suppressed SSE console.error');
