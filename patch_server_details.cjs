const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newRoute = `
// Real-time instrument lookup
app.get('/api/instrument/details', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || '';
  const instrumentKey = getInstrumentKey(symbol);
  
  let lotSize = 1;
  if (symbol.includes('FIN SERVICE') || symbol.includes('FINNIFTY')) lotSize = 65;
  if (symbol.includes('BANK')) lotSize = 15;
  if (symbol.includes('NIFTY')) lotSize = 25; // Default correct for Nifty 50 currently
  if (symbol.includes('SENSEX')) lotSize = 10;
  
  const token = upstoxConfig.accessToken;
  // If it's an option or index, try fetching contract to get the exact real-time lot size
  if (token && (symbol.includes('NIFTY') || symbol.includes('BANK') || symbol.includes('SENSEX'))) {
     try {
         const contractRes = await fetch(\`https://api.upstox.com/v2/option/contract?instrument_key=\${encodeURIComponent(instrumentKey)}\`, {
             headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json' }
         });
         if (contractRes.ok) {
             const contractData = await contractRes.json();
             if (contractData.data && contractData.data.length > 0) {
                 if (contractData.data[0].lot_size) {
                     lotSize = contractData.data[0].lot_size;
                 }
             }
         }
     } catch (e) {
         // ignore, use defaults
     }
  }

  res.json({ symbol, instrumentKey, lotSize });
});

app.get('/api/upstox/optionchain', async (req: Request, res: Response) => {`;

code = code.replace(`app.get('/api/upstox/optionchain', async (req: Request, res: Response) => {`, newRoute);
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts with /api/instrument/details');
