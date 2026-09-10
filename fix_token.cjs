const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// replace how token is cleaned in daily-token
code = code.replace(
  'const token = (accessToken || "").trim();',
  'let token = (accessToken || "").trim();\n  if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();'
);

// replace in config POST
code = code.replace(
  'const token = accessToken.trim();',
  'let token = accessToken.trim();\n    if (token.startsWith("Bearer ")) token = token.replace("Bearer ", "").trim();'
);

fs.writeFileSync('server.ts', code);
