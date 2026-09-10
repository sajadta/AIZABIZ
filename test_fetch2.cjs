fetch('https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_INDEX|Nifty%2050', {
  headers: { Accept: 'application/json' }
}).then(r => r.json()).then(console.log).catch(console.error);
