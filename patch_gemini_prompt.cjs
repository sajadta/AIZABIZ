const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldPromptPart = `
- Technical Indicator States:
  * Supertrend: \${indicators?.supertrend?.signal || 'N/A'} at \u20B9\${indicators?.supertrend?.value || 'N/A'}
  * EMA Cross (9/21/50): \${indicators?.emaCross?.signal || 'N/A'}
  * RSI (14): \${indicators?.rsi?.value || 'N/A'}
  * MACD: \${indicators?.macd?.cross || 'N/A'}
  * VWAP: \u20B9\${indicators?.vwap?.value || 'N/A'}
`;

const newPromptPart = `
- Technical Indicator States:
  * Supertrend: \${indicators?.supertrend?.signal || 'N/A'} at \u20B9\${indicators?.supertrend?.value || 'N/A'}
  * EMA Cross (9/21/50): \${indicators?.emaCross?.signal || 'N/A'}
  * RSI (14): \${indicators?.rsi?.value || 'N/A'}
  * MACD: \${indicators?.macd?.cross || 'N/A'}
  * VWAP: \u20B9\${indicators?.vwap?.value || 'N/A'}

- Advanced Options & Market Depth Parameters (Estimated based on current volatility):
  * Candlestick Patterns: Check for Doji, Engulfing, Hammer, Shooting Star
  * Option Greeks: Consider Theta (Time Decay), Gamma (Acceleration), Delta, and IV (Implied Volatility)
  * OI (Open Interest): Consider support/resistance based on PCR and Option Chain data
  * Chart History: Evaluate support/resistance lines, trendlines, and previous day highs/lows.
`;

code = code.replace(
  /\- Technical Indicator States:[\s\S]*\* VWAP: \u20B9\$\{indicators\?\.vwap\?\.value \|\| 'N\/A'\}/,
  newPromptPart.trim()
);

fs.writeFileSync('server.ts', code);
console.log("Patched Gemini Prompt");
