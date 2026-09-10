const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the timezone issue by using local date string for 'todayStr'
code = code.replace(
  "const todayStr = new Date().toISOString().split('T')[0];",
  "const todayStr = new Date().toLocaleDateString('en-IN');"
);

fs.writeFileSync('src/App.tsx', code);
