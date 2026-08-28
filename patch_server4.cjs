const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Quotes
const qTarget = `  if (!token) {
    const dummy = symbols.split(',').reduce((acc: any, s: string) => {
        acc[s] = { last_price: (20000 + Math.random()*100), net_change: Math.random()*50 };
        return acc;
    }, {});
    return res.json({ status: 'success', data: dummy, quotes: formatDataToQuotesList(dummy) });
  }`;

const qReplace = `  if (!token) {
    return res.status(401).json({ status: 'error', error: 'Upstox login required for live data' });
  }`;

code = code.replace(qTarget, qReplace);

// Candles
const cTarget = `  if (!token || !symbol)  {
    // Generate simulated candles if not logged in
    const dummy = { status: 'success', data: { candles: [] } };
    let basePrice = 20000;
    const now = new Date();
    for (let i = 100; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        const o = basePrice;
        const h = o + Math.random() * 20;
        const l = o - Math.random() * 20;
        const c = l + Math.random() * (h - l);
        basePrice = c;
        dummy.data.candles.push([
            time.toISOString(), o, h, l, c, 1000 + Math.random() * 5000, 0
        ]);
    }
    return res.json(dummy);
  }`;

const cReplace = `  if (!token || !symbol)  {
    return res.status(401).json({ success: false, error: 'Unauthorized: Upstox API Token and symbol are required.' });
  }`;

code = code.replace(cTarget, cReplace);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts 4 (Removed all dummy data endpoints)");
