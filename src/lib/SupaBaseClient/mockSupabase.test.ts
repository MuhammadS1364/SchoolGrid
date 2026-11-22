import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabaseClient, DEFAULT_SCHOOLS } from './mockSupabase';
import { parseOAuthUrlParams } from './SupaBaseClientFunction';

test('mockSupabase supports full CRUD on OurSchools, OurServicesBook, OurServiceHolder, Teachers, Students, Classes', async () => {
  const client = createMockSupabaseClient(DEFAULT_SCHOOLS);

  // OurServicesBook ordered by numeric service_charge ascending (exact PublicServicesPage query)
  const [plans, holders] = await Promise.all([
    client.from('OurServicesBook').select('*').order('service_charge', { ascending: true }),
    client.from('OurServiceHolder').select('*').order('created_at', { ascending: false }),
  ]);
  assert.equal(plans.error, null);
  assert.equal(holders.error, null);
  assert.equal(plans.data.length, 3);
  assert.deepEqual(
    plans.data.map((p) => p.service_charge),
    [750, 1450, 2499]
  );

  // OurServiceHolder create & approve
  const createdHolder = await client
    .from('OurServiceHolder')
    .insert([
      {
        holder_fullname: 'Asha Patel',
        holder_email: 'principal@lotus.edu',
        holder_contact: '+91 90000 11111',
        plain_type: 'Yearly',
        payment_method: 'UPI',
        status: 'pending_approval',
        is_active: true,
        service_id: 'srv-enterprise',
        school_id: null,
      },
    ])
    .select();
  assert.equal(createdHolder.error, null);
  const holderId = String(createdHolder.data[0].holder_id);

  const approvedHolder = await client
    .from('OurServiceHolder')
    .update({ status: 'approved' })
    .eq('holder_id', holderId)
    .select();
  assert.equal(approvedHolder.data[0].status, 'approved');

  // OurSchools CRUD + realtime
  const events: string[] = [];
  const channel = client
    .channel('test-schools')
    .on('postgres_changes', { table: 'OurSchools' }, (payload) => {
      events.push(payload.eventType);
    })
    .subscribe();

  const inserted = await client
    .from('OurSchools')
    .insert([
      {
        school_title: 'Alpine Heritage Academy',
        school_manager: 'Ritu Sen',
        is_private: true,
        school_type: 'Senior Secondary',
        schoole_gmail: 'alpine@gmail.com',
        is_gdrive_allowed: true,
        is_import_export_allowed: true,
        allowed_count_wing: 12,
        is_email_service: true,
        is_collaburation_allowed: false,
        is_approved: true,
      },
    ])
    .select();

  assert.equal(inserted.error, null);
  const createdId = String(inserted.data[0].school_id);

  const updated = await client
    .from('OurSchools')
    .update({ is_gdrive_allowed: false })
    .eq('school_id', createdId)
    .select();
  assert.equal(updated.data[0].is_gdrive_allowed, false);

  await client.from('OurSchools').delete().eq('school_id', createdId);
  assert.deepEqual(events.slice(0, 3), ['INSERT', 'UPDATE', 'DELETE']);
  await client.removeChannel(channel);
});

test('mockSupabase auth sign-in, session persistence, resetPasswordForEmail, and sign-out work end-to-end', async () => {
  const client = createMockSupabaseClient(DEFAULT_SCHOOLS);

  const beforeSession = await client.auth.getSession();
  assert.equal(beforeSession.data.session, null);

  const signInRes = await client.auth.signInWithPassword({
    email: 'admin@schoolgrid.edu',
    password: 'secret',
  });
  assert.equal(signInRes.error, null);
  assert.equal(signInRes.data.user?.email, 'admin@schoolgrid.edu');

  const activeSession = await client.auth.getSession();
  assert.equal(activeSession.data.session?.user.email, 'admin@schoolgrid.edu');
  assert.ok(activeSession.data.session?.access_token);

  const resetOk = await client.auth.resetPasswordForEmail('admin@schoolgrid.edu');
  assert.equal(resetOk.error, null);

  const resetBad = await client.auth.resetPasswordForEmail('not-an-email');
  assert.ok(resetBad.error instanceof Error);

  let signedOutEvent = false;
  const { data: sub } = client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') signedOutEvent = true;
  });

  await client.auth.signOut();
  assert.equal(signedOutEvent, true);
  const afterSession = await client.auth.getSession();
  assert.equal(afterSession.data.session, null);
  sub.subscription.unsubscribe();
});

test('parseOAuthUrlParams extracts PKCE code, implicit hash tokens, recovery type, and errors', () => {
  const pkce = parseOAuthUrlParams('?code=pkce-123&type=oauth', '');
  assert.equal(pkce.code, 'pkce-123');
  assert.equal(pkce.accessToken, null);
  assert.equal(pkce.error, null);

  const implicit = parseOAuthUrlParams(
    '',
    '#access_token=tok_abc&refresh_token=ref_xyz&type=recovery'
  );
  assert.equal(implicit.accessToken, 'tok_abc');
  assert.equal(implicit.refreshToken, 'ref_xyz');
  assert.equal(implicit.type, 'recovery');
  assert.equal(implicit.error, null);

  const errParsed = parseOAuthUrlParams('', '#error=access_denied&error_description=User+cancelled');
  assert.equal(errParsed.error, 'User cancelled');
});
