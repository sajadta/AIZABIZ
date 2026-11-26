// Upstox configuration, proxy, daily-token, clear-token and validate-token routes.
import express from 'express';
import type { Request, Response } from 'express';
import { upstoxConfig, botConfig, invalidTokens, setCachedUpstoxLivePositions } from '../../state';
import { isUpstoxAuthFailureError } from '../../utils';
import { saveTokenBackupToDisk } from '../../lib/tokens';
import { savePostgresDb } from '../../services/persistence';
import { publishTokenToCloudRelay, resetVerifiedTokenCache } from '../../services/tokenSync';
import { registerProxyConfigRoutes } from './proxyConfig';
import { registerTokenRoutes } from './tokenRoutes';

export function registerAuthConfigRoutes(app: express.Application) {
  registerProxyConfigRoutes(app);
  registerTokenRoutes(app);

  app.post('/api/market/config', async (req: Request, res: Response) => {
    const { apiKey, apiSecret, redirectUri, accessToken, mobile, pin } = req.body;
    if (apiKey !== undefined) upstoxConfig.apiKey = apiKey.trim();
    if (apiSecret !== undefined && apiSecret !== '••••••••' && apiSecret.trim() !== '') {
      upstoxConfig.apiSecret = apiSecret.trim();
    }
    if (redirectUri !== undefined) upstoxConfig.redirectUri = redirectUri.trim();
    if (mobile !== undefined && String(mobile).trim()) upstoxConfig.mobile = String(mobile).trim();
    if (pin !== undefined && String(pin).trim()) upstoxConfig.pin = String(pin).trim();

    if (typeof accessToken === 'string') {
      let token = accessToken.trim();
      if (token.startsWith('Bearer ')) token = token.replace('Bearer ', '').trim();
      if (token) {
        // If the user explicitly posts a token, we remove it from invalidTokens to allow re-validation.
        // This helps in cases where a transient error might have incorrectly flagged a valid token.
        if (invalidTokens.has(token)) {
          invalidTokens.delete(token);
        }

        try {
          const response = await fetch('https://api.upstox.com/v2/user/profile', {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Api-Version': '2.0',
            },
          });
          const data = await response.json();
          if (data.status === 'success' && data.data) {
            upstoxConfig.accessToken = token;
            upstoxConfig.userName = data.data.user_name || 'Live Trader';
            upstoxConfig.userEmail = data.data.email || 'trader@upstox.com';
            upstoxConfig.userClientCode = data.data.user_id || 'UPSTOX_USER';
            upstoxConfig.tokenGeneratedAt = new Date().toLocaleTimeString('en-IN');
            upstoxConfig.tokenExpiresAt = '03:30 AM (Next Day) ';
            if (!botConfig.userExplicitlySelectedMode) {
              botConfig.mode = 'UPSTOX_LIVE';
            }
            resetVerifiedTokenCache();
            setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
            saveTokenBackupToDisk(token, upstoxConfig);
            await savePostgresDb().catch(() => {
              /* ignore */
            });
            publishTokenToCloudRelay(token).catch(() => {
              /* ignore */
            });
          } else if (isUpstoxAuthFailureError(response.status, data)) {
            invalidTokens.add(token);
            upstoxConfig.accessToken = '';
            return res.status(401).json({
              success: false,
              error: data.errors?.[0]?.message || 'Invalid or expired Upstox token provided',
            });
          }
        } catch (err) {
          return res.status(500).json({ success: false, error: 'Failed to validate token' });
        }
      }
    }

    await savePostgresDb().catch(() => {
      /* ignore */
    });

    res.json({
      success: true,
      message: 'Upstox configuration updated successfully',
      isConnected: Boolean(upstoxConfig.accessToken),
      hasApiKey: Boolean(upstoxConfig.apiKey || process.env.UPSTOX_API_KEY),
      hasApiSecret: Boolean(upstoxConfig.apiSecret || process.env.UPSTOX_API_SECRET),
      redirectUri: upstoxConfig.redirectUri,
      userName: upstoxConfig.userName,
      userClientCode: upstoxConfig.userClientCode,
      todayTokenValid: Boolean(upstoxConfig.accessToken),
      tokenGeneratedAt: upstoxConfig.tokenGeneratedAt,
      tokenExpiresAt: upstoxConfig.tokenExpiresAt,
    });
  });

  app.post('/api/market/save-config', (req: Request, res: Response) => {
    const { apiKey, apiSecret, redirectUri, accessToken, mobile, pin } = req.body;
    if (apiKey) upstoxConfig.apiKey = apiKey.trim();
    if (apiSecret && apiSecret !== '••••••••') upstoxConfig.apiSecret = apiSecret.trim();
    if (redirectUri) upstoxConfig.redirectUri = redirectUri.trim();
    if (mobile && String(mobile).trim()) upstoxConfig.mobile = String(mobile).trim();
    if (pin && String(pin).trim()) upstoxConfig.pin = String(pin).trim();
    if (typeof accessToken === 'string' && accessToken.trim().length > 20) {
      const cleanToken = accessToken.replace(/^Bearer\s+/i, '').trim();
      upstoxConfig.accessToken = cleanToken;
      invalidTokens.delete(cleanToken);
      resetVerifiedTokenCache();
      setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
      saveTokenBackupToDisk(cleanToken, upstoxConfig);
      publishTokenToCloudRelay(cleanToken).catch(() => {
        /* ignore */
      });
    }

    savePostgresDb().catch(() => {
      /* ignore */
    });

    res.json({
      success: true,
      message: 'Upstox configuration updated successfully',
      isConnected: Boolean(upstoxConfig.accessToken),
      mobile: upstoxConfig.mobile,
    });
  });
}
