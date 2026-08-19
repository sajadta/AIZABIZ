const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `
// 10. AI Diagnostics & Support Chat
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  if (!genAI) return res.status(500).json({ success: false, error: 'GenAI client not initialized (Missing API Key).' });
  const { message, systemStatus } = req.body;
  try {
    const prompt = \`You are an AI assistant for a Trading application built with Upstox API.
    
    User Message: "\${message}"
    
    System Status: \${JSON.stringify(systemStatus)}
    
    Help the user troubleshoot or provide guidance on using the app. Reply in the same language they used (Malayalam or English). Keep it concise.\`;

    const response = await genAI.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });
    
    return res.json({ text: response.text });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Global Error Handler for API routes
`;

code = code.replace(
  /\/\/ Global Error Handler for API routes/,
  replacement.trim()
);

fs.writeFileSync('server.ts', code);
