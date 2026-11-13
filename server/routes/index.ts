import express from 'express';
import upstoxRoutes from './upstox';
import { registerHealthRoutes } from './health';

export function registerRoutes(app: express.Application) {
  app.use('/api/market', upstoxRoutes);
  registerHealthRoutes(app);
}
