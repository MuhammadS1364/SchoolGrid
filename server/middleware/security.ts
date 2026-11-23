import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://ms-school-grid.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  const envUrls = [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS || '').split(',')];
  for (const raw of envUrls) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // Ignore malformed origin entries
    }
  }
  return origins;
}

export function isAllowedOrigin(origin: string, reqHost?: string): boolean {
  try {
    const parsed = new URL(origin);
    if (reqHost && parsed.host === reqHost) {
      return true;
    }
    if (getAllowedOrigins().has(parsed.origin)) {
      return true;
    }
    // Allow AI Studio Cloud Run preview origins when hosted on run.app
    if (parsed.protocol === 'https:' && /^ais-(dev|pre)-[a-z0-9-]+\.run\.app$/i.test(parsed.hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Strict CORS allowlist middleware (never wildcard '*' with credentials).
 */
export function strictCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const reqHost = req.headers.host;

  if (origin) {
    if (!isAllowedOrigin(origin, reqHost)) {
      res.status(403).json({
        success: false,
        error: { code: 'CORS_ORIGIN_DENIED', message: 'Origin is not permitted.' },
      });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Idempotency-Key');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

/**
 * CSRF protection for state-changing API requests using strict Origin / Referer verification.
 */
export function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const reqHost = req.headers.host;

  if (origin && !isAllowedOrigin(origin, reqHost)) {
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_ORIGIN_MISMATCH', message: 'Cross-site request blocked.' },
    });
    return;
  }

  if (!origin && referer && !isAllowedOrigin(referer, reqHost)) {
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_REFERER_MISMATCH', message: 'Cross-site referer blocked.' },
    });
    return;
  }

  next();
}

/**
 * Baseline security headers including XSS protection and strict MIME sniffing defense.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://accounts.google.com',
    ...(process.env.NODE_ENV !== 'production' ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : []),
  ].join(' ');

  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      `connect-src ${connectSrc}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// =========================================================
// SSRF Protection: Reject private, loopback, link-local & metadata hosts
// =========================================================
const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
];

export function validateSafeExternalUrl(rawUrl: string): { valid: true; url: string } | { valid: false; reason: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: false, reason: 'URL cannot be empty.' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Only http:// and https:// URLs are allowed.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:') ||
    PRIVATE_IPV4_PATTERNS.some((re) => re.test(host))
  ) {
    return { valid: false, reason: 'Private, loopback, or internal network addresses are blocked.' };
  }

  return { valid: true, url: parsed.toString() };
}

// =========================================================
// Strict File Upload Metadata Validation
// =========================================================
export const ALLOWED_UPLOAD_MIMES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateFileUploadMetadata(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): { valid: true; safeFileName: string } | { valid: false; reason: string } {
  const rawName = (input.fileName || '').trim();
  if (!rawName || rawName.length > 180) {
    return { valid: false, reason: 'File name must be between 1 and 180 characters.' };
  }
  if (rawName.includes('\0') || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
    return { valid: false, reason: 'File name contains forbidden path characters.' };
  }

  const mime = (input.mimeType || '').trim().toLowerCase();
  const allowedExts = ALLOWED_UPLOAD_MIMES[mime];
  if (!allowedExts) {
    return { valid: false, reason: `Unsupported file type "${mime}". Allowed: PDF, PNG, JPG, WebP, CSV, DOCX, XLSX.` };
  }

  const lower = rawName.toLowerCase();
  if (!allowedExts.some((ext) => lower.endsWith(ext))) {
    return { valid: false, reason: `File extension does not match MIME type "${mime}".` };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return { valid: false, reason: 'File size must be between 1 byte and 10 MB.' };
  }

  const safeFileName = rawName.replace(/[^a-zA-Z0-9._ -]/g, '_');
  return { valid: true, safeFileName };
}

// =========================================================
// Timing-Safe HMAC-SHA256 Webhook Signature Verification
// =========================================================
export function signWebhookPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyWebhookSignature(rawBody: string, signatureHex: string, secret: string): boolean {
  if (!rawBody || !signatureHex || !secret) return false;
  const cleanSig = signatureHex.replace(/^sha256=/i, '').trim();
  if (!/^[a-f0-9]{64}$/i.test(cleanSig)) return false;

  const expected = signWebhookPayload(rawBody, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(cleanSig, 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
