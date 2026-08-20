const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const endpoints = `
// 6. Option Chain Data (Mock/Fallback for missing API)
app.get('/api/upstox/optionchain', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || 'NIFTY 50';
  const ltp = symbol.includes('BANK') ? 57500 : (symbol.includes('NIFTY') ? 24200 : 700);
  
  const strikes = [];
  const baseStrike = Math.round(ltp / 50) * 50;
  
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (let i = -10; i <= 10; i++) {
    const strikePrice = baseStrike + (i * 50);
    const callPrice = i < 0 ? (Math.abs(i) * 50) + Math.random() * 20 : (Math.max(1, 20 - i*2) + Math.random() * 5);
    const putPrice = i > 0 ? (Math.abs(i) * 50) + Math.random() * 20 : (Math.max(1, 20 + i*2) + Math.random() * 5);
    const callOI = Math.floor(Math.random() * 100000);
    const putOI = Math.floor(Math.random() * 100000);
    
    totalCallOI += callOI;
    totalPutOI += putOI;

    strikes.push({
      strikePrice,
      callLTP: Number(callPrice.toFixed(2)),
      putLTP: Number(putPrice.toFixed(2)),
      callOI,
      putOI,
      callChangeOI: Math.floor(Math.random() * 10000) - 5000,
      putChangeOI: Math.floor(Math.random() * 10000) - 5000,
      callVolume: Math.floor(Math.random() * 50000),
      putVolume: Math.floor(Math.random() * 50000),
      callDelta: 0.5,
      putDelta: -0.5,
      callIV: 15 + Math.random() * 5,
      putIV: 15 + Math.random() * 5,
    });
  }
  
  res.json({
    underlyingSymbol: symbol,
    underlyingLTP: ltp,
    expiryDates: ['24-Aug-2026', '31-Aug-2026'],
    selectedExpiry: '24-Aug-2026',
    strikes,
    pcr: Number((totalPutOI / totalCallOI).toFixed(2)),
    maxPain: baseStrike,
    totalCallOI,
    totalPutOI
  });
});

app.post('/api/trading/order', (req: Request, res: Response) => {
  const { mode, symbol, initialType, quantity, price } = req.body;
  if (mode === 'PAPER_TRADING') {
    const newOrder = {
      id: 'ORD' + Date.now(),
      symbol,
      type: initialType,
      quantity: Number(quantity) || 1,
      price: Number(price) || 0,
      status: 'COMPLETE',
      time: new Date().toISOString()
    };
    paperOrders.unshift(newOrder);
    
    // Add to positions
    const pos = paperPositions.find((p: any) => p.symbol === symbol);
    if (pos) {
      pos.quantity += (initialType === 'BUY' ? newOrder.quantity : -newOrder.quantity);
      if (pos.quantity === 0) {
         paperPositions.splice(paperPositions.indexOf(pos), 1);
      }
    } else {
      paperPositions.push({
        id: 'POS' + Date.now(),
        symbol,
        quantity: initialType === 'BUY' ? newOrder.quantity : -newOrder.quantity,
        buyPrice: newOrder.price,
        currentLTP: newOrder.price,
        pnl: 0,
        type: initialType
      });
    }
    return res.json({ success: true, order: newOrder });
  }
  // For LIVE UPSTOX, we'd place order using Upstox API
  res.json({ success: false, error: 'Live order placement requires verified Upstox API' });
});
`;

code = code.replace("app.get('/api/trading/orders', async (req: Request, res: Response) => {", endpoints + "\napp.get('/api/trading/orders', async (req: Request, res: Response) => {");

fs.writeFileSync('server.ts', code);
console.log('Added missing endpoints');
