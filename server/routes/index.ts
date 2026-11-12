import express from 'express';
import upstoxRoutes from './upstox';
import { registerHealthRoutes } from './health';

export function registerRoutes(app: express.Application) {
  app.use('/api/market', upstoxRoutes);
  app.use('/api/bot', upstoxRoutes); // For now, upstoxRoutes might contain bot routes too
  registerHealthRoutes(app);
}
