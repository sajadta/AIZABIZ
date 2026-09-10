const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/Pleasementer/g, 'Please enter');
code = code.replace(/modemenabled/g, 'mode enabled');
code = code.replace(/03:30mAM/g, '03:30 AM');
fs.writeFileSync('server.ts', code);
