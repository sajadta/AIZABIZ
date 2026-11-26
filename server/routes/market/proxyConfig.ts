// Outbound proxy configuration route: verifies the candidate proxy before adopting it.
import express from 'express';
import type { Request, Response } from 'express';
import { upstoxConfig } from '../../state';
import { savePostgresDb } from '../../services/persistence';
import { testProxyConnectivity, markProxyUnhealthy } from '../../services/upstoxTransport';
import { getLiveOutboundIp } from '../../services/tokenSync';

export function registerProxyConfigRoutes(app: express.Application) {
  app.post('/api/market/proxy-config', async (req: Request, res: Response) => {
    const { proxyUrl } = req.body;
    const targetProxy = typeof proxyUrl === 'string' ? proxyUrl.trim() : '';
    if (!targetProxy) {
      upstoxConfig.outboundProxyUrl = '';
      markProxyUnhealthy('Proxy removed by user');
      await savePostgresDb().catch(() => {
        /* ignore */
      });
      const fallbackIp = await getLiveOutboundIp();
      return res.json({
        success: true,
        message: 'Proxy removed. Reverted to direct IPv4 connection.',
        isFixedProxy: false,
        serverOutboundIp: fallbackIp.actualDetectedIp || fallbackIp.secondaryIp,
      });
    }

    const testRes = await testProxyConnectivity(targetProxy, 7500);
    if (testRes.online && testRes.detectedIp) {
      upstoxConfig.outboundProxyUrl = targetProxy;
      await savePostgresDb().catch(() => {
        /* ignore */
      });

      return res.json({
        success: true,
        message: `✅ Fixed IP Proxy connected! Outbound Static IP: ${testRes.detectedIp}`,
        serverOutboundIp: testRes.detectedIp,
        isFixedProxy: true,
        tcpOpen: true,
      });
    }

    const fallbackIp = await getLiveOutboundIp();
    const currentContainerIp = fallbackIp.actualDetectedIp || fallbackIp.secondaryIp;
    const isSocks = targetProxy.toLowerCase().startsWith('socks');
    const suggestedFix = testRes.tcpOpen
      ? isSocks
        ? 'Verify SOCKS5 proxy credentials (username/password) and IPv4 outbound access on 34.180.11.27:1080.'
        : 'Run in GCP SSH: sudo systemctl restart tinyproxy'
      : isSocks
        ? 'Ensure GCP Firewall allows TCP port 1080 (allow-socks5-1080) and dante/socks5 service is running.'
        : 'Ensure GCP Firewall allows TCP port 8888 and HTTP proxy service is running.';

    return res.status(400).json({
      success: false,
      tcpOpen: testRes.tcpOpen,
      containerIp: currentContainerIp,
      suggestedFix,
      error: `Proxy HTTPS test failed: ${testRes.error || 'Could not reach proxy'}. Direct IPv4 fallback stays active.`,
    });
  });
}
