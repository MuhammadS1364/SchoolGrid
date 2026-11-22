import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { withTransaction, type SqlExecutor } from '../db/client';
import { enqueueOutboxEvent, writeAuditLog } from './audit';

export function generateInviteToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashInviteToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashInviteToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

export interface CreateInvitationInput {
  schoolId: string;
  email: string;
  schoolRoleCode: string;
  invitedByUserId?: string | null;
  expiresInHours?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreatedInvitationResult {
  invitationId: string;
  email: string;
  roleCode: string;
  expiresAt: string;
  /** Returned ONCE to caller for link/email dispatch — only SHA-256 hash is persisted in DB */
  rawToken: string;
}

export async function createInvitationInExecutor(
  executor: SqlExecutor,
  input: CreateInvitationInput
): Promise<CreatedInvitationResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const roleRes = await executor.execute({
    sql: 'SELECT id, code FROM school_roles WHERE school_id = ? AND code = ? LIMIT 1',
    args: [input.schoolId, input.schoolRoleCode],
  });

  const roleRow = roleRes.rows[0];
  if (!roleRow) {
    throw new Error(`Role "${input.schoolRoleCode}" does not exist for this school.`);
  }

  const schoolRoleId = String(roleRow.id);
  const { rawToken, tokenHash } = generateInviteToken();
  const hours = Math.min(Math.max(input.expiresInHours ?? 72, 1), 720);
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const invitationId = `inv_${crypto.randomUUID()}`;

  await executor.execute({
    sql: `INSERT INTO school_invitations (
      id, school_id, email, school_role_id, token_hash, status, expires_at, invited_by_user_id
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    args: [
      invitationId,
      input.schoolId,
      normalizedEmail,
      schoolRoleId,
      tokenHash,
      expiresAt,
      input.invitedByUserId ?? null,
    ],
  });

  await enqueueOutboxEvent(executor, {
    schoolId: input.schoolId,
    eventType: 'invitation.created',
    payload: {
      invitationId,
      schoolId: input.schoolId,
      email: normalizedEmail,
      roleCode: input.schoolRoleCode,
      expiresAt,
    },
    idempotencyKey: `invitation.created:${invitationId}`,
  });

  await writeAuditLog(executor, {
    scope: 'school',
    schoolId: input.schoolId,
    actorUserId: input.invitedByUserId ?? null,
    action: 'invitation.created',
    entityType: 'school_invitation',
    entityId: invitationId,
    metadata: { email: normalizedEmail, roleCode: input.schoolRoleCode, expiresAt },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });

  return {
    invitationId,
    email: normalizedEmail,
    roleCode: input.schoolRoleCode,
    expiresAt,
    rawToken,
  };
}

export async function createSchoolInvitation(
  client: Client,
  input: CreateInvitationInput
): Promise<CreatedInvitationResult> {
  return withTransaction(client, async (tx) => createInvitationInExecutor(tx, input));
}

export interface AcceptInvitationResult {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  membershipId: string;
  roleCode: string;
}

export async function acceptSchoolInvitation(
  client: Client,
  params: {
    rawToken: string;
    userId: string;
    userEmail: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<AcceptInvitationResult> {
  const tokenHash = hashInviteToken(params.rawToken);
  const normalizedUserEmail = params.userEmail.trim().toLowerCase();

  return withTransaction(client, async (tx) => {
    const invRes = await tx.execute({
      sql: `SELECT i.id, i.school_id, i.email, i.school_role_id, i.status, i.expires_at,
                   r.code AS role_code, s.slug AS school_slug, s.name AS school_name, s.status AS school_status
            FROM school_invitations i
            JOIN school_roles r ON r.id = i.school_role_id AND r.school_id = i.school_id
            JOIN schools s ON s.id = i.school_id
            WHERE i.token_hash = ?
            LIMIT 1`,
      args: [tokenHash],
    });

    const inv = invRes.rows[0];
    if (!inv) {
      throw new Error('Invitation token is invalid or does not exist.');
    }

    if (String(inv.status) !== 'pending') {
      throw new Error(`Invitation cannot be accepted because its status is "${String(inv.status)}".`);
    }

    if (String(inv.school_status) !== 'active') {
      throw new Error('This school is not currently active.');
    }

    const expiresAtMs = Date.parse(String(inv.expires_at));
    if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
      await tx.execute({
        sql: `UPDATE school_invitations SET status = 'expired' WHERE id = ?`,
        args: [String(inv.id)],
      });
      throw new Error('Invitation token has expired.');
    }

    if (String(inv.email).trim().toLowerCase() !== normalizedUserEmail) {
      throw new Error('This invitation was issued to a different email address.');
    }

    const schoolId = String(inv.school_id);
    const schoolRoleId = String(inv.school_role_id);
    const now = new Date().toISOString();

    // Upsert school membership
    const existingMem = await tx.execute({
      sql: 'SELECT id FROM school_memberships WHERE school_id = ? AND user_id = ? LIMIT 1',
      args: [schoolId, params.userId],
    });

    let membershipId: string;
    if (existingMem.rows[0]) {
      membershipId = String(existingMem.rows[0].id);
      await tx.execute({
        sql: `UPDATE school_memberships
              SET membership_status = 'active', joined_at = COALESCE(joined_at, ?), updated_at = ?
              WHERE id = ? AND school_id = ?`,
        args: [now, now, membershipId, schoolId],
      });
    } else {
      membershipId = `mem_${crypto.randomUUID()}`;
      await tx.execute({
        sql: `INSERT INTO school_memberships (
          id, school_id, user_id, membership_status, is_primary_school, joined_at
        ) VALUES (?, ?, ?, 'active', 1, ?)`,
        args: [membershipId, schoolId, params.userId, now],
      });
    }

    // Bind role to membership (tenant-scoped composite FK)
    await tx.execute({
      sql: `INSERT OR IGNORE INTO membership_roles (id, school_id, membership_id, school_role_id)
            VALUES (?, ?, ?, ?)`,
      args: [`mr_${crypto.randomUUID()}`, schoolId, membershipId, schoolRoleId],
    });

    // Mark invitation accepted (single-use)
    await tx.execute({
      sql: `UPDATE school_invitations
            SET status = 'accepted', accepted_by_user_id = ?, accepted_at = ?
            WHERE id = ?`,
      args: [params.userId, now, String(inv.id)],
    });

    await writeAuditLog(tx, {
      scope: 'school',
      schoolId,
      actorUserId: params.userId,
      action: 'invitation.accepted',
      entityType: 'school_invitation',
      entityId: String(inv.id),
      metadata: { email: normalizedUserEmail, roleCode: String(inv.role_code), membershipId },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });

    return {
      schoolId,
      schoolSlug: String(inv.school_slug),
      schoolName: String(inv.school_name),
      membershipId,
      roleCode: String(inv.role_code),
    };
  });
}
