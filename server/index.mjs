/**
 * Servidor único: Vite (dev) o estático dist (prod) + API /api/*
 */
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createApp } from './app.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  const app = createApp();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root,
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(root, 'dist');
    app.use(
      express.static(dist, {
        maxAge: '1d',
        index: false,
        etag: true,
        lastModified: true,
        fallthrough: true
      })
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(dist, 'index.html'), err => {
        if (err) next(err);
      });
    });
  }

  const server = http.createServer(app);
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => {
    console.log(`[center-gym] ${isProd ? 'producción' : 'desarrollo'} → http://localhost:${port}`);
  });
}

createServer().catch(err => {
  console.error(err);
  process.exit(1);
});
