import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedOrigin,
  signWebhookPayload,
  validateFileUploadMetadata,
  validateSafeExternalUrl,
  verifyWebhookSignature,
} from './security';

test('CORS origin allowlist permits official production, localhost, and Cloud Run origins while rejecting untrusted origins', () => {
  assert.equal(isAllowedOrigin('https://ms-school-grid.vercel.app'), true);
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedOrigin('https://ais-dev-abc123.run.app'), true);
  assert.equal(isAllowedOrigin('https://ais-pre-xyz987.run.app'), true);
  assert.equal(isAllowedOrigin('https://evil.example.com'), false);
  assert.equal(isAllowedOrigin('javascript:alert(1)'), false);
  assert.equal(isAllowedOrigin('https://custom-host.test', 'custom-host.test'), true);
});

test('SSRF protection allows public http/https URLs and blocks loopback, private, metadata, and non-HTTP schemes', () => {
  const ok = validateSafeExternalUrl('https://greenwood.edu/admissions');
  assert.equal(ok.valid, true);

  const blockedInputs = [
    'http://127.0.0.1/admin',
    'http://localhost:3000/api/health',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/internal',
    'http://192.168.1.10/router',
    'http://172.16.0.1/private',
    'http://[::1]/secret',
    'http://metadata.internal/token',
    'javascript:alert(1)',
    'file:///etc/passwd',
    '',
  ];

  for (const url of blockedInputs) {
    const res = validateSafeExternalUrl(url);
    assert.equal(res.valid, false, `Expected "${url}" to be rejected`);
  }
});

test('File upload validation allows safe documents/images and rejects path traversal, SVG/EXE, MIME mismatches, and oversized files', () => {
  const okPdf = validateFileUploadMetadata({
    fileName: 'Admission Form 2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 256_000,
  });
  assert.equal(okPdf.valid, true);

  const okPng = validateFileUploadMetadata({
    fileName: 'school-crest.png',
    mimeType: 'image/png',
    sizeBytes: 120_000,
  });
  assert.equal(okPng.valid, true);

  assert.equal(
    validateFileUploadMetadata({
      fileName: '../secret.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }).valid,
    false
  );

  assert.equal(
    validateFileUploadMetadata({
      fileName: 'xss.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 500,
    }).valid,
    false
  );

  assert.equal(
    validateFileUploadMetadata({
      fileName: 'payload.exe',
      mimeType: 'application/octet-stream',
      sizeBytes: 500,
    }).valid,
    false
  );

  assert.equal(
    validateFileUploadMetadata({
      fileName: 'fake.png',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }).valid,
    false
  );

  assert.equal(
    validateFileUploadMetadata({
      fileName: 'huge.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 15 * 1024 * 1024,
    }).valid,
    false
  );
});

test('HMAC-SHA256 webhook signature verification validates authentic payloads and rejects tampered data', () => {
  const secret = 'test_webhook_secret_key_987654';
  const payload = JSON.stringify({ event: 'school.approved', schoolId: 'sch_123' });
  const sig = signWebhookPayload(payload, secret);

  assert.equal(verifyWebhookSignature(payload, sig, secret), true);
  assert.equal(verifyWebhookSignature(payload, `sha256=${sig}`, secret), true);
  assert.equal(verifyWebhookSignature(`${payload} `, sig, secret), false);
  assert.equal(verifyWebhookSignature(payload, sig, 'wrong_secret'), false);
  assert.equal(verifyWebhookSignature(payload, 'not-hex', secret), false);
});
