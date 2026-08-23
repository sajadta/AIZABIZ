const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `// ---------------------------------------------------------
// ALGO BOT ENGINE (BACKEND) 
// ---------------------------------------------------------
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
  tradeMmode: 'OPTIONS_ONLY', // 'OPTIONS_ONLY' 
  maxOptionLossCount: 4, 
  maxOptionProfitCount: 15, 
  minOptionProfitAmount: 300,
  dailyLossLocked: false,
  dailyMaxLossLimit: 500
};`;

const replace1 = `import { db } from './src/db/index.ts';
import { users, paperOrders as dbPaperOrders } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------
// ALGO BOT ENGINE (BACKEND) 
// ---------------------------------------------------------
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
  tradeMmode: 'OPTIONS_ONLY', // 'OPTIONS_ONLY' 
  maxOptionLossCount: 4, 
  maxOptionProfitCount: 15, 
  minOptionProfitAmount: 300,
  dailyLossLocked: false,
  dailyMaxLossLimit: 500
};

// Start sync from DB
async function syncFromDb() {
  try {
    const user = await db.select().from(users).where(eq(users.uid, 'ADMIN_USER')).limit(1);
    if (user && user[0]) {
       if (user[0].upstoxApiKey) upstoxConfig.apiKey = user[0].upstoxApiKey;
       if (user[0].upstoxRedirectUri) upstoxConfig.redirectUri = user[0].upstoxRedirectUri;
       if (user[0].upstoxAccessToken) {
          upstoxConfig.accessToken = user[0].upstoxAccessToken;
          upstoxConfig.isConnected = true;
       }
       if (user[0].botConfig) {
          try {
             botConfig = { ...botConfig, ...JSON.parse(user[0].botConfig) };
          } catch(e) {}
       }
       console.log('Successfully loaded config from DB on startup');
    }
  } catch (err) {
    console.error('Error syncing from DB on startup:', err);
  }
}
syncFromDb();
`;

code = code.replace(target1, replace1);

const target2 = `app.post('/api/upstox/config', (req: Request, res: Response) => {
  try {
    const cfg = req.body;
    if (cfg.apiKey) upstoxConfig.apiKey = cfg.apiKey;
    if (cfg.apiSecret) upstoxConfig.apiSecret = cfg.apiSecret;
    if (cfg.redirectUri) upstoxConfig.redirectUri = cfg.redirectUri;
    if (cfg.accessToken) {
      upstoxConfig.accessToken = cfg.accessToken;
      upstoxConfig.isConnected = true;
    }
    if (cfg.geminiApiKey) upstoxConfig.geminiApiKey = cfg.geminiApiKey;
    
    res.json({ success: true, message: 'Config updated' });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});`;

const replace2 = `app.post('/api/upstox/config', async (req: Request, res: Response) => {
  try {
    const cfg = req.body;
    if (cfg.apiKey) upstoxConfig.apiKey = cfg.apiKey;
    if (cfg.apiSecret) upstoxConfig.apiSecret = cfg.apiSecret;
    if (cfg.redirectUri) upstoxConfig.redirectUri = cfg.redirectUri;
    if (cfg.accessToken) {
      upstoxConfig.accessToken = cfg.accessToken;
      upstoxConfig.isConnected = true;
    }
    if (cfg.geminiApiKey) upstoxConfig.geminiApiKey = cfg.geminiApiKey;
    
    // Save to DB
    await db.insert(users)
      .values({ uid: 'ADMIN_USER', email: 'admin@local', upstoxApiKey: upstoxConfig.apiKey, upstoxRedirectUri: upstoxConfig.redirectUri, upstoxAccessToken: upstoxConfig.accessToken })
      .onConflictDoUpdate({
        target: users.uid,
        set: { upstoxApiKey: upstoxConfig.apiKey, upstoxRedirectUri: upstoxConfig.redirectUri, upstoxAccessToken: upstoxConfig.accessToken }
      });

    res.json({ success: true, message: 'Config updated in Database' });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});`;

code = code.replace(target2, replace2);

const target3 = `app.post('/api/bot/toggle', (req: Request, res: Response) => {
  botConfig.enabled = !botConfig.enabled;
  if (botConfig.enabled) {
    botLogs.unshift({ time: new Date().toISOString(), type: 'system', message: 'Algo Bot STARTED' });
  } else {
    botLogs.unshift({ time: new Date().toISOString(), type: 'system', message: 'Algo Bot STOPPED' });
  }
  res.json({ success: true, enabled: botConfig.enabled });
});`;

const replace3 = `app.post('/api/bot/toggle', async (req: Request, res: Response) => {
  botConfig.enabled = !botConfig.enabled;
  if (botConfig.enabled) {
    botLogs.unshift({ time: new Date().toISOString(), type: 'system', message: 'Algo Bot STARTED' });
  } else {
    botLogs.unshift({ time: new Date().toISOString(), type: 'system', message: 'Algo Bot STOPPED' });
  }
  
  // Save bot config state to DB
  try {
     await db.update(users).set({ botConfig: JSON.stringify(botConfig) }).where(eq(users.uid, 'ADMIN_USER'));
  } catch(e) {}
  
  res.json({ success: true, enabled: botConfig.enabled });
});`;

code = code.replace(target3, replace3);

fs.writeFileSync('server.ts', code);
console.log('server.ts patched with DB logic');
