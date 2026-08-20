const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Find the boundaries
const startIdx = code.indexOf("app.get('/api/upstox/config', async (req: Request, res: Response) => {");
const nextEndpointIdx = code.indexOf("app.post('/api/upstox/config', async (req: Request, res: Response) => {");

if (startIdx !== -1 && nextEndpointIdx !== -1) {
  const replacement = `app.get('/api/upstox/config', async (req: Request, res: Response) => {
  let isConnected = Boolean(upstoxConfig.accessToken);
  
  let availableMargin = 0;
  let usedMargin = 0;
  let userName = upstoxConfig.userName || '';
  let userEmail = upstoxConfig.userEmail || '';
  let userClientCode = upstoxConfig.userClientCode || '';

  if (isConnected) {
    try {
      const fundsRes = await fetch('https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC', {
        headers: { 'Authorization': \`Bearer \${upstoxConfig.accessToken}\`, 'Accept': 'application/json' },
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

`;
  code = code.substring(0, startIdx) + replacement + code.substring(nextEndpointIdx);
  fs.writeFileSync('server.ts', code);
}
