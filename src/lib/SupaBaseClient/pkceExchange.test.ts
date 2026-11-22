import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exchangeAuthCodeOnce } from './SupaBaseClientFunction';

test('exchangeAuthCodeOnce deduplicates concurrent and repeated PKCE exchanges for the same code', async () => {
  let exchangeCalls = 0;

  const fakeSupabase = {
    auth: {
      async getSession() {
        return { data: { session: null } };
      },
      async exchangeCodeForSession(code: string) {
        exchangeCalls += 1;
        await new Promise((r) => setTimeout(r, 15));
        if (exchangeCalls > 1) {
          return { error: new Error(`PKCE code verifier not found in storage for ${code}`) };
        }
        return { error: null };
      },
    },
  } as unknown as SupabaseClient;

  // Simulate React StrictMode double-mount calling exchange concurrently with the same OAuth ?code=
  const [res1, res2] = await Promise.all([
    exchangeAuthCodeOnce(fakeSupabase, 'oauth-pkce-code-123'),
    exchangeAuthCodeOnce(fakeSupabase, 'oauth-pkce-code-123'),
  ]);

  assert.equal(res1.error, null);
  assert.equal(res2.error, null);
  assert.equal(exchangeCalls, 1);

  // Subsequent re-render with the already-completed code must also skip re-exchange
  const res3 = await exchangeAuthCodeOnce(fakeSupabase, 'oauth-pkce-code-123');
  assert.equal(res3.error, null);
  assert.equal(exchangeCalls, 1);
});
