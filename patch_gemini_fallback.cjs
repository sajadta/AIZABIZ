const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ If Gemini fails or key isn't provided, return dynamic algorithmic calculation fallback[\s\S]*? \}\);\n  \}/g;

const replacement = `// If Gemini fails or key isn't provided, return error instead of fake dummy data
    return res.status(500).json({
      success: false,
      error: 'AI Analysis failed: ' + error.message,
    });
  }`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
