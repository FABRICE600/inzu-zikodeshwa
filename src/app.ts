import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { sql } from 'drizzle-orm';
import authRoutes from './routes/auth.ts';
import listingsRoutes from './routes/listings.ts';
import tenantRoutes from './routes/tenant.ts';
import adminRoutes from './routes/admin.ts';
import { db, isDatabaseConfigured } from './db/index.ts';
import { ensureSeeded } from './db/seed.ts';
import { getUploadsDir } from './lib/uploads.ts';

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

  // Health endpoint before DB middleware so platform checks stay fast
  app.get('/api/health', async (req, res) => {
    const dbConfigured = isDatabaseConfigured();
    if (req.query.db !== '1') {
      return res.json({ status: 'ok', service: 'InzuFinder API', dbConfigured });
    }
    if (!dbConfigured) {
      return res.status(503).json({
        status: 'degraded',
        service: 'InzuFinder API',
        dbConfigured: false,
        error: 'Database environment variables are not configured.',
      });
    }
    try {
      await db.execute(sql`SELECT 1`);
      return res.json({ status: 'ok', service: 'InzuFinder API', dbConfigured: true, dbConnected: true });
    } catch (err: any) {
      return res.status(503).json({
        status: 'degraded',
        service: 'InzuFinder API',
        dbConfigured: true,
        dbConnected: false,
        error: err?.message || 'Database connection failed.',
      });
    }
  });

  // Fail fast with clear JSON if database environment variables are missing
  app.use('/api', (_req, res, next) => {
    if (!isDatabaseConfigured()) {
      return res.status(503).json({
        error:
          'Database is not configured on this server. Add DATABASE_URL (or SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME) in Vercel Project Settings → Environment Variables.',
      });
    }
    next();
  });

  // Lazy schema & seed check on first API request
  app.use('/api', async (_req, _res, next) => {
    try {
      await ensureSeeded();
      next();
    } catch (err) {
      next(err);
    }
  });

  // REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/listings', listingsRoutes);
  app.use('/api/tenant', tenantRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // Ensure API errors always return structured JSON rather than HTML
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api')) {
      return next(err);
    }
    console.error('Unhandled API error:', err);
    if (!res.headersSent) {
      const status = Number(err?.status) >= 400 && Number(err?.status) < 600 ? Number(err.status) : 500;
      res.status(status).json({ error: err?.message || 'Internal server error.' });
    }
  });

  return app;
}
