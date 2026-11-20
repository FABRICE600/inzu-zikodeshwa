import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.ts';
import listingsRoutes from './routes/listings.ts';
import tenantRoutes from './routes/tenant.ts';
import adminRoutes from './routes/admin.ts';
import { ensureSeeded } from './db/seed.ts';
import { getUploadsDir } from './lib/uploads.ts';

dotenv.config();

export function createApiApp() {
  const app = express();

  // Security headers (relaxed CSP for OpenStreetMap tiles, fonts, and Vite dev client)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded property & avatar images
  app.use('/uploads', express.static(getUploadsDir()));

  // Lazy seed check on first API request
  app.use('/api', async (_req, _res, next) => {
    await ensureSeeded();
    next();
  });

  // REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/listings', listingsRoutes);
  app.use('/api/tenant', tenantRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'InzuFinder API' });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  return app;
}
