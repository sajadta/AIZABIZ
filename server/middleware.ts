// Shared Express middleware: CORS, static-file security firewall, client-token
// adoption for API routes, and the API error handler.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, invalidTokens } from "./state";
import { isJwtTokenActuallyExpired, saveTokenBackupToDisk } from "./lib/tokens";
import { savePostgresDb } from "./services/persistence";

export function applyCorsMiddleware(app: express.Application) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
}

// Blocks direct HTTP access to server-side TypeScript sources. Client bundles are
// served from /src by the Vite dev middleware, so only top-level server paths match.
function isServerSourceRequest(cleanPath: string): boolean {
  if (!cleanPath.endsWith('.ts') && !cleanPath.endsWith('.tsx')) return false;
  return cleanPath.startsWith('/server') || cleanPath.includes('/server/');
}

// Strictly block any direct HTTP access to dotfiles, state databases, tokens, or server files
export function applySecurityFirewall(app: express.Application) {
  app.use((req, res, next) => {
    const cleanPath = req.path.toLowerCase();
    // Allow PWA .well-known assetlinks
    if (cleanPath.startsWith('/.well-known/')) {
      return next();
    }
    if (
      cleanPath.startsWith('/.') ||
      cleanPath.includes('.upstox') ||
      cleanPath.includes('.json') && !cleanPath.startsWith('/api') && !cleanPath.includes('manifest') ||
      isServerSourceRequest(cleanPath) ||
      cleanPath.includes('render.yaml')
    ) {
      return res.status(403).json({ error: "Access Denied: Protected Security Resource" });
    }
    next();
  });
}

export function applyApiTokenAdoption(app: express.Application) {
  app.use(["/api/market", "/api/instrument", "/api/trading", "/api/bot"], (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (
        token &&
        token.length > 30 &&
        !invalidTokens.has(token) &&
        !isJwtTokenActuallyExpired(token)
      ) {
        // Logic Fix: Only adopt token from client if server's current token is missing or expired.
        // This prevents stale localStorage tokens from overwriting a fresh server-synced token.
        const currentToken = upstoxConfig.accessToken;
        if (!currentToken || isJwtTokenActuallyExpired(currentToken) || invalidTokens.has(currentToken)) {
          if (currentToken !== token) {
            upstoxConfig.accessToken = token;
            saveTokenBackupToDisk(token);
            savePostgresDb().catch(() => { /* ignore */ });
          }
        }
      }
    }
    next();
  });
}

export function applyApiErrorHandler(app: express.Application) {
  app.use((err: any, req: Request, res: Response, next: any) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error("[API Error]", err?.message || err);
    res.status(500).json({
      success: false,
      error: err?.message || "Internal Server Error",
    });
  });
}
