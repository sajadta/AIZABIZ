const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const declarations = `
let paperPositions: any[] = [];
let paperOrders: any[] = [];
let paperOrderIdCounter = 1000;
`;

code = code.replace(
  "let dailyStats = {",
  declarations + "\nlet dailyStats = {"
);

const orderLogic = `
  if (req.body.mode === 'PAPER_TRADING') {
     const pOrderId = 'PT' + paperOrderIdCounter++;
     const execPrice = price || (symbol.includes('BANK') ? 52000 : 24500); // We don't have LTP in body unless passed, but wait, req.body.price is sent as defaultPrice which is LTP from frontend!
     
     const newOrder = {
         id: pOrderId,
         orderId: pOrderId,
         symbol: symbol,
         instrumentKey: instrumentKey,
         transactionType: transactionType,
         orderType: orderType,
         productType: productType,
         quantity: Number(quantity),
         price: Number(req.body.price || 0),
         status: 'complete',
         executedPrice: Number(req.body.price || 0),
         timestamp: new Date().toISOString(),
         mode: 'PAPER_TRADING'
     };
     paperOrders.push(newOrder);

     // Update paper position
     const existingPos = paperPositions.find(p => p.symbol === symbol && p.productType === productType);
     const qtyMult = transactionType === 'BUY' ? 1 : -1;
     const newQty = (existingPos ? existingPos.quantity : 0) + (Number(quantity) * qtyMult);

     if (existingPos) {
       if (newQty === 0) {
          paperPositions = paperPositions.filter(p => p.symbol !== symbol || p.productType !== productType);
       } else {
          existingPos.quantity = newQty;
          // simplify avg price
          if (transactionType === 'BUY') existingPos.buyPrice = newOrder.price;
       }
     } else {
       paperPositions.push({
         id: pOrderId,
         symbol: symbol,
         instrumentKey: instrumentKey,
         productType: productType,
         quantity: newQty,
         buyPrice: newOrder.price,
         currentLTP: newOrder.price,
         pnl: 0,
         pnlPercent: 0,
         mode: 'PAPER_TRADING'
       });
     }

     return res.json({ success: true, orderId: pOrderId, liveBrokerResponse: { status: 'success', data: { order_id: pOrderId } } });
  }
`;

code = code.replace(
  "const handleOrderPlacement = async (req: Request, res: Response) => {\n  const { symbol, instrumentKey, transactionType, orderType, productType, quantity, price, triggerPrice } = req.body;",
  "const handleOrderPlacement = async (req: Request, res: Response) => {\n  const { symbol, instrumentKey, transactionType, orderType, productType, quantity, price, triggerPrice } = req.body;\n" + orderLogic
);

// We need to return paper positions / orders 
const positionsLogic = `
app.get('/api/trading/positions', async (req: Request, res: Response) => {
   const mode = req.query.mode;
   if (mode === 'PAPER_TRADING') {
      return res.json(paperPositions);
   }
   res.redirect('/api/upstox/positions');
});
`;

code = code.replace(
  "app.get('/api/trading/positions', async (req: Request, res: Response) => {\n   res.redirect('/api/upstox/positions');\n});",
  positionsLogic
);

const ordersLogic = `
app.get('/api/trading/orders', async (req: Request, res: Response) => {
   const mode = req.query.mode;
   if (mode === 'PAPER_TRADING') {
      return res.json(paperOrders);
   }
   res.redirect('/api/upstox/orders');
});
`;

code = code.replace(
  "app.get('/api/trading/orders', async (req: Request, res: Response) => {\n   res.redirect('/api/upstox/orders');\n});",
  ordersLogic
);

// We need to allow frontend to update the LTP of paper positions so PNL is calculated
const syncPaperLtpLogic = `
app.post('/api/trading/paper-sync', (req: Request, res: Response) => {
   const { quotes } = req.body;
   if (quotes && Array.isArray(quotes)) {
      paperPositions = paperPositions.map(pos => {
         const q = quotes.find((x: any) => x.symbol === pos.symbol);
         if (q) {
            pos.currentLTP = q.ltp;
            pos.pnl = (q.ltp - pos.buyPrice) * pos.quantity;
            pos.pnlPercent = ((q.ltp - pos.buyPrice) / pos.buyPrice) * 100;
         }
         return pos;
      });
   }
   res.json({ success: true });
});
`;

code = code.replace(
  "// 10. Gemini AI Live Market",
  syncPaperLtpLogic + "\n// 10. Gemini AI Live Market"
);

// Square off logic
const squareOffLogic = `
app.post('/api/trading/squareoff/:positionId', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode === 'PAPER_TRADING') {
     const posId = req.params.positionId;
     const idx = paperPositions.findIndex(p => p.id === posId || p.symbol === posId);
     if (idx >= 0) {
        paperPositions.splice(idx, 1);
        return res.json({ success: true });
     }
  }
  res.json({ success: false, error: 'Square off must be executed directly via Upstox API with specific order parameters.' });
});

app.post('/api/trading/squareoff-all', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode === 'PAPER_TRADING') {
     paperPositions = [];
     return res.json({ success: true });
  }
  res.json({ success: false, error: 'Square off all must be executed directly via Upstox API.' });
});
`;

code = code.replace(
  "app.post('/api/trading/squareoff/:positionId', (req: Request, res: Response) => {\n  res.json({ success: false, error: 'Square off must be executed directly via Upstox API with specific order parameters.' });\n});",
  ""
);
code = code.replace(
  "app.post('/api/trading/squareoff-all', (req: Request, res: Response) => {\n  res.json({ success: false, error: 'Square off all must be executed directly via Upstox API.' });\n});",
  squareOffLogic
);

fs.writeFileSync('server.ts', code);
