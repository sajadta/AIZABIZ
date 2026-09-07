const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  /app\.post\("\/api\/gemini\/chat", async \(req: Request, res: Response\) => \{\n  if \(\!process\.env\.GEMINI_API_KEY\)\n    return res\n      \.status\(500\)\n      \.json\(\{\n        success: false,\n        error: "GenAI client not initialized \(Missing API Key\) \.",\n      \}\);\n  const \{ message, systemStatus \} = req\.body;/g,
  `app.post("/api/gemini/chat", async (req: Request, res: Response) => {
  const { message, systemStatus, geminiApiKey } = req.body;
  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({
        success: false,
        error: "GenAI client not initialized (Missing API Key) .",
      });`
);
code = code.replace(
  /const dynamicAi = new GoogleGenAI\(\{\n      apiKey: process\.env\.GEMINI_API_KEY \|\| "",\n    \}\);/g,
  `const dynamicAi = new GoogleGenAI({
      apiKey: apiKey || "",
    });`
);
fs.writeFileSync('server.ts', code);
