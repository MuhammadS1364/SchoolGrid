import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { getDbClient, getDbInfo } from './server/db/client';
import { runMigrations } from './server/db/migrations';
import { createApiRouter } from './server/routes/api';
import { createRateLimiter } from './server/middleware/auth';
import {
  csrfOriginGuard,
  securityHeadersMiddleware,
  strictCorsMiddleware,
} from './server/middleware/security';

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CANONICAL_BASE_URL = (process.env.PUBLIC_SITE_URL || 'https://ms-school-grid.vercel.app').replace(/\/+$/, '');

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function startServer() {
  const db = getDbClient();
  await runMigrations(db);
  const dbInfo = getDbInfo();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers (CSP, nosniff, Referrer-Policy, Permissions-Policy, HSTS)
  app.use(securityHeadersMiddleware);

  // Strict CORS allowlist & CSRF origin validation on API routes
  app.use('/api', strictCorsMiddleware);
  app.use('/api', csrfOriginGuard);
  app.use('/api', createRateLimiter({ windowMs: 60_000, maxRequests: 120 }));

  app.use(express.json({ limit: '1mb' }));

  // Dynamic XML Sitemap combining static public routes + active Turso school portals
  app.get('/sitemap.xml', async (_req: Request, res: Response) => {
    try {
      const activeSchools = await db.execute(
        `SELECT s.slug, s.updated_at
         FROM schools s
         LEFT JOIN school_settings ss ON ss.school_id = s.id
         WHERE s.status = 'active' AND s.deleted_at IS NULL AND COALESCE(ss.public_site_enabled, 1) = 1
         ORDER BY s.name ASC`
      );

      const today = new Date().toISOString().slice(0, 10);
      const staticUrls = [
        { loc: `${CANONICAL_BASE_URL}/`, changefreq: 'weekly', priority: '1.0', lastmod: today },
        { loc: `${CANONICAL_BASE_URL}/schools`, changefreq: 'daily', priority: '0.9', lastmod: today },
        { loc: `${CANONICAL_BASE_URL}/services`, changefreq: 'weekly', priority: '0.9', lastmod: today },
        { loc: `${CANONICAL_BASE_URL}/register-school`, changefreq: 'monthly', priority: '0.8', lastmod: today },
        { loc: `${CANONICAL_BASE_URL}/privacy`, changefreq: 'yearly', priority: '0.4', lastmod: today },
        { loc: `${CANONICAL_BASE_URL}/terms`, changefreq: 'yearly', priority: '0.4', lastmod: today },
      ];

      const schoolUrls = activeSchools.rows.map((row) => ({
        loc: `${CANONICAL_BASE_URL}/s/${encodeURIComponent(String(row.slug))}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: String(row.updated_at || today).slice(0, 10),
      }));

      const entries = [...staticUrls, ...schoolUrls]
        .map(
          (u) =>
            `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
        )
        .join('\n');

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
      );
    } catch {
      res.status(500).type('text/plain').send('Failed to generate sitemap.');
    }
  });

  // Mount Turso-backed API routes
  app.use('/api', createApiRouter(db));

  // Explicit 404 JSON for unknown /api/* paths
  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'API route not found.' },
    });
  });

  // Centralized error handler — never leak internal stack traces or secrets
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
    const isSyntaxErr = err instanceof SyntaxError && status === 400;
    res.status(status).json({
      success: false,
      error: {
        code: isSyntaxErr ? 'INVALID_JSON' : 'INTERNAL_ERROR',
        message: isSyntaxErr ? 'Malformed JSON request body.' : 'An unexpected server error occurred.',
      },
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
  console.error('[SchoolGrid] Fatal startup error:', err instanceof Error ? err.message : 'Startup failure');
  process.exit(1);
});
