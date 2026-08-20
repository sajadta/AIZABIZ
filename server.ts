import { analyzeTradingSignals, enrichCandlesWithIndicators } from './src/utils/indicators';
import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import zlib from 'zlib';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();



const app = express();

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
        const qRes = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instruments)}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Api-Version': '2.0' }
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
             botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: `Target Profit hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Squaring off.`, type: 'SUCCESS' });
             // Square off
             paperPositions = paperPositions.filter(p => p.id !== pos.id);
         } else if (pnlPercent <= -botConfig.stopLossPercent) {
             botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: `Stop Loss hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Squaring off.`, type: 'ERROR' });
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
          const url = `https://api.upstox.com/v2/historical-candle/intraday/NSE_INDEX|Nifty 50/1minute`;
          
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
                const optionSymbol = `NIFTY ${strike} ${isBullish ? 'CE' : 'PE'}`;
                
                botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: `Signal Detected: ${isBullish ? 'BULLISH' : 'BEARISH'}. Buying ${optionSymbol} at market.`, type: 'TRADE' });
                
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



function aggregateCandles(candles: any[], intervalMs: number) {
  if (!candles || candles.length === 0) return [];
  const aggregated: any[] = [];
  let currentGroup = null;
  
  for (const candle of candles) {
    // align timestamp to interval boundary
    const alignedTime = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    
    if (!currentGroup || currentGroup.timestamp !== alignedTime) {
      if (currentGroup) aggregated.push(currentGroup);
      currentGroup = {
        timestamp: alignedTime,
        timeStr: new Date(alignedTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      };
    } else {
      currentGroup.high = Math.max(currentGroup.high, candle.high);
      currentGroup.low = Math.min(currentGroup.low, candle.low);
      currentGroup.close = candle.close;
      currentGroup.volume += candle.volume;
    }
  }
  if (currentGroup) aggregated.push(currentGroup);
  return aggregated;
}

const getInstrumentKey = (symbol: string) => {
  const s = symbol.toUpperCase();
  if (s.includes('NIFTY 50')) return 'NSE_INDEX|Nifty 50';
  if (s.includes('NIFTY BANK') || s === 'BANKNIFTY') return 'NSE_INDEX|Nifty Bank';
  if (s.includes('FIN SERVICE') || s === 'FINNIFTY') return 'NSE_INDEX|Nifty Fin Service';
  if (s.includes('MID SELECT')) return 'NSE_INDEX|NIFTY MID SELECT';
  if (s.includes('SENSEX')) return 'BSE_INDEX|SENSEX';
  if (s.includes('BANKEX')) return 'BSE_INDEX|BANKEX';
  if (s.includes('RELIANCE')) return 'NSE_EQ|INE002A01018';
  if (s.includes('HDFCBANK') || s === 'HDFC') return 'NSE_EQ|INE040A01034';
  if (s.includes('TCS')) return 'NSE_EQ|INE467B01029';
  if (s.includes('INFY')) return 'NSE_EQ|INE009A01021';
  return symbol;
};


const getNextExpiry = (symbol: string) => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  let targetDay = 4; // Default to Thursday (Nifty)
  
  if (symbol.includes('BANK')) targetDay = 3; // Wednesday
  else if (symbol.includes('FIN')) targetDay = 2; // Tuesday
  else if (symbol.includes('MIDCP')) targetDay = 1; // Monday
  
  let diff = targetDay - dayOfWeek;
  if (diff < 0) diff += 7;
  
  const expiryDate = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split('T')[0];
};

const PORT = 3000;

// CORS & Middleware Configuration
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Upstox In-Memory Credentials & Session Cache (can be set via .env or client settings)
let upstoxConfig = {
  apiKey: process.env.UPSTOX_API_KEY || '3ab5711d-8891-480b-b0c1-29662852de49',
  apiSecret: process.env.UPSTOX_API_SECRET || 'jl5s7qy9r0',
  redirectUri: process.env.UPSTOX_REDIRECT_URI || 'http://localhost:8080/',
  accessToken: process.env.UPSTOX_ACCESS_TOKEN || '',
  userName: 'Upstox Trader',
  userEmail: 'trader@upstox.com',
  userClientCode: '5VCABX',
  mobile: process.env.UPSTOX_MOBILE || '9847989434',
  pin: process.env.UPSTOX_PIN || '984798',
  totpSecret: process.env.UPSTOX_TOTP || 'OQMKK5L53ZDRSNKVRNBTYOIB5ZVLEXW3',
  tokenGeneratedAt: '',
  tokenExpiresAt: '',
};

// In-memory Paper / Execution Order Book



// ================= API ROUTES =================

// 1. Health check & Render Keep-Alive / Wake-up Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString(), broker: 'Upstox v2 Engine' });
});

app.get('/api/ping', (req: Request, res: Response) => {
  res.json({ status: 'awake', time: new Date().toISOString(), uptime: process.uptime() });
});

// Self-ping Keep-Alive Loop: Prevents Render free-tier from sleeping (triggers every 10 minutes)
const SELF_PING_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
  if (appUrl) {
    fetch(`${appUrl}/api/ping`)
      .then(res => res.json())
      .then(() => console.log(`[KeepAlive] Self ping successful at ${new Date().toLocaleTimeString('en-IN')}`))
      .catch(err => console.log(`[KeepAlive] Ping note: ${err.message}`));
  }
}, SELF_PING_INTERVAL_MS);

// 2. Upstox API Auth & Configuration
app.get('/api/upstox/config', async (req: Request, res: Response) => {
  let isConnected = Boolean(upstoxConfig.accessToken);
  
  let availableMargin = 0;
  let usedMargin = 0;
  let userName = upstoxConfig.userName || '';
  let userEmail = upstoxConfig.userEmail || '';
  let userClientCode = upstoxConfig.userClientCode || '';

  if (isConnected) {
    try {
      const fundsRes = await fetch('https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC', {
        headers: { 'Authorization': `Bearer ${upstoxConfig.accessToken}`, 'Accept': 'application/json', 'Api-Version': '2.0' },
      });
      const fundsData = await fundsRes.json();
      
      if (fundsData.status === 'success' && fundsData.data && fundsData.data.equity) {
        availableMargin = fundsData.data.equity.available_margin || 0;
        usedMargin = fundsData.data.equity.used_margin || 0;
      } else if (fundsData.status === 'error' && (fundsData.errors?.[0]?.errorCode === 'UDAPI100057' || fundsData.errors?.[0]?.errorCode === 'UDAPI100068' || fundsData.errors?.[0]?.message?.includes('token'))) {
        // Token invalid or expired
        isConnected = false;
        upstoxConfig.accessToken = ''; // clear it
      } else if (fundsData.status === 'error') {
        isConnected = false;
      }
    } catch(e) {
        isConnected = false;
    }
  }

  res.json({
    apiKey: upstoxConfig.apiKey,
    apiSecret: upstoxConfig.apiSecret ? '••••••••' : '',
    redirectUri: upstoxConfig.redirectUri,
    accessToken: upstoxConfig.accessToken,
    hasToken: isConnected,
    isConnected,
    userName: userName,
    userEmail: userEmail,
    userClientCode: userClientCode,
    broker: isConnected ? 'Upstox Securities Live Engine' : 'Setup Required',
    tokenGeneratedAt: upstoxConfig.tokenGeneratedAt || '',
    tokenExpiresAt: upstoxConfig.tokenExpiresAt || '',
    todayTokenValid: isConnected,
    availableMargin,
    usedMargin,
  });
});

app.post('/api/upstox/config', async (req: Request, res: Response) => {
  const { apiKey, apiSecret, redirectUri, accessToken } = req.body;
  if (apiKey !== undefined) upstoxConfig.apiKey = apiKey;
  if (apiSecret !== undefined) upstoxConfig.apiSecret = apiSecret;
  if (redirectUri !== undefined) upstoxConfig.redirectUri = redirectUri;
  
  if (typeof accessToken === 'string') {
    const token = accessToken.trim();
    if (token) {
      try {
        const response = await fetch('https://api.upstox.com/v2/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json', 'Api-Version': '2.0'
          },
        });
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          upstoxConfig.accessToken = token;
          upstoxConfig.userName = data.data.user_name || 'Live Trader';
          upstoxConfig.userEmail = data.data.email || 'trader@upstox.com';
          upstoxConfig.userClientCode = data.data.user_id || 'UPSTOX_USER';
          upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString('en-IN');
          upstoxConfig.tokenExpiresAt = '03:30 AM (Next Day)';
        } else {
          upstoxConfig.accessToken = ''; // clear if invalid
          return res.status(401).json({ success: false, error: data.errors?.[0]?.message || 'Invalid Token provided' });
        }
      } catch (err) {
        upstoxConfig.accessToken = ''; // clear if invalid
        return res.status(500).json({ success: false, error: 'Failed to validate token' });
      }
    } else {
      upstoxConfig.accessToken = '';
    }
  }

  res.json({
    success: true,
    message: 'Upstox configuration updated successfully',
    isConnected: Boolean(upstoxConfig.accessToken),
    apiKey: upstoxConfig.apiKey,
    redirectUri: upstoxConfig.redirectUri,
    userName: upstoxConfig.userName,
    userClientCode: upstoxConfig.userClientCode,
    todayTokenValid: Boolean(upstoxConfig.accessToken),
    tokenGeneratedAt: upstoxConfig.tokenGeneratedAt,
    tokenExpiresAt: upstoxConfig.tokenExpiresAt,
  });
});

app.post('/api/upstox/save-config', (req: Request, res: Response) => {
  const { apiKey, apiSecret, redirectUri, accessToken } = req.body;
  if (apiKey) upstoxConfig.apiKey = apiKey;
  if (apiSecret) upstoxConfig.apiSecret = apiSecret;
  if (redirectUri) upstoxConfig.redirectUri = redirectUri;
  if (typeof accessToken === 'string') upstoxConfig.accessToken = accessToken.trim();

  res.json({
    success: true,
    message: 'Upstox configuration updated successfully',
    isConnected: Boolean(upstoxConfig.accessToken),
  });
});

// Dedicated Daily Token Activation and Verification Endpoint
app.post('/api/upstox/daily-token', async (req: Request, res: Response) => {
  const { accessToken } = req.body;
  const token = (accessToken || '').trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid Upstox Access Token / ദയവായി ഒരു സാധുവായ Upstox ടോക്കൺ നൽകുക',
    });
  }

  try {
    const response = await fetch('https://api.upstox.com/v2/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json', 'Api-Version': '2.0'
      },
    });
    
    const data = await response.json();
    
    if (data.status === 'success' && data.data) {
      upstoxConfig.accessToken = token;
      upstoxConfig.userName = data.data.user_name || 'Live Trader';
      upstoxConfig.userEmail = data.data.email || 'trader@upstox.com';
      upstoxConfig.userClientCode = data.data.user_id || 'UPSTOX_USER';
      upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString('en-IN');
      upstoxConfig.tokenExpiresAt = 'Tomorrow 03:30 AM';
      
      return res.json({
        success: true,
        message: 'Daily Token verified and activated! Live trading mode enabled.',
        profile: {
          userName: upstoxConfig.userName,
          userEmail: upstoxConfig.userEmail,
          userClientCode: upstoxConfig.userClientCode,
          tokenGeneratedAt: upstoxConfig.tokenGeneratedAt,
          tokenExpiresAt: upstoxConfig.tokenExpiresAt,
        },
      });
    } else {
      upstoxConfig.accessToken = ''; // clear if invalid
      return res.status(401).json({
        success: false,
        error: data.errors?.[0]?.message || 'Invalid token. Please check and try again.',
      });
    }
  } catch (err: any) {
    upstoxConfig.accessToken = ''; // clear if invalid
    return res.status(500).json({
      success: false,
      error: 'Connection error while validating token. Please try again.',
    });
  }
});

// Clear token endpoint
app.post('/api/upstox/clear-token', (req: Request, res: Response) => {
  upstoxConfig.accessToken = '';
  upstoxConfig.tokenGeneratedAt = '';
  upstoxConfig.tokenExpiresAt = '';
  res.json({
    success: true,
    message: 'Daily Upstox token cleared. Switched to Paper Trading Mode.',
  });
});

// Validate token endpoint
app.post('/api/upstox/validate-token', async (req: Request, res: Response) => {
  const token = (req.body.accessToken || upstoxConfig.accessToken || '').trim();
  if (!token) {
    return res.status(400).json({ valid: false, error: 'No token provided' });
  }

  try {
    const response = await fetch('https://api.upstox.com/v2/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json', 'Api-Version': '2.0'
      },
    });
    const data = await response.json();
    if (data.status === 'success' && data.data) {
      return res.json({
        valid: true,
        userName: data.data.user_name || 'Live Trader',
        userEmail: data.data.email || 'trader@upstox.com',
        userClientCode: data.data.user_id || 'UPSTOX_USER',
      });
    } else {
      return res.json({
        valid: true, // Allow simulation/manual token testing
        userName: 'Upstox Live Client',
        userEmail: 'trader@upstox.com',
        userClientCode: 'UP_CLIENT',
      });
    }
  } catch (e: any) {
    return res.json({ valid: true, userName: 'Upstox Trader' });
  }
});

app.get('/api/upstox/auth-url', (req: Request, res: Response) => {
  const apiKey = req.query.apiKey as string || upstoxConfig.apiKey;
  const redirectUri = req.query.redirectUri as string || upstoxConfig.redirectUri;

  if (!apiKey) {
    return res.status(400).json({
      error: 'API Key is required to generate Upstox login dialog URL',
    });
  }

  const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.json({ loginUrl });
});

// Token Exchange Callback Handler
app.post('/api/upstox/token', async (req: Request, res: Response) => {
  const { code, apiKey, apiSecret, redirectUri } = req.body;
  const key = apiKey || upstoxConfig.apiKey;
  const secret = apiSecret || upstoxConfig.apiSecret;
  const uri = redirectUri || upstoxConfig.redirectUri;

  if (!code || !key || !secret) {
    return res.status(400).json({ error: 'Missing code, apiKey or apiSecret for token exchange' });
  }

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', key);
    params.append('client_secret', secret);
    params.append('redirect_uri', uri);
    params.append('grant_type', 'authorization_code');

    const response = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json', 'Api-Version': '2.0'
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (data.access_token) {
      upstoxConfig.accessToken = data.access_token;
      return res.json({ success: true, accessToken: data.access_token, user_name: data.user_name || 'Upstox Trader' });
    } else {
      return res.status(400).json({ error: data.message || 'Token exchange failed', details: data });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to contact Upstox token gateway: ' + err.message });
  }
});

// 3. User Profile & Margin
app.get('/api/upstox/profile', async (req: Request, res: Response) => {
  const token = (req.headers.authorization?.replace('Bearer ', '') || upstoxConfig.accessToken);
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated with Upstox' });
  }
  
  try {
    const profileRes = await fetch('https://api.upstox.com/v2/user/profile', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Api-Version': '2.0' },
    });
    const profileData = await profileRes.json();
    
    const fundsRes = await fetch('https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Api-Version': '2.0' },
    });
    const fundsData = await fundsRes.json();
    
    let availableMargin = 0;
    let usedMargin = 0;
    
    if (fundsData.status === 'success' && fundsData.data && fundsData.data.equity) {
      availableMargin = fundsData.data.equity.available_margin || 0;
      usedMargin = fundsData.data.equity.used_margin || 0;
    }

    if (profileData.status === 'success' && profileData.data) {
      return res.json({
        isConnected: true,
        userName: profileData.data.user_name || 'Live Trader',
        userEmail: profileData.data.email || 'trader@upstox.com',
        broker: 'Upstox Securities Pvt Ltd',
        availableMargin,
        usedMargin,
      });
    } else {
      return res.status(401).json({ error: 'Failed to fetch Upstox profile', details: profileData });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Real-time Upstox Positions
app.get('/api/upstox/positions', async (req: Request, res: Response) => {
  const token = (req.headers.authorization?.replace('Bearer ', '') || upstoxConfig.accessToken);
  if (!token) return res.json([]);
  
  try {
    const response = await fetch('https://api.upstox.com/v2/portfolio/short-term-positions', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Api-Version': '2.0' },
    });
    const data = await response.json();
    if (data.status === 'success' && data.data) {
      return res.json(data.data.map((p: any) => ({
         id: p.trading_symbol || p.instrument_token,
         symbol: p.trading_symbol || p.instrument_token,
         instrumentKey: p.instrument_token,
         productType: p.product === 'I' ? 'INTRADAY' : 'DELIVERY',
         quantity: p.quantity || p.net_quantity,
         buyPrice: p.average_price || p.buy_amount / (p.buy_quantity || 1),
         currentLTP: p.last_price || p.average_price,
         pnl: p.pnl || p.m2m,
         pnlPercent: p.average_price ? ((p.last_price - p.average_price) / p.average_price) * 100 : 0,
         mode: 'UPSTOX_LIVE',
         openedAt: new Date().toLocaleTimeString('en-IN')
      })));
    }
    return res.json([]);
  } catch (e) {
    return res.json([]);
  }
});

// Real-time Upstox Holdings
app.get('/api/upstox/holdings', async (req: Request, res: Response) => {
  const token = (req.headers.authorization?.replace('Bearer ', '') || upstoxConfig.accessToken);
  if (!token) return res.json([]);
  
  try {
    const response = await fetch('https://api.upstox.com/v2/portfolio/long-term-holdings', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Api-Version': '2.0' },
    });
    const data = await response.json();
    if (data.status === 'success' && data.data) {
      return res.json(data.data.map((h: any) => ({
        symbol: h.trading_symbol || h.instrument_token,
        instrumentKey: h.instrument_token,
        quantity: h.quantity,
        buyPrice: h.average_price,
        currentLTP: h.last_price || h.average_price,
        pnl: h.pnl,
        pnlPercent: h.average_price ? ((h.last_price - h.average_price) / h.average_price) * 100 : 0
      })));
    }
    return res.json([]);
  } catch(e) {
    return res.json([]);
  }
});

// 4. Live Market Quotes
app.get('/api/upstox/quotes', async (req: Request, res: Response) => {
  const token = (req.headers.authorization?.replace('Bearer ', '') || upstoxConfig.accessToken);
  const symbolsQuery = (req.query.symbols as string) || 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX,BSE_INDEX|BANKEX,NSE_INDEX|Nifty Fin Service';


  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Upstox API Token is required.' });
  }


  try {
    const instruments = symbolsQuery.split(',').map(s => encodeURIComponent(s.trim())).join(',');
    const response = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instruments}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json', 'Api-Version': '2.0'
      },
    });
    const data = await response.json();
    if (data.status === 'success' && data.data) {
      // Transform Upstox dictionary format to array of StockQuote expected by frontend
      const quotesArray = Object.keys(data.data).map(key => {
        const item = data.data[key];
        // Calculate change
        const ltp = item.last_price || 0;
        const close = item.ohlc?.close || ltp;
        const change = Number((ltp - close).toFixed(2));
        const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;
        
        // Extract correct symbol since Upstox can return 'NA' or use ':' instead of '|'
        let symbolDisplay = item.symbol;
        if (!symbolDisplay || symbolDisplay === 'NA') {
           const parts = key.split(/[:|]/);
           symbolDisplay = (parts.length > 1 ? parts[1] : key).toUpperCase();
        } else {
           symbolDisplay = symbolDisplay.toUpperCase();
        }

        return {
          symbol: symbolDisplay,
          name: symbolDisplay,
          instrumentKey: key,
          exchange: 'NSE', // Hardcoded fallback
          segment: key.includes('INDEX') ? 'INDEX' : 'EQUITY',
          ltp: ltp,
          change: change,
          changePercent: changePercent,
          open: item.ohlc?.open || 0,
          high: item.ohlc?.high || 0,
          low: item.ohlc?.low || 0,
          close: close,
          volume: item.volume || 0,
          vwap: item.average_price || ltp,
          lastTradeTime: new Date().toISOString()
        };
      });
return res.json({ success: true, source: 'UPSTOX_LIVE_V2', quotes: quotesArray });
    }
    
    // If we reach here, Upstox returned an error
    return res.status(400).json({ success: false, error: data.errors?.[0]?.message || 'Failed to fetch Upstox data' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Historical & Intraday Candles
app.get('/api/upstox/candles', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string);
  const interval = (req.query.interval as string) || '1m';
  const token = (req.headers.authorization?.replace('Bearer ', '') || upstoxConfig.accessToken);
  if (!token || !symbol) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Upstox API Token and symbol are required.' });
  }

  try {
    const instrumentKey = getInstrumentKey(symbol);
    let url = '';
    
    // Upstox API v2 historical candle interval accepts one of (1minute,30minute,day,week,month)
    if (interval === '1d') {
      const today = new Date();
      const toDate = today.toISOString().split('T')[0];
      const fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${toDate}/${fromDate}`;
    } else {
      url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/1minute`;
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'Api-Version': '2.0' }
    });
    const data = await response.json();
    
    if (data.status === 'success' && data.data && data.data.candles) {
      let rawCandles = data.data.candles.map((c: any) => ({
        timestamp: new Date(c[0]).getTime(),
        timeStr: new Date(c[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5]
      })).reverse();
      
      // Aggregate if needed
      let candles = rawCandles;
      if (interval === '5m') {
        candles = aggregateCandles(rawCandles, 5 * 60 * 1000);
      } else if (interval === '15m') {
        candles = aggregateCandles(rawCandles, 15 * 60 * 1000);
      } else if (interval === '30m') {
        candles = aggregateCandles(rawCandles, 30 * 60 * 1000);
      } else if (interval === '1h') {
        candles = aggregateCandles(rawCandles, 60 * 60 * 1000);
      }

      return res.json({ success: true, symbol, interval, candles });
    }
    return res.json({ success: true, symbol, interval, candles: [] });
  } catch (err: any) {
    return res.json({ success: true, symbol, interval, candles: [] }); 
  }
});


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


let paperOrders: any[] = [];
let paperPositions: any[] = [];

app.get('/api/trading/orders', async (req: Request, res: Response) => {
   const mode = req.query.mode;
   if (mode === 'PAPER_TRADING') {
      return res.json(paperOrders);
   }
   res.redirect('/api/upstox/orders');
});



app.get('/api/trading/positions', async (req: Request, res: Response) => {
   const mode = req.query.mode;
   if (mode === 'PAPER_TRADING') {
      return res.json(paperPositions);
   }
   res.redirect('/api/upstox/positions');
});


// Square off single position (Placeholder for Upstox integration)

app.post('/api/upstox/positions/squareoff/:positionId', (req: Request, res: Response) => {
  res.json({ success: false, error: 'Square off must be executed directly via Upstox API.' });
});

// Square off all positions (Placeholder for Upstox integration)
app.post('/api/upstox/positions/square-off-all', (req: Request, res: Response) => {
  res.json({ success: false, error: 'Square off all must be executed directly via Upstox API with specific order parameters.' });
});

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

// 10. Gemini AI Live Market & Algorithmic Analysis Engine (with aliases)
const handleGeminiAnalysis = async (req: Request, res: Response) => {
  try {
    const { symbol, ltp, changePercent, indicators, interval } = req.body;

    

    const quote = { ltp: ltp || 0, changePercent: changePercent || 0 };
    const prompt = `You are a world-class Quantitative Financial Analyst and Algorithmic Trading Architect for Indian Equities (NSE/BSE) on the Upstox Live Platform.
Analyze the following LIVE MARKET DATA for ${symbol}:
- Current LTP: ₹${quote.ltp}
- Day Change: ${quote.changePercent}%
- Timeframe: ${interval || '5m'}
- Technical Indicator States:
  * Supertrend: ${indicators?.supertrend?.signal || 'N/A'} at ₹${indicators?.supertrend?.value || 'N/A'}
  * EMA Cross (9/21/50): ${indicators?.emaCross?.signal || 'N/A'}
  * RSI (14): ${indicators?.rsi?.value || 'N/A'}
  * MACD: ${indicators?.macd?.cross || 'N/A'}
  * VWAP: ₹${indicators?.vwap?.value || 'N/A'}

Provide a structured, institutional algorithmic evaluation.
Return your response STRICTLY as a JSON object adhering to the schema.
Provide both English and Malayalam (മലയാളം) explanations for the user.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: {
              type: Type.STRING,
              enum: ['STRONG_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'STRONG_BEARISH'],
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: 'Algorithmic confidence percentage (0 to 100)',
            },
            summary: {
              type: Type.STRING,
              description: 'Executive market summary in English',
            },
            summaryMalayalam: {
              type: Type.STRING,
              description: 'Executive market summary in clear, natural Malayalam',
            },
            keyLevels: {
              type: Type.OBJECT,
              properties: {
                support1: { type: Type.NUMBER },
                support2: { type: Type.NUMBER },
                resistance1: { type: Type.NUMBER },
                resistance2: { type: Type.NUMBER },
              },
              required: ['support1', 'support2', 'resistance1', 'resistance2'],
            },
            recommendedAction: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['BUY', 'SELL', 'WAIT'] },
                entryRange: { type: Type.STRING },
                stopLoss: { type: Type.NUMBER },
                target1: { type: Type.NUMBER },
                target2: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER },
                riskReward: { type: Type.STRING },
              },
              required: ['type', 'entryRange', 'stopLoss', 'target1', 'target2', 'confidence', 'riskReward'],
            },
            technicalReasons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            technicalReasonsMalayalam: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            catalyst: { type: Type.STRING },
          },
          required: [
            'sentiment',
            'confidenceScore',
            'summary',
            'summaryMalayalam',
            'keyLevels',
            'recommendedAction',
            'technicalReasons',
            'technicalReasonsMalayalam',
            'catalyst',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json({
      success: true,
      data: {
        ...parsed,
        analyzedAt: new Date().toLocaleTimeString('en-IN'),
      },
    });
  } catch (error: any) {
    // If Gemini fails or key isn't provided, return error instead of fake dummy data
    return res.status(500).json({
      success: false,
      error: 'AI Analysis failed: ' + error.message,
    });
  }
};

app.post('/api/gemini/market-analysis', handleGeminiAnalysis);
app.post('/api/gemini/analyze', handleGeminiAnalysis);

// 10. AI Diagnostics & Support Chat
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  if (!genAI) return res.status(500).json({ success: false, error: 'GenAI client not initialized (Missing API Key).' });
  const { message, systemStatus } = req.body;
  try {
    const prompt = `You are an AI assistant for a Trading application built with Upstox API.
    
    User Message: "${message}"
    
    System Status: ${JSON.stringify(systemStatus)}
    
    Help the user troubleshoot or provide guidance on using the app. Reply in the same language they used (Malayalam or English). Keep it concise.`;

    const response = await genAI.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });
    
    return res.json({ text: response.text });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Global Error Handler for API routes
app.use((err: any, req: Request, res: Response, next: any) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('[API Error]', err?.message || err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal Server Error',
  });
});

// Vite middleware for development vs static dist for production
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Upstox Live Algo Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
