const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldPromptBlock = `    const quote = { ltp: ltp || 24350, changePercent: changePercent || 0.4 };

    const prompt = \`You are a world-class Quantitative Financial Analyst and Algorithmic Trading Architect for Indian Equities (NSE/BSE) on the Upstox Live Platform.
Analyze the following LIVE MARKET DATA for \${symbol}:
- Current LTP: ₹\${quote.ltp}
- Day Change: \${quote.changePercent}%
- Timeframe: \${interval || '5m'}
- Technical Indicator States:
  * Supertrend: \${indicators?.supertrend?.signal || 'BUY'} at ₹\${indicators?.supertrend?.value || (quote.ltp * 0.985).toFixed(2)}
  * RSI (14): \${indicators?.rsi || 58.5}
  * MACD: \${indicators?.macd?.signal || 'Bullish Crossover'}
  * Moving Averages (20, 50, 200 EMA): \${indicators?.ema?.bias || 'Price trading above 20 EMA & 50 EMA'}
  * Options Open Interest (OI) Bias: \${indicators?.oi?.bias || 'Heavy Put Writing detected at ATM strikes (Support building)'}
  * Order Book / Volume: \${indicators?.volume?.bias || 'Institutional accumulation visible in last 3 candles'}

Provide a highly professional, brutally objective, and algorithmic evaluation of this setup. \`;`;

const newPromptBlock = `    const quote = { ltp: ltp || 0, changePercent: changePercent || 0 };

    const prompt = \`You are a world-class Quantitative Financial Analyst and Algorithmic Trading Architect for Indian Equities (NSE/BSE) on the Upstox Live Platform.
Analyze the following LIVE MARKET DATA for \${symbol}:
- Current LTP: ₹\${quote.ltp}
- Day Change: \${quote.changePercent}%
- Timeframe: \${interval || '5m'}
- Technical Indicator States:
  * Supertrend: \${indicators?.supertrend?.signal || 'N/A'} at ₹\${indicators?.supertrend?.value || 'N/A'}
  * RSI (14): \${indicators?.rsi || 'N/A'}
  * MACD: \${indicators?.macd?.signal || 'N/A'}
  * Moving Averages Bias: \${indicators?.ema?.bias || 'N/A'}
  * Volume Bias: \${indicators?.volume?.bias || 'N/A'}

Provide a highly professional, brutally objective, and algorithmic evaluation of this setup. \`;`;

code = code.replace(oldPromptBlock, newPromptBlock);
fs.writeFileSync('server.ts', code);
