import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createDbClient } from './db/client';
import { runMigrations } from './db/migrations';
import { createApiRouter } from './routes/api';
import type { TokenVerifier, VerifiedIdentity } from './middleware/auth';
import { hashInviteToken } from './services/invitations';
import { validateSchoolSlug } from './services/schoolProvisioning';

interface TestHarness {
  baseUrl: string;
  close: () => Promise<void>;
  db: ReturnType<typeof createDbClient>['client'];
}

async function createTestServer(identities: Record<string, VerifiedIdentity>): Promise<TestHarness> {
  const { client } = createDbClient({ url: ':memory:' });
  await runMigrations(client, { seedDemoSchool: true });

  const verifier: TokenVerifier = async (token) => identities[token] ?? null;

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(client, { tokenVerifier: verifier, disableRateLimit: true }));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    db: client,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      client.close();
    },
  };
}

async function reqJson(
  baseUrl: string,
  method: string,
  pathname: string,
  options?: { token?: string; body?: unknown }
) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = (await res.json()) as { success: boolean; data?: any; error?: { code: string; message: string } };
  return { status: res.status, json };
}

test('validateSchoolSlug rejects reserved slugs and invalid syntax', () => {
  assert.equal(validateSchoolSlug('admin').valid, false);
  assert.equal(validateSchoolSlug('api').valid, false);
  assert.equal(validateSchoolSlug('ab').valid, false);
  const valid = validateSchoolSlug('St. Xavier High!');
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.equal(valid.slug, 'st-xavier-high');
  }
});

test('migrations are idempotent and enforce PRAGMA foreign_keys = ON with composite tenant FKs', async () => {
  const { client } = createDbClient({ url: ':memory:' });
  await runMigrations(client, { seedDemoSchool: true });
  // Running twice must succeed cleanly
  await runMigrations(client, { seedDemoSchool: true });

  const fkStatus = await client.execute('PRAGMA foreign_keys');
  assert.equal(Number(fkStatus.rows[0]?.foreign_keys), 1);

  // Create second school and try to link a School A wing into a School B programme -> MUST FAIL via composite FK
  await client.execute({
    sql: `INSERT INTO schools (id, name, slug, status) VALUES ('sch_b', 'School B', 'school-b', 'active')`,
  });

  await assert.rejects(
    async () => {
      await client.execute({
        sql: `INSERT INTO programmes (id, school_id, wing_id, title, slug)
              VALUES ('prg_bad', 'sch_b', 'wng_stem_001', 'Cross Tenant Bug', 'cross-tenant-bug')`,
      });
    },
    /FOREIGN KEY constraint failed/i
  );

  client.close();
});

test('public school website exposes ONLY active schools and published+public items (no drafts)', async () => {
  const harness = await createTestServer({});
  try {
    const listRes = await reqJson(harness.baseUrl, 'GET', '/api/public/schools');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json.success, true);
    assert.equal(listRes.json.data.length, 1);
    assert.equal(listRes.json.data[0].slug, 'greenwood-academy');

    const detailRes = await reqJson(harness.baseUrl, 'GET', '/api/public/schools/greenwood-academy');
    assert.equal(detailRes.status, 200);
    const titles = detailRes.json.data.programmes.map((p: any) => p.title);
    assert.ok(titles.includes('Annual Inter-School Robotics Expo 2026'));
    assert.equal(
      titles.some((t: string) => t.includes('Draft')),
      false,
      'Draft school_only programme must NEVER appear on public school site'
    );
  } finally {
    await harness.close();
  }
});

test('full multi-tenant lifecycle: onboarding approval, hashed single-use invite, tenant isolation, and RBAC', async () => {
  const harness = await createTestServer({
    superadmin_tok: {
      supabaseAuthId: 'sb-super-1',
      email: 'owner@schoolgrid.app',
      fullName: 'Platform Owner',
    },
    school_a_admin_tok: {
      supabaseAuthId: 'sb-admin-a',
      email: 'principal@oakridge.edu',
      fullName: 'Oakridge Principal',
    },
    school_b_admin_tok: {
      supabaseAuthId: 'sb-admin-b',
      email: 'principal@maplewood.edu',
      fullName: 'Maplewood Principal',
    },
    student_a_tok: {
      supabaseAuthId: 'sb-student-a',
      email: 'student1@oakridge.edu',
      fullName: 'Aarav Student',
    },
  });

  try {
    // 1. Unauthenticated access to platform route MUST return 401
    const unauth = await reqJson(harness.baseUrl, 'GET', '/api/platform/schools');
    assert.equal(unauth.status, 401);

    // 2. First synced user bootstraps as super_admin
    const syncSuper = await reqJson(harness.baseUrl, 'POST', '/api/auth/sync', { token: 'superadmin_tok' });
    assert.equal(syncSuper.status, 200);
    assert.ok(syncSuper.json.data.user.platformRoles.includes('super_admin'));

    // 3. Public submits school registration request (Oakridge)
    const regRes = await reqJson(harness.baseUrl, 'POST', '/api/public/school-registration', {
      body: {
        schoolName: 'Oakridge Public School',
        requestedSlug: 'oakridge-public',
        contactName: 'Dr. Kavita Rao',
        contactEmail: 'principal@oakridge.edu',
        city: 'Jaipur',
        state: 'Rajasthan',
      },
    });
    assert.equal(regRes.status, 201);
    const onboardingId = regRes.json.data.id;

    // 4. SuperAdmin approves onboarding request -> transactional provisioning returns one-time invite token
    const approveRes = await reqJson(
      harness.baseUrl,
      'POST',
      `/api/platform/onboarding/${onboardingId}/approve`,
      { token: 'superadmin_tok' }
    );
    assert.equal(approveRes.status, 200);
    const schoolAId = approveRes.json.data.school.id;
    const oakridgeAdminToken = approveRes.json.data.initialInvitation.rawToken;
    assert.ok(oakridgeAdminToken.length >= 32);

    // Verify raw token is NOT stored in DB, only SHA-256 hash
    const invRows = await harness.db.execute({
      sql: 'SELECT token_hash FROM school_invitations WHERE id = ?',
      args: [approveRes.json.data.initialInvitation.invitationId],
    });
    assert.equal(String(invRows.rows[0].token_hash), hashInviteToken(oakridgeAdminToken));
    assert.notEqual(String(invRows.rows[0].token_hash), oakridgeAdminToken);

    // 5. SuperAdmin provisions School B (Maplewood) directly using the same transactional service
    const provB = await reqJson(harness.baseUrl, 'POST', '/api/platform/schools', {
      token: 'superadmin_tok',
      body: {
        name: 'Maplewood Academy',
        slug: 'maplewood-academy',
        contactEmail: 'principal@maplewood.edu',
        city: 'Lucknow',
      },
    });
    assert.equal(provB.status, 201);
    const schoolBId = provB.json.data.school.id;
    const maplewoodAdminToken = provB.json.data.initialInvitation.rawToken;

    // Duplicate slug MUST fail with 409
    const dupSlug = await reqJson(harness.baseUrl, 'POST', '/api/platform/schools', {
      token: 'superadmin_tok',
      body: {
        name: 'Duplicate Maplewood',
        slug: 'maplewood-academy',
        contactEmail: 'dup@maplewood.edu',
      },
    });
    assert.equal(dupSlug.status, 409);

    // 6. Wrong email cannot accept Oakridge invitation
    const wrongEmailAccept = await reqJson(harness.baseUrl, 'POST', '/api/invitations/accept', {
      token: 'school_b_admin_tok',
      body: { token: oakridgeAdminToken },
    });
    assert.equal(wrongEmailAccept.status, 400);

    // 7. Correct email accepts Oakridge invitation (single-use)
    const acceptA = await reqJson(harness.baseUrl, 'POST', '/api/invitations/accept', {
      token: 'school_a_admin_tok',
      body: { token: oakridgeAdminToken },
    });
    assert.equal(acceptA.status, 200);
    assert.equal(acceptA.json.data.schoolId, schoolAId);

    // Reusing the same token MUST fail
    const replayA = await reqJson(harness.baseUrl, 'POST', '/api/invitations/accept', {
      token: 'school_a_admin_tok',
      body: { token: oakridgeAdminToken },
    });
    assert.equal(replayA.status, 400);

    // School B admin accepts Maplewood invite
    const acceptB = await reqJson(harness.baseUrl, 'POST', '/api/invitations/accept', {
      token: 'school_b_admin_tok',
      body: { token: maplewoodAdminToken },
    });
    assert.equal(acceptB.status, 200);

    // 8. School A admin creates a student + wing + programme in School A
    const createStudentA = await reqJson(harness.baseUrl, 'POST', `/api/school/${schoolAId}/students`, {
      token: 'school_a_admin_tok',
      body: { admissionNo: 'OAK-001', firstName: 'Rohan', lastName: 'Verma' },
    });
    assert.equal(createStudentA.status, 201);

    // 9. TENANT ISOLATION: School B admin attempting to read or mutate School A MUST get 404
    const crossRead = await reqJson(harness.baseUrl, 'GET', `/api/school/${schoolAId}/students`, {
      token: 'school_b_admin_tok',
    });
    assert.equal(crossRead.status, 404);

    const crossWrite = await reqJson(harness.baseUrl, 'POST', `/api/school/${schoolAId}/wings`, {
      token: 'school_b_admin_tok',
      body: { name: 'Injected Wing', wingType: 'club' },
    });
    assert.equal(crossWrite.status, 404);

    // School A admin cannot access platform SuperAdmin endpoints -> 403
    const escalRes = await reqJson(harness.baseUrl, 'GET', '/api/platform/schools', {
      token: 'school_a_admin_tok',
    });
    assert.equal(escalRes.status, 403);

    // 10. RBAC inside School A: Invite a student, accept, verify student CANNOT create wings or read all students (403)
    const inviteStudent = await reqJson(harness.baseUrl, 'POST', `/api/school/${schoolAId}/invitations`, {
      token: 'school_a_admin_tok',
      body: { email: 'student1@oakridge.edu', roleCode: 'student' },
    });
    assert.equal(inviteStudent.status, 201);

    const acceptStu = await reqJson(harness.baseUrl, 'POST', '/api/invitations/accept', {
      token: 'student_a_tok',
      body: { token: inviteStudent.json.data.rawToken },
    });
    assert.equal(acceptStu.status, 200);

    const studentReadProfile = await reqJson(harness.baseUrl, 'GET', `/api/school/${schoolAId}/profile`, {
      token: 'student_a_tok',
    });
    assert.equal(studentReadProfile.status, 200);

    const studentCreateWing = await reqJson(harness.baseUrl, 'POST', `/api/school/${schoolAId}/wings`, {
      token: 'student_a_tok',
      body: { name: 'Unauthorized Wing', wingType: 'sports' },
    });
    assert.equal(studentCreateWing.status, 403);

    // 11. Audit logs & outbox events were recorded
    const auditRes = await reqJson(harness.baseUrl, 'GET', '/api/platform/audit-logs', {
      token: 'superadmin_tok',
    });
    assert.equal(auditRes.status, 200);
    const actions = auditRes.json.data.map((a: any) => a.action);
    assert.ok(actions.includes('onboarding.submitted'));
    assert.ok(actions.includes('onboarding.approved_and_provisioned'));
    assert.ok(actions.includes('invitation.accepted'));

    const outboxRes = await reqJson(harness.baseUrl, 'GET', '/api/platform/outbox', {
      token: 'superadmin_tok',
    });
    assert.equal(outboxRes.status, 200);
    assert.ok(outboxRes.json.data.length >= 3);
  } finally {
    await harness.close();
  }
});
