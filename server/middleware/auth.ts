import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import type { NextFunction, Request, Response } from 'express';

export interface VerifiedIdentity {
  supabaseAuthId: string;
  email: string;
  fullName: string;
}

export interface AuthUserContext {
  userId: string;
  supabaseAuthId: string;
  email: string;
  fullName: string;
  accountStatus: string;
  platformRoles: string[];
  platformPermissions: string[];
}

export interface SchoolAccessContext {
  schoolId: string;
  membershipId: string | null;
  schoolRoles: string[];
  schoolPermissions: string[];
  viaPlatformSuperAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUserContext;
  schoolAccess?: SchoolAccessContext;
}

export type TokenVerifier = (token: string) => Promise<VerifiedIdentity | null>;

/**
 * Verifies a Supabase access token server-side via Supabase Auth (/auth/v1/user).
 * Never trusts client-supplied user IDs, roles, or unverified JWT payloads.
 */
export async function defaultVerifySupabaseToken(token: string): Promise<VerifiedIdentity | null> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      id?: string;
      email?: string;
      user_metadata?: { full_name?: string; name?: string };
    };

    if (!payload.id || !payload.email) return null;

    return {
      supabaseAuthId: payload.id,
      email: payload.email.trim().toLowerCase(),
      fullName:
        payload.user_metadata?.full_name?.trim() ||
        payload.user_metadata?.name?.trim() ||
        payload.email.split('@')[0],
    };
  } catch {
    return null;
  }
}

function getConfiguredSuperAdminEmails(): Set<string> {
  const raw = process.env.SUPERADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Upserts a verified Supabase identity into Turso `users` and resolves platform RBAC.
 * Auto-bootstraps SuperAdmin ONLY if:
 *  - email is listed in process.env.SUPERADMIN_EMAILS, OR
 *  - there are zero active super_admin assignments in the database yet (initial owner bootstrap).
 */
export async function syncAndLoadAuthUser(
  client: Client,
  identity: VerifiedIdentity
): Promise<AuthUserContext> {
  const normalizedEmail = identity.email.trim().toLowerCase();
  const now = new Date().toISOString();

  const existing = await client.execute({
    sql: `SELECT id, supabase_auth_id, email, full_name, account_status
          FROM users
          WHERE supabase_auth_id = ? OR LOWER(email) = ?
          LIMIT 1`,
    args: [identity.supabaseAuthId, normalizedEmail],
  });

  let userId: string;
  let accountStatus: string;
  let fullName: string;

  if (existing.rows[0]) {
    userId = String(existing.rows[0].id);
    accountStatus = String(existing.rows[0].account_status);
    fullName = String(existing.rows[0].full_name || identity.fullName);

    await client.execute({
      sql: `UPDATE users
            SET supabase_auth_id = ?, last_login_at = ?, updated_at = ?
            WHERE id = ?`,
      args: [identity.supabaseAuthId, now, now, userId],
    });
  } else {
    userId = `usr_${crypto.randomUUID()}`;
    accountStatus = 'active';
    fullName = identity.fullName;

    await client.execute({
      sql: `INSERT INTO users (id, supabase_auth_id, email, full_name, account_status, last_login_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
      args: [userId, identity.supabaseAuthId, normalizedEmail, fullName, now, now, now],
    });
  }

  // Ensure configured SuperAdmin emails (or first owner when zero super_admins exist) receive pr_super_admin
  const configuredSuperAdmins = getConfiguredSuperAdminEmails();
  const activeSuperAdminCountRes = await client.execute(
    `SELECT COUNT(*) AS cnt FROM platform_user_roles WHERE platform_role_id = 'pr_super_admin' AND status = 'active'`
  );
  const activeSuperAdminCount = Number(activeSuperAdminCountRes.rows[0]?.cnt ?? 0);

  if (
    accountStatus === 'active' &&
    (configuredSuperAdmins.has(normalizedEmail) || activeSuperAdminCount === 0)
  ) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO platform_user_roles (id, user_id, platform_role_id, status)
            VALUES (?, ?, 'pr_super_admin', 'active')`,
      args: [`pur_${crypto.randomUUID()}`, userId],
    });
  }

  const rolesRes = await client.execute({
    sql: `SELECT pr.code
          FROM platform_user_roles pur
          JOIN platform_roles pr ON pr.id = pur.platform_role_id
          WHERE pur.user_id = ? AND pur.status = 'active'`,
    args: [userId],
  });
  const platformRoles = rolesRes.rows.map((r) => String(r.code));

  const permsRes = await client.execute({
    sql: `SELECT DISTINCT pp.code
          FROM platform_user_roles pur
          JOIN platform_role_permissions prp ON prp.platform_role_id = pur.platform_role_id
          JOIN platform_permissions pp ON pp.id = prp.platform_permission_id
          WHERE pur.user_id = ? AND pur.status = 'active'`,
    args: [userId],
  });
  const platformPermissions = permsRes.rows.map((r) => String(r.code));

  return {
    userId,
    supabaseAuthId: identity.supabaseAuthId,
    email: normalizedEmail,
    fullName,
    accountStatus,
    platformRoles,
    platformPermissions,
  };
}

export async function resolveSchoolAccess(
  client: Client,
  authUser: AuthUserContext,
  schoolId: string
): Promise<SchoolAccessContext | null> {
  // Check school exists
  const schoolRes = await client.execute({
    sql: 'SELECT id, status FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    args: [schoolId],
  });
  const schoolRow = schoolRes.rows[0];
  if (!schoolRow) return null;

  // Platform SuperAdmin has governance access to inspect/assist schools
  if (authUser.platformRoles.includes('super_admin')) {
    const allPerms = await client.execute('SELECT code FROM permissions');
    return {
      schoolId,
      membershipId: null,
      schoolRoles: ['super_admin'],
      schoolPermissions: allPerms.rows.map((r) => String(r.code)),
      viaPlatformSuperAdmin: true,
    };
  }

  // Non-superadmin users cannot access suspended/archived schools
  if (String(schoolRow.status) !== 'active') {
    return null;
  }

  const memRes = await client.execute({
    sql: `SELECT id, membership_status FROM school_memberships
          WHERE school_id = ? AND user_id = ? LIMIT 1`,
    args: [schoolId, authUser.userId],
  });
  const mem = memRes.rows[0];
  if (!mem || String(mem.membership_status) !== 'active') {
    return null;
  }

  const membershipId = String(mem.id);
  const rolesRes = await client.execute({
    sql: `SELECT sr.code
          FROM membership_roles mr
          JOIN school_roles sr ON sr.id = mr.school_role_id AND sr.school_id = mr.school_id
          WHERE mr.school_id = ? AND mr.membership_id = ?`,
    args: [schoolId, membershipId],
  });
  const schoolRoles = rolesRes.rows.map((r) => String(r.code));

  const permsRes = await client.execute({
    sql: `SELECT DISTINCT p.code
          FROM membership_roles mr
          JOIN role_permissions rp ON rp.school_role_id = mr.school_role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE mr.school_id = ? AND mr.membership_id = ?`,
    args: [schoolId, membershipId],
  });
  const schoolPermissions = permsRes.rows.map((r) => String(r.code));

  return {
    schoolId,
    membershipId,
    schoolRoles,
    schoolPermissions,
    viaPlatformSuperAdmin: false,
  };
}

export function createAuthMiddleware(client: Client, verifier: TokenVerifier = defaultVerifySupabaseToken) {
  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization Bearer token.' },
      });
      return;
    }

    const identity = await verifier(match[1].trim());
    if (!identity) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Authentication token could not be verified.' },
      });
      return;
    }

    const authUser = await syncAndLoadAuthUser(client, identity);
    if (authUser.accountStatus !== 'active') {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: `Account is currently "${authUser.accountStatus}". Contact platform administrator.`,
        },
      });
      return;
    }

    req.authUser = authUser;
    next();
  };

  const requirePlatformPermission = (permissionCode: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.authUser) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
        return;
      }
      if (!req.authUser.platformPermissions.includes(permissionCode)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Platform permission "${permissionCode}" is required.`,
          },
        });
        return;
      }
      next();
    };
  };

  const requireSchoolPermission = (permissionCode: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.authUser) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
        return;
      }

      const schoolId = String(req.params.schoolId || '').trim();
      if (!schoolId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_SCHOOL_ID', message: 'Missing schoolId parameter.' },
        });
        return;
      }

      const access = await resolveSchoolAccess(client, req.authUser, schoolId);
      if (!access) {
        // Return 404 to prevent leaking existence of other tenants
        res.status(404).json({
          success: false,
          error: { code: 'SCHOOL_NOT_FOUND', message: 'School not found or access denied.' },
        });
        return;
      }

      if (!access.schoolPermissions.includes(permissionCode)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `School permission "${permissionCode}" is required.`,
          },
        });
        return;
      }

      req.schoolAccess = access;
      next();
    };
  };

  return { requireAuth, requirePlatformPermission, requireSchoolPermission };
}

/**
 * Lightweight fixed-window in-memory rate limiter for public write endpoints
 * (e.g., school registration requests, invitation acceptance).
 */
export function createRateLimiter(options: { windowMs: number; maxRequests: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (entry.count >= options.maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment before trying again.',
        },
      });
      return;
    }

    entry.count += 1;
    next();
  };
}
