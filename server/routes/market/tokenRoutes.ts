// Daily token activation, token clearing and token validation routes.
import express from 'express';
import type { Request, Response } from 'express';
import { upstoxConfig, botConfig, invalidTokens, setCachedUpstoxLivePositions } from '../../state';
import { isUpstoxAuthFailureError } from '../../utils';
import { saveTokenBackupToDisk } from '../../lib/tokens';
import { savePostgresDb } from '../../services/persistence';
import { publishTokenToCloudRelay, resetVerifiedTokenCache } from '../../services/tokenSync';

export function registerTokenRoutes(app: express.Application) {
  // Dedicated Daily Token Activation and Verification Endpoint
  app.post('/api/market/daily-token', async (req: Request, res: Response) => {
    const { accessToken } = req.body;
    let token = (accessToken || '').trim();
    if (token.startsWith('Bearer ')) token = token.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Upstox Access Token / ദയവായി ഒരു സാധുവായ Upstox ടോക്കൺ നൽകുക',
      });
    }

    if (invalidTokens.has(token)) {
      upstoxConfig.accessToken = '';
      return res.status(401).json({
        success: false,
        error: 'This Upstox token has expired (UDAPI100050). Please generate a fresh daily token.',
      });
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
        upstoxConfig.tokenExpiresAt = 'Tomorrow 03:30 AM';
        if (!botConfig.userExplicitlySelectedMode) {
          botConfig.mode = 'UPSTOX_LIVE';
        }
        invalidTokens.delete(token);
        resetVerifiedTokenCache();
        setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
        saveTokenBackupToDisk(token, upstoxConfig);
        await savePostgresDb().catch(() => {
          /* ignore */
        });
        publishTokenToCloudRelay(token).catch(() => {
          /* ignore */
        });

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
        if (isUpstoxAuthFailureError(response.status, data)) {
          invalidTokens.add(token);
        }
        upstoxConfig.accessToken = '';
        resetVerifiedTokenCache();
        return res.status(401).json({
          success: false,
          error:
            data.errors?.[0]?.message ||
            'Invalid or expired token. Please generate a new token and try again.',
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Connection error while validating token. Please try again.',
      });
    }
  });

  // Clear token endpoint
  app.post('/api/market/clear-token', (req: Request, res: Response) => {
    upstoxConfig.accessToken = '';
    upstoxConfig.tokenGeneratedAt = '';
    upstoxConfig.tokenExpiresAt = '';
    resetVerifiedTokenCache();
    setCachedUpstoxLivePositions({ timestamp: 0, list: [] });
    saveTokenBackupToDisk('', upstoxConfig);
    savePostgresDb().catch(() => {
      /* ignore */
    });
    res.json({
      success: true,
      message: 'Daily Upstox token cleared. Switched to Paper Trading Mode.',
    });
  });

  // Validate token endpoint
  app.post('/api/market/validate-token', async (req: Request, res: Response) => {
    const token = (req.body.accessToken || upstoxConfig.accessToken || '').trim();
    if (!token) {
      return res.status(400).json({ valid: false, error: 'No token provided' });
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
        return res.json({
          valid: true,
          userName: data.data.user_name || 'Live Trader',
          userEmail: data.data.email || '',
          userClientCode: data.data.user_id || '',
        });
      } else {
        invalidTokens.add(token);
        return res.status(401).json({
          valid: false,
          error: data.errors?.[0]?.message || 'Invalid or expired Upstox token',
        });
      }
    } catch (e: any) {
      return res.status(500).json({ valid: false, error: e.message || 'Token validation failed' });
    }
  });
}
