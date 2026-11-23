import { createApiApp } from './_app.mjs';

let cachedApp = null;

export default function handler(req, res) {
  try {
    if (!cachedApp) {
      cachedApp = createApiApp();
    }
    return cachedApp(req, res);
  } catch (err) {
    console.error('Serverless initialization error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err?.message || 'Server initialization failed. Check server environment variables.',
      })
    );
  }
}
