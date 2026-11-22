import test from 'node:test';
import assert from 'node:assert/strict';
import { isMissingTableError } from './schoolDirectoryStore';
import { formatSupabaseError } from '../SupaBaseClient/SupaBaseClientFunction';

test('isMissingTableError detects PostgreSQL and PostgREST missing table errors', () => {
  assert.equal(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.SchoolTeachers'" }), true);
  assert.equal(isMissingTableError({ code: '42P01', message: 'relation "public.SchoolClasses" does not exist' }), true);
  assert.equal(isMissingTableError({ status: 404, message: 'Not Found' }), true);
  assert.equal(isMissingTableError({ code: '42501', message: 'new row violates row-level security policy' }), false);
  assert.equal(isMissingTableError(null), false);
});

test('formatSupabaseError extracts messages from Error and PostgREST plain objects', () => {
  assert.equal(formatSupabaseError(new Error('Invalid credentials'), 'Fallback'), 'Invalid credentials');
  assert.equal(
    formatSupabaseError(
      { code: '42501', message: 'new row violates row-level security policy', hint: 'Sign in as SuperAdmin' },
      'Fallback'
    ),
    'new row violates row-level security policy (Sign in as SuperAdmin)'
  );
  assert.equal(formatSupabaseError(null, 'Fallback message'), 'Fallback message');
});
