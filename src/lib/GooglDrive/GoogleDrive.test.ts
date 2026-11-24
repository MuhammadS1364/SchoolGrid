import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_ANYONE_PERMISSION,
  buildPublicDriveShareUrl,
  buildDirectDriveViewUrl,
  isSafeHttpUrl,
  formatBytesLabel,
  checkSchoolDriveEligibility,
  createInitialDriveDocuments,
} from './GoogleDrive';

describe('GoogleDrive public link sharing helpers', () => {
  it('configures unrestricted "anyone with the link" viewer permission', () => {
    assert.deepEqual(PUBLIC_ANYONE_PERMISSION, {
      role: 'reader',
      type: 'anyone',
    });
  });

  it('builds public shareable and direct embed Drive URLs safely', () => {
    const shareUrl = buildPublicDriveShareUrl('abc_123-XYZ');
    assert.equal(shareUrl, 'https://drive.google.com/file/d/abc_123-XYZ/view?usp=sharing');

    const directUrl = buildDirectDriveViewUrl('abc_123-XYZ');
    assert.equal(directUrl, 'https://drive.google.com/uc?export=view&id=abc_123-XYZ');

    // URL-encodes unsafe characters
    const encoded = buildPublicDriveShareUrl('id with/chars');
    assert.ok(encoded.includes('id%20with%2Fchars'));
  });

  it('validates only safe http/https URLs and rejects javascript/data protocols', () => {
    assert.equal(isSafeHttpUrl('https://drive.google.com/file/d/123/view?usp=sharing'), true);
    assert.equal(isSafeHttpUrl('http://example.com/logo.png'), true);
    assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
    assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isSafeHttpUrl('not-a-url'), false);
  });

  it('formats file size labels cleanly', () => {
    assert.equal(formatBytesLabel(512), '512 B');
    assert.equal(formatBytesLabel(2048), '2 KB');
    assert.equal(formatBytesLabel(2 * 1024 * 1024), '2.00 MB');
  });

  it('enforces school Google Drive eligibility (feature toggle + Gmail)', () => {
    assert.equal(checkSchoolDriveEligibility(false, 'school@gmail.com').allowed, false);
    assert.equal(checkSchoolDriveEligibility(true, 'admin@school.edu').allowed, false);
    assert.equal(checkSchoolDriveEligibility(true, 'school@gmail.com').allowed, true);
  });

  it('seeds initial Drive documents with anyone_with_link access and valid public links', () => {
    const docs = createInitialDriveDocuments('school@gmail.com', 'school-1');
    assert.ok(docs.length >= 3);
    for (const doc of docs) {
      assert.equal(doc.accessMode, 'anyone_with_link');
      assert.equal(isSafeHttpUrl(doc.publicLink), true);
      assert.equal(isSafeHttpUrl(doc.directImageUrl), true);
      assert.equal(doc.linkedTable, 'school_drive_files');
    }
  });
});
