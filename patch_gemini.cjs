const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace the check
code = code.replace(
  "if (!globalGeminiKey || globalGeminiKey === '')  return res.status(500) .json({ success: false, error: 'GenAI client not initialized (Missing API Key) .' });",
  "if (!process.env.GEMINI_API_KEY) return res.status(500).json({ success: false, error: 'GenAI client not initialized (Missing API Key).' });"
);

// Replace the other check
code = code.replace(
  "if (!globalGeminiKey || globalGeminiKey === '')",
  "if (!process.env.GEMINI_API_KEY)"
);


// Replace global ai usage in /api/gemini/chat
code = code.replace(
  /const response = await ai\.models\.generateContent/g,
  `const dynamicAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });\n    const response = await dynamicAi.models.generateContent`
);

fs.writeFileSync('server.ts', code);
