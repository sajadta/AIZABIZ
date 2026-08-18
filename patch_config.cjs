const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regexConfig = /app\.get\('\/api\/upstox\/config', \(req: Request, res: Response\) => \{[\s\S]*?\}\);/;

const newConfigRoute = `app.get('/api/upstox/config', async (req: Request, res: Response) => {
  const isConnected = Boolean(upstoxConfig.accessToken);
  
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
      }
    } catch(e) {}
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
});`;

code = code.replace(regexConfig, newConfigRoute);
fs.writeFileSync('server.ts', code);
