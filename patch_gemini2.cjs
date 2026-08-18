const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const prompt = \`You are a world-class Quantitative Financial Analyst[\s\S]*?Provide both English and Malayalam \(മലയാളം\) explanations for the user\.\`;/g;

const newPrompt = `const quote = { ltp: ltp || 0, changePercent: changePercent || 0 };
    const prompt = \`You are a world-class Quantitative Financial Analyst and Algorithmic Trading Architect for Indian Equities (NSE/BSE) on the Upstox Live Platform.
Analyze the following LIVE MARKET DATA for \${symbol}:
- Current LTP: ₹\${quote.ltp}
- Day Change: \${quote.changePercent}%
- Timeframe: \${interval || '5m'}
- Technical Indicator States:
  * Supertrend: \${indicators?.supertrend?.signal || 'N/A'} at ₹\${indicators?.supertrend?.value || 'N/A'}
  * EMA Cross (9/21/50): \${indicators?.emaCross?.signal || 'N/A'}
  * RSI (14): \${indicators?.rsi?.value || 'N/A'}
  * MACD: \${indicators?.macd?.cross || 'N/A'}
  * VWAP: ₹\${indicators?.vwap?.value || 'N/A'}

Provide a structured, institutional algorithmic evaluation.
Return your response STRICTLY as a JSON object adhering to the schema.
Provide both English and Malayalam (മലയാളം) explanations for the user.\`;`;

code = code.replace(/const quote = \{ ltp: ltp \|\| 24350, changePercent: changePercent \|\| 0\.4 \};/, '');
code = code.replace(regex, newPrompt);

fs.writeFileSync('server.ts', code);
