const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace global ai usage in /api/gemini/chat
code = code.replace(
  /const response = await ai\.models\.generateContent/g,
  `const dynamicAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });\n    const response = await dynamicAi.models.generateContent`
);

// Replace global ai usage in handleGeminiAnalysis
code = code.replace(
  /const response = await ai\.models\.generateContent/g,
  `const dynamicAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });\n    const response = await dynamicAi.models.generateContent`
);

fs.writeFileSync('server.ts', code);
