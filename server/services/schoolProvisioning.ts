import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { withTransaction } from '../db/client';
import { DEFAULT_SCHOOL_ROLE_BUNDLES } from '../db/migrations';
import { enqueueOutboxEvent, writeAuditLog } from './audit';
import { createInvitationInExecutor } from './invitations';

export const RESERVED_SLUGS = new Set([
  'www',
  'admin',
  'superadmin',
  'super-admin',
  'super-admin-dashboard',
  'api',
  'platform',
  'auth',
  'login',
  'logout',
  'app',
  'static',
  'assets',
  'schools',
  'school',
  'school-dashboard',
  'teacher-dashboard',
  'student-dashboard',
  'services',
  'register-school',
  'accept-invitation',
  'health',
]);

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateSchoolSlug(raw: string): { valid: true; slug: string } | { valid: false; reason: string } {
  const slug = normalizeSlug(raw);
  if (slug.length < 3 || slug.length > 60) {
    return { valid: false, reason: 'School slug must be between 3 and 60 lowercase alphanumeric characters or hyphens.' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { valid: false, reason: 'School slug may only contain lowercase letters, numbers, and single hyphens.' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, reason: `School slug "${slug}" is reserved by the platform.` };
  }
  return { valid: true, slug };
}

export interface ProvisionSchoolInput {
  name: string;
  shortName?: string | null;
  slug: string;
  contactEmail: string;
  contactPhone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  aboutSummary?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  actorUserId?: string | null;
  onboardingRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ProvisionedSchoolResult {
  school: {
    id: string;
    name: string;
    slug: string;
    status: string;
    email: string;
  };
  initialInvitation: {
    invitationId: string;
    email: string;
    roleCode: string;
    expiresAt: string;
    rawToken: string;
  };
}

/**
 * Shared transactional school provisioning service used by BOTH:
 * 1) Direct SuperAdmin school creation (POST /api/platform/schools)
 * 2) Approved public onboarding requests (POST /api/platform/onboarding/:id/approve)
 *
 * Atomically creates: schools, school_settings, default school_roles + role_permissions,
 * initial hashed school_admin invitation, outbox_events, and append-only audit_logs.
 */
export async function provisionSchoolTransactionally(
  client: Client,
  input: ProvisionSchoolInput
): Promise<ProvisionedSchoolResult> {
  const slugCheck = validateSchoolSlug(input.slug);
  if (!slugCheck.valid) {
    throw new Error(slugCheck.reason);
  }
  const slug = slugCheck.slug;
  const normalizedEmail = input.contactEmail.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('A valid school administrator email address is required.');
  }

  return withTransaction(client, async (tx) => {
    const existingSlug = await tx.execute({
      sql: 'SELECT id FROM schools WHERE slug = ? LIMIT 1',
      args: [slug],
    });
    if (existingSlug.rows.length > 0) {
      throw new Error(`A school with slug "${slug}" already exists.`);
    }

    const schoolId = `sch_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const schoolCode = `${slug.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'S')}-${crypto.randomInt(1000, 9999)}`;

    await tx.execute({
      sql: `INSERT INTO schools (
        id, name, short_name, slug, status, school_code, email, phone,
        city, state, country, timezone, primary_color, secondary_color,
        about_summary, created_by_user_id, approved_by_user_id, approved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, 'Asia/Kolkata', ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        schoolId,
        input.name.trim(),
        input.shortName?.trim() || input.name.trim().split(' ').slice(0, 2).join(' '),
        slug,
        schoolCode,
        normalizedEmail,
        input.contactPhone?.trim() || null,
        input.city?.trim() || null,
        input.state?.trim() || null,
        input.country?.trim() || 'India',
        input.primaryColor?.trim() || '#1d4ed8',
        input.secondaryColor?.trim() || '#0f172a',
        input.aboutSummary?.trim() || null,
        input.actorUserId ?? null,
        input.actorUserId ?? null,
        now,
        now,
        now,
      ],
    });

    await tx.execute({
      sql: `INSERT INTO school_settings (
        school_id, public_site_enabled, public_news_enabled, public_gallery_enabled,
        public_achievements_enabled, public_programmes_enabled, student_self_registration_enabled,
        updated_by_user_id, updated_at
      ) VALUES (?, 1, 1, 1, 1, 1, 1, ?, ?)`,
      args: [schoolId, input.actorUserId ?? null, now],
    });

    // Provision default tenant RBAC roles + permission bindings
    for (const [roleCode, bundle] of Object.entries(DEFAULT_SCHOOL_ROLE_BUNDLES)) {
      const roleId = `sr_${crypto.randomUUID()}`;
      await tx.execute({
        sql: `INSERT INTO school_roles (id, school_id, code, name, description, is_system)
              VALUES (?, ?, ?, ?, ?, 1)`,
        args: [roleId, schoolId, roleCode, bundle.name, bundle.description],
      });

      for (const permId of bundle.permissionIds) {
        await tx.execute({
          sql: `INSERT OR IGNORE INTO role_permissions (school_role_id, permission_id) VALUES (?, ?)`,
          args: [roleId, permId],
        });
      }
    }

    // Create initial hashed school_admin invitation
    const initialInvitation = await createInvitationInExecutor(tx, {
      schoolId,
      email: normalizedEmail,
      schoolRoleCode: 'school_admin',
      invitedByUserId: input.actorUserId ?? null,
      expiresInHours: 168,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    // If approved from an onboarding request, atomically link and mark approved
    if (input.onboardingRequestId) {
      const reqCheck = await tx.execute({
        sql: 'SELECT status FROM school_onboarding_requests WHERE id = ? LIMIT 1',
        args: [input.onboardingRequestId],
      });
      if (!reqCheck.rows[0]) {
        throw new Error('Onboarding request not found.');
      }
      if (String(reqCheck.rows[0].status) !== 'pending') {
        throw new Error(`Onboarding request is already "${String(reqCheck.rows[0].status)}".`);
      }

      await tx.execute({
        sql: `UPDATE school_onboarding_requests
              SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = ?,
                  provisioned_school_id = ?, updated_at = ?
              WHERE id = ?`,
        args: [input.actorUserId ?? null, now, schoolId, now, input.onboardingRequestId],
      });
    }

    await enqueueOutboxEvent(tx, {
      schoolId,
      eventType: 'school.provisioned',
      payload: {
        schoolId,
        slug,
        name: input.name.trim(),
        contactEmail: normalizedEmail,
        onboardingRequestId: input.onboardingRequestId ?? null,
      },
      idempotencyKey: `school.provisioned:${schoolId}`,
    });

    await writeAuditLog(tx, {
      scope: 'platform',
      schoolId,
      actorUserId: input.actorUserId ?? null,
      action: input.onboardingRequestId ? 'onboarding.approved_and_provisioned' : 'school.provisioned',
      entityType: 'school',
      entityId: schoolId,
      metadata: {
        slug,
        name: input.name.trim(),
        contactEmail: normalizedEmail,
        onboardingRequestId: input.onboardingRequestId ?? null,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    return {
      school: {
        id: schoolId,
        name: input.name.trim(),
        slug,
        status: 'active',
        email: normalizedEmail,
      },
      initialInvitation,
    };
  });
}
