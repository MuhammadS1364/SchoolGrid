import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { getDbClient, getDbInfo } from './server/db/client';
import { runMigrations } from './server/db/migrations';
import { createApiRouter } from './server/routes/api';

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startServer() {
  const db = getDbClient();
  await runMigrations(db);
  const dbInfo = getDbInfo();

  const app = express();
  app.set('trust proxy', 1);

  // Baseline security headers (keep iframe compatibility for preview environment)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Mount Turso-backed API routes
  app.use('/api', createApiRouter(db));

  // Explicit 404 JSON for unknown /api/* paths
  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'API route not found.' },
    });
  });

  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(503).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[SchoolGrid] Server listening on http://0.0.0.0:${PORT} (DB: ${dbInfo.mode} -> ${dbInfo.urlMasked})`
    );
  });
}

startServer().catch((err) => {
  console.error('[SchoolGrid] Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
