const fs = require('fs');
let code = fs.readFileSync('src/components/UpstoxApiModal.tsx', 'utf8');

code = code.replace(
  "const todayStr = new Date().toISOString().split('T')[0];",
  "const todayStr = new Date().toLocaleDateString('en-IN');"
);

fs.writeFileSync('src/components/UpstoxApiModal.tsx', code);
