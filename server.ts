import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.ts';
import listingsRoutes from './src/routes/listings.ts';
import tenantRoutes from './src/routes/tenant.ts';
import adminRoutes from './src/routes/admin.ts';
import { ensureSeeded } from './src/db/seed.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Lazy seed check on first API request
  app.use('/api', async (_req, _res, next) => {
    await ensureSeeded();
    next();
  });

  // Phase 1 REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/listings', listingsRoutes);
  app.use('/api/tenant', tenantRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'InzuFinder API' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InzuFinder server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
