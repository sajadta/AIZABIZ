const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const botApiEndpoints = `
// ---------------------------------------------------------
// ALGO BOT ENGINE (BACKEND)
// ---------------------------------------------------------
import { analyzeTradingSignals, enrichCandlesWithIndicators } from './src/utils/indicators';

let botConfig = {
  enabled: false,
  mode: 'PAPER_TRADING', // 'PAPER_TRADING' | 'UPSTOX_LIVE'
  selectedStrategy: 'PROFIT_MAX_100_PERCENT_MATRIX',
  minConfidence: 85,
  riskPerTradePercent: 1.5,
  stopLossPercent: 10,
  targetProfitPercent: 30,
  trailingStopLoss: true,
  multiTimeframeEnabled: true,
  optionStrikeSelector: true,
  tradeMode: 'OPTIONS_ONLY', // 'OPTIONS_ONLY'
  maxOptionLossCount: 4,
  maxOptionProfitCount: 15,
  minOptionProfitAmount: 300,
  dailyLossLocked: false,
  dailyMaxLossLimit: 500
};

let botLogs: any[] = [];
let botSignals: any[] = [];

// API Endpoints for Bot
app.get('/api/bot/config', (req, res) => res.json(botConfig));
app.post('/api/bot/config', (req, res) => {
  botConfig = { ...botConfig, ...req.body };
  botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: 'Bot configuration updated.', type: 'INFO' });
  res.json(botConfig);
});
app.get('/api/bot/logs', (req, res) => res.json(botLogs.slice(0, 50)));
app.get('/api/bot/signals', (req, res) => res.json(botSignals.slice(0, 20)));

// Bot Loop Interval
setInterval(async () => {
  if (!botConfig.enabled) return;

  try {
    // 1. Process active positions for Auto-Square Off (Target/SL)
    const activePositions = botConfig.mode === 'PAPER_TRADING' ? paperPositions : []; // TODO: Add live positions
    
    let currentLiveQuote = 24200; // Fallback
    
    // Fetch live quotes to update PNL
    const token = upstoxConfig.accessToken;
    const instruments = 'NSE_INDEX|Nifty 50';
    if (token) {
        const qRes = await fetch(\`https://api.upstox.com/v2/market-quote/quotes?instrument_key=\${encodeURIComponent(instruments)}\`, {
          headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json', 'Api-Version': '2.0' }
        });
        const qData = await qRes.json();
        if (qData?.data?.[instruments]?.last_price) {
           currentLiveQuote = qData.data[instruments].last_price;
        }
    }
    
    for (let pos of activePositions) {
      if (pos.type === 'BUY' && pos.symbol.includes('CE') || pos.symbol.includes('PE')) {
         // It's an option. We need option LTP. 
         // For now, simulate option price movement based on Index movement if we don't have live option quotes.
         const ltp = pos.currentLTP || pos.buyPrice; // updated via frontend paper-sync or live sync
         const pnlPercent = ((ltp - pos.buyPrice) / pos.buyPrice) * 100;
         
         if (pnlPercent >= botConfig.targetProfitPercent) {
             botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: \`Target Profit hit (\${pnlPercent.toFixed(2)}%) for \${pos.symbol}. Squaring off.\`, type: 'SUCCESS' });
             // Square off
             paperPositions = paperPositions.filter(p => p.id !== pos.id);
         } else if (pnlPercent <= -botConfig.stopLossPercent) {
             botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: \`Stop Loss hit (\${pnlPercent.toFixed(2)}%) for \${pos.symbol}. Squaring off.\`, type: 'ERROR' });
             // Square off
             paperPositions = paperPositions.filter(p => p.id !== pos.id);
         }
      }
    }

    // 2. If no positions, look for entry
    if (activePositions.length === 0) {
       // Fetch candles
       if (token) {
          const today = new Date();
          const toDate = today.toISOString().split('T')[0];
          const url = \`https://api.upstox.com/v2/historical-candle/intraday/NSE_INDEX|Nifty 50/1minute\`;
          
          const cRes = await fetch(url, { headers: { 'Accept': 'application/json', 'Api-Version': '2.0' } });
          const cData = await cRes.json();
          if (cData.status === 'success' && cData.data?.candles) {
             let rawCandles = cData.data.candles.map((c: any) => ({
                timestamp: new Date(c[0]).getTime(),
                timeStr: new Date(c[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
             })).reverse();
             
             const enriched = enrichCandlesWithIndicators(rawCandles);
             const signal = analyzeTradingSignals('NIFTY 50', 'NIFTY 50', 'NSE_INDEX|Nifty 50', enriched, currentLiveQuote, botConfig.selectedStrategy as any);
             
             if (signal && (signal.signal === 'BUY' || signal.signal === 'SELL') && signal.confidence >= botConfig.minConfidence) {
                // Execute Trade on Option!
                const isBullish = signal.signal === 'BUY';
                const strike = Math.round(currentLiveQuote / 50) * 50;
                const optionSymbol = \`NIFTY \${strike} \${isBullish ? 'CE' : 'PE'}\`;
                
                botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: \`Signal Detected: \${isBullish ? 'BULLISH' : 'BEARISH'}. Buying \${optionSymbol} at market.\`, type: 'TRADE' });
                
                if (botConfig.mode === 'PAPER_TRADING') {
                   const optionPrice = 120 + Math.random() * 20; // Simulated option premium
                   paperOrders.unshift({ id: 'ORD'+Date.now(), symbol: optionSymbol, type: 'BUY', quantity: 50, price: optionPrice, status: 'COMPLETE', time: new Date().toISOString() });
                   paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: 50, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY' });
                }
             }
          }
       }
    }
    
  } catch (err) {
     console.error('Bot loop error:', err);
  }
}, 5000);
`;

code = code.replace("const app = express();", "const app = express();\n" + botApiEndpoints);

fs.writeFileSync('server.ts', code);
console.log('Bot Engine patched.');
