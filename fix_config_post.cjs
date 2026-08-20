const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regexPostConfig = /app\.post\('\/api\/upstox\/config', async \(req: Request, res: Response\) => \{[\s\S]*?res\.json\(\{\s*success: true,[\s\S]*?\}\);\s*\}\);/m;

const replacementPostConfig = `app.post('/api/upstox/config', async (req: Request, res: Response) => {
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
            'Authorization': \`Bearer \${token}\`,
            'Accept': 'application/json',
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
});`;

code = code.replace(regexPostConfig, replacementPostConfig);
fs.writeFileSync('server.ts', code);
