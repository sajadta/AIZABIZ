const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regexPost = /app\.post\('\/api\/upstox\/daily-token', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;

const replacementPost = `app.post('/api/upstox/daily-token', async (req: Request, res: Response) => {
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
});`;

code = code.replace(regexPost, replacementPost);

fs.writeFileSync('server.ts', code);
