const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Add the SSE endpoint BEFORE setupVite();
const sseCode = `
app.get('/api/stream/quotes', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let symbols = 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX,BSE_INDEX|BANKEX,NSE_INDEX|Nifty Fin Service';
    if (req.query.symbols) {
       symbols = req.query.symbols;
    }

    const fetchAndPushQuotes = async () => {
        const token = upstoxConfig.accessToken;
        if (!token) return;
        try {
            const instruments = symbols.split(',').map(s => encodeURIComponent(s.trim())).join(',');
            const response = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${instruments}\`, {
                headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
            });
            const data = await response.json();
            if (data.status === 'success' && data.data) {
                const quotesList = Object.keys(data.data).map(key => {
                    const item = data.data[key];
                    const ltp = item.last_price || 0;
                    const close = item.ohlc?.close || ltp;
                    const change = Number((ltp - close).toFixed(2));
                    const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;
                    
                    let symbolDisplay = item.symbol;
                    if (!symbolDisplay || symbolDisplay === 'NA') {
                        const parts = key.split(/[:|]/);
                        symbolDisplay = (parts.length > 1 ? parts[1] : key).toUpperCase();
                    } else {
                        symbolDisplay = symbolDisplay.toUpperCase();
                    }
                    return {
                        symbol: symbolDisplay,
                        instrumentKey: key,
                        ltp, change, changePercent,
                        volume: item.volume || 0,
                        open: item.ohlc?.open || 0,
                        high: item.ohlc?.high || 0,
                        low: item.ohlc?.low || 0,
                        close
                    };
                });
                res.write(\`data: \${JSON.stringify({ type: 'QUOTES', data: quotesList })}\\n\\n\`);
            }
        } catch(err) {}
    };

    const quoteInterval = setInterval(fetchAndPushQuotes, 1000);
    req.on('close', () => {
        clearInterval(quoteInterval);
    });
});

`;

// Remove the old WebSocket logic in setupVite()
// We'll just replace the entire setupVite function.
const oldSetupVite = `async function setupVite()  {
  if (process.env.NODE_ENV !== 'production')  {
    const vite= await createViteServer({
      server: {  middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response)  => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', ()  => {
    console.log(\`Upstox Live Algo Server running on http://0.0.0.0:\${PORT}\`);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head)  => {
      console.log('UPGRADE REQUEST:', request.url);
      if (request.url?.startsWith('/api/ws/quotes'))  {
          wss.handleUpgrade(request, socket, head, (ws)  => {
              wss.emit('connection', ws, request);
          });
          return;
      }
      // other upgrades (like VitemHMR)  are handled by Vite
  });

  wss.on('connection', (ws)  => {
      let quoteInterval;
      let symbols = 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX,BSE_INDEX|BANKEX,NSE_INDEX|Nifty Fin Service';
      
      ws.on('message', (message)  => {
          try {
              const data = JSON.parse(message.toString());
              if (data.type === 'SET_SYMBOLS')  {
                  symbols = data.symbols;
              }
          } catch(e)  {}
      });

      const fetchAndPushQuotes = async ()  => {
          const token = upstoxConfig.accessToken;
          if (!token)  return;
          try {
              const instruments = symbols.split(',') .map(s => encodeURIComponent(s.trim())) .join(',');
              const response = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${instruments}\`, {
                  headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
              });
              const data = await response.json();
              if (data.status === 'success' && data.data)  {
                  const quotesList = Object.keys(data.data) .map(key => {
                      const item = data.data[key];
                      const ltp = item.last_price || 0;
                      const close = item.ohlc?.close || ltp;
                      const change = Number((ltp - close) .toFixed(2));
                      const changePercent = close > 0 ? Number(((change / close)  * 100) .toFixed(2)) : 0;
                      
                      let symbolDisplay = item.symbol;
                      if (!symbolDisplay || symbolDisplay === 'NA')  {
                          const parts = key.split(/[:|]/);
                          symbolDisplay = (parts.length > 1 ? parts[1]: key) .toUpperCase();
                      } else {
                          symbolDisplay = symbolDisplay.toUpperCase();
                      }
                      return {
                          symbol: symbolDisplay,
                          instrumentKey: key,
                          ltp, change, changePercent,
                          volume: item.volume || 0,
                          open: item.ohlc?.open || 0,
                          high: item.ohlc?.high || 0,
                          low: item.ohlc?.low || 0,
                          close
                      };
                  });
                  if (ws.readyState === 1)  { // OPEN
                      ws.send(JSON.stringify({ type: 'QUOTES', data: quotesList }));
                  }
              }
          } catch(err)  {}
      };

      quoteInterval = setInterval(fetchAndPushQuotes, 1000);

      ws.on('close', ()  => {
          clearInterval(quoteInterval);
      });
  });
}`;

const newSetupVite = `async function setupVite()  {
  if (process.env.NODE_ENV !== 'production')  {
    const vite= await createViteServer({
      server: {  middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response)  => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', ()  => {
    console.log(\`Upstox Live Algo Server running on http://0.0.0.0:\${PORT}\`);
  });
}`;

// Make sure code contains oldSetupVite to replace it
if (code.includes('async function setupVite()')) {
    const splitIndex = code.indexOf('async function setupVite()');
    let part1 = code.slice(0, splitIndex);
    code = part1 + sseCode + newSetupVite + '\n\nsetupVite();\n';
    fs.writeFileSync('server.ts', code);
    console.log('Successfully replaced WS with SSE in server.ts');
} else {
    console.log('Error: Could not find setupVite in server.ts');
}
