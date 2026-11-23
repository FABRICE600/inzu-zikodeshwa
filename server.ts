import express from 'express';
import fs from 'fs';
import path from 'path';
import { createApiApp } from './src/app.ts';

async function startServer() {
  const app = createApiApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    app.get('/download/inzufinder.zip', (_req, res) => {
      const zipPath = '/tmp/inzufinder.zip';
      if (!fs.existsSync(zipPath)) {
        res.status(404).json({ error: 'Project archive not found' });
        return;
      }
      res.download(zipPath, 'inzufinder.zip');
    });

    app.get('/download/inzufinder-database.sql', (_req, res) => {
      const sqlPath = '/tmp/inzufinder-full-database.sql';
      if (!fs.existsSync(sqlPath)) {
        res.status(404).json({ error: 'Database dump not found' });
        return;
      }
      res.download(sqlPath, 'inzufinder-full-database.sql');
    });

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
