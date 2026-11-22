import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlanEndDate,
  computeTotalCharge,
  deriveEntitlementsFromFeatureList,
  parseCsvText,
  parseFeatureList,
  serializeRowsToCsv,
} from './planEntitlements';
import { checkSchoolDriveEligibility } from '../GooglDrive/GoogleDrive';

test('parseFeatureList splits comma and newline delimited features cleanly', () => {
  const items = parseFeatureList('Up to 15 Wings, Google Drive Integration\nEmail Service, ');
  assert.deepEqual(items, ['Up to 15 Wings', 'Google Drive Integration', 'Email Service']);
});

test('deriveEntitlementsFromFeatureList extracts boolean flags and wing limits', () => {
  const enterprise = deriveEntitlementsFromFeatureList(
    'Up to 30 Wings, Google Drive Integration, Import / Export CSV, Email Service, Collaboration Workspace'
  );
  assert.deepEqual(enterprise, {
    is_gdrive_allowed: true,
    is_import_export_allowed: true,
    allowed_count_wing: 30,
    is_email_service: true,
    is_collaburation_allowed: true,
  });

  const starter = deriveEntitlementsFromFeatureList('Up to 7 Wings, Student & Teacher CRUD');
  assert.deepEqual(starter, {
    is_gdrive_allowed: false,
    is_import_export_allowed: false,
    allowed_count_wing: 7,
    is_email_service: false,
    is_collaburation_allowed: false,
  });
});

test('computePlanEndDate and computeTotalCharge calculate billing duration accurately', () => {
  assert.equal(computePlanEndDate('2026-01-15', 'Monthly'), '2026-02-15');
  assert.equal(computePlanEndDate('2026-01-15', 'Quarterly'), '2026-04-15');
  assert.equal(computePlanEndDate('2026-01-15', 'Yearly'), '2027-01-15');

  assert.equal(computeTotalCharge(1000, 'Monthly'), 1000);
  assert.equal(computeTotalCharge(1000, 'Quarterly'), 2850);
  assert.equal(computeTotalCharge(1000, 'Yearly'), 10200);
});

test('CSV serialize and parse round-trip preserves rows and quoted values', () => {
  const csv = serializeRowsToCsv(
    ['full_name', 'class_name', 'wing'],
    [{ full_name: 'Aarav, Jr.', class_name: 'Grade 10 - A', wing: 'Senior Wing' }]
  );
  const parsed = parseCsvText(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].full_name, 'Aarav, Jr.');
  assert.equal(parsed[0].class_name, 'Grade 10 - A');
});

test('checkSchoolDriveEligibility requires both SuperAdmin flag and Gmail address', () => {
  assert.equal(checkSchoolDriveEligibility(false, 'school@gmail.com').allowed, false);
  assert.equal(checkSchoolDriveEligibility(true, 'school@custom.edu').allowed, false);
  assert.equal(checkSchoolDriveEligibility(true, 'school@gmail.com').allowed, true);
});
