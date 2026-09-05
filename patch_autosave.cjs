const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Instead of manually hooking every change, just auto-save every 5 seconds.
code = code.replace(
  /\/\/ Load it initially\nloadLocalDb\(\);\n/,
  "// Load it initially\nloadLocalDb();\nsetInterval(saveLocalDb, 5000);\n"
);

fs.writeFileSync('server.ts', code);
console.log("Added 5-second autosave to server.ts");
