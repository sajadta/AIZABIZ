const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const mockCandlesCode = `
  if (!token || !symbol) {
    // Return mock candles so the chart has data in demo mode
    const mockCandles = [];
    let lastClose = 24500;
    let lastTime = new Date().getTime() - 50 * 5 * 60 * 1000;
    for (let i = 0; i < 50; i++) {
      const o = lastClose;
      const c = o + (Math.random() - 0.45) * 20;
      const h = Math.max(o, c) + Math.random() * 10;
      const l = Math.min(o, c) - Math.random() * 10;
      mockCandles.push({
         timestamp: lastTime,
         timeStr: new Date(lastTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
         open: o, high: h, low: l, close: c, volume: Math.floor(Math.random() * 10000)
      });
      lastClose = c;
      lastTime += 5 * 60 * 1000;
    }
    return res.json({ success: true, symbol, interval, candles: mockCandles });
  }
`;

code = code.replace(
  `  if (!token || !symbol) {
    return res.status(400).json({ success: false, error: 'Token and symbol are required.' });
  }`,
  mockCandlesCode
);

fs.writeFileSync('server.ts', code);
