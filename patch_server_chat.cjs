const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Add Support Chat Endpoint
const supportChatEndpoint = `
// 11. Live Support AI Chat Endpoint
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { message, systemStatus } = req.body;
    
    const prompt = \`You are the built-in Technical Support & Trading Assistant for the Upstox Algo Pro app.
The user is asking for help or reporting an issue.
    
Current App Status Data:
\${JSON.stringify(systemStatus, null, 2)}

User Message: "\${message}"

Instructions:
1. If the user reports a bug, check the "System Status" above to see if it's a known issue (e.g. disconnected token, network offline).
2. Give a direct, helpful solution. If the token is missing, tell them to generate a new one from the Upstox developer console and paste it in the settings.
3. If they ask about trading, give them safe, general guidance.
4. Reply in Malayalam if they ask in Malayalam, otherwise reply in English. Keep it concise.
\`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful assistant integrated directly into the Upstox Auto Trading Application. You help users fix errors, configure the app, and understand their trades."
      }
    });

    return res.json({ success: true, text: response.text });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
`;

if (!code.includes('/api/gemini/chat')) {
  // Insert before the last app.listen
  code = code.replace(
    'if (process.env.NODE_ENV !== "production")',
    supportChatEndpoint + '\n  if (process.env.NODE_ENV !== "production")'
  );
  fs.writeFileSync('server.ts', code);
}
