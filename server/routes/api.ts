import crypto from 'node:crypto';
import express, { type Request, type Response, type Router } from 'express';
import type { Client } from '@libsql/client';
import { z } from 'zod';
import {
  createAuthMiddleware,
  createRateLimiter,
  defaultVerifySupabaseToken,
  type AuthenticatedRequest,
  type TokenVerifier,
} from '../middleware/auth';
import { getDbInfo } from '../db/client';
import { enqueueOutboxEvent, writeAuditLog } from '../services/audit';
import { acceptSchoolInvitation, createSchoolInvitation } from '../services/invitations';
import {
  normalizeSlug,
  provisionSchoolTransactionally,
  validateSchoolSlug,
} from '../services/schoolProvisioning';

export interface ApiRouterOptions {
  tokenVerifier?: TokenVerifier;
  disableRateLimit?: boolean;
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getUserAgent(req: Request): string {
  return String(req.headers['user-agent'] || '').slice(0, 250);
}

function sendValidationError(res: Response, parsed: { error: z.ZodError }) {
  const first = parsed.error.issues[0];
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid request payload.',
    },
  });
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({
    success: false,
    error: { code, message },
  });
}

// ---------- Zod Schemas ----------

const publicRegistrationSchema = z.object({
  schoolName: z.string().trim().min(3).max(160),
  requestedSlug: z.string().trim().min(3).max(60),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const createSchoolSchema = z.object({
  name: z.string().trim().min(3).max(160),
  shortName: z.string().trim().max(80).optional().nullable(),
  slug: z.string().trim().min(3).max(60),
  contactEmail: z.string().trim().email().max(160),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  aboutSummary: z.string().trim().max(1000).optional().nullable(),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  secondaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

const schoolStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
  reason: z.string().trim().max(300).optional().nullable(),
});

const rejectOnboardingSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

const acceptInviteSchema = z.object({
  token: z.string().trim().min(16).max(256),
});

const createWingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional(),
  wingType: z.enum(['academic', 'cultural', 'sports', 'club', 'administrative', 'general']).default('general'),
  description: z.string().trim().max(600).optional().nullable(),
});

const createStudentSchema = z.object({
  admissionNo: z.string().trim().min(1).max(60),
  rollNo: z.string().trim().max(40).optional().nullable(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().nullable(),
  gender: z.string().trim().max(30).optional().nullable(),
  guardianName: z.string().trim().max(120).optional().nullable(),
  guardianPhone: z.string().trim().max(40).optional().nullable(),
  guardianEmail: z.string().trim().email().max(160).optional().nullable(),
  classId: z.string().trim().max(80).optional().nullable(),
});

const createProgrammeSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(3).max(80).optional(),
  wingId: z.string().trim().max(80).optional().nullable(),
  summary: z.string().trim().max(400).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  programmeType: z.enum(['event', 'competition', 'workshop', 'seminar', 'sports', 'cultural', 'other']).default('event'),
  visibility: z.enum(['public', 'school_only', 'wing_only']).default('school_only'),
  status: z.enum(['draft', 'published']).default('draft'),
  registrationRequired: z.boolean().default(false),
  startAt: z.string().trim().max(40).optional().nullable(),
  endAt: z.string().trim().max(40).optional().nullable(),
  venue: z.string().trim().max(160).optional().nullable(),
  maxParticipants: z.number().int().positive().max(10000).optional().nullable(),
});

const createAchievementSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(1500).optional().nullable(),
  achievementLevel: z.enum(['school', 'district', 'state', 'national', 'international']).default('school'),
  achievedOn: z.string().trim().max(30).optional().nullable(),
  recipientType: z.enum(['student', 'team', 'staff', 'school']).default('student'),
  recipientName: z.string().trim().min(1).max(140),
  programmeId: z.string().trim().max(80).optional().nullable(),
  wingId: z.string().trim().max(80).optional().nullable(),
  visibility: z.enum(['public', 'school_only']).default('public'),
  status: z.enum(['draft', 'published']).default('published'),
});

const createNewsSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(3).max(80).optional(),
  excerpt: z.string().trim().max(400).optional().nullable(),
  bodyMarkdown: z.string().trim().min(5).max(15000),
  visibility: z.enum(['public', 'school_only']).default('public'),
  status: z.enum(['draft', 'published']).default('draft'),
});

const createNoticeSchema = z.object({
  title: z.string().trim().min(3).max(180),
  body: z.string().trim().min(3).max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  audience: z.enum(['public', 'school_all', 'students', 'staff', 'wing']).default('school_all'),
  wingId: z.string().trim().max(80).optional().nullable(),
  status: z.enum(['draft', 'published']).default('published'),
  isPinned: z.boolean().default(false),
});

const createInvitationSchema = z.object({
  email: z.string().trim().email().max(160),
  roleCode: z.enum(['school_admin', 'wing_manager', 'teacher', 'content_manager', 'student']),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

const registerStudentForProgrammeSchema = z.object({
  studentId: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(400).optional().nullable(),
});

const updateSchoolProfileSchema = z.object({
  name: z.string().trim().min(3).max(160).optional(),
  shortName: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  websiteUrl: z.string().trim().max(240).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  aboutSummary: z.string().trim().max(1200).optional().nullable(),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  publicSiteEnabled: z.boolean().optional(),
  publicNewsEnabled: z.boolean().optional(),
  publicAchievementsEnabled: z.boolean().optional(),
  publicProgrammesEnabled: z.boolean().optional(),
});

export function createApiRouter(client: Client, options: ApiRouterOptions = {}): Router {
  const router = express.Router();
  const { requireAuth, requirePlatformPermission, requireSchoolPermission } = createAuthMiddleware(
    client,
    options.tokenVerifier ?? defaultVerifySupabaseToken
  );

  const publicWriteLimiter = options.disableRateLimit
    ? (_req: Request, _res: Response, next: express.NextFunction) => next()
    : createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

  // =========================================================
  // 1. HEALTH & STATUS
  // =========================================================
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const migs = await client.execute('SELECT COUNT(*) AS cnt FROM schema_migrations');
      const schools = await client.execute(`SELECT COUNT(*) AS cnt FROM schools WHERE status = 'active' AND deleted_at IS NULL`);
      const info = getDbInfo();
      res.json({
        success: true,
        data: {
          status: 'ok',
          database: {
            mode: info.mode,
            target: info.urlMasked,
            migrationsApplied: Number(migs.rows[0]?.cnt ?? 0),
          },
          activeSchoolsCount: Number(schools.rows[0]?.cnt ?? 0),
          supabaseAuthConfigured: Boolean(
            (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
              (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
          ),
        },
      });
    } catch {
      sendError(res, 500, 'DB_HEALTH_FAILED', 'Database health check failed.');
    }
  });

  // =========================================================
  // 2. PUBLIC SCHOOL DIRECTORY, PUBLIC WEBSITES & ONBOARDING
  //    Strictly returns ONLY active schools & published/public records.
  // =========================================================
  router.get('/public/schools', async (_req: Request, res: Response) => {
    try {
      const result = await client.execute(
        `SELECT s.id, s.name, s.short_name, s.slug, s.city, s.state, s.country,
                s.primary_color, s.secondary_color, s.about_summary, s.established_year,
                (SELECT COUNT(*) FROM wings w WHERE w.school_id = s.id AND w.status = 'active' AND w.deleted_at IS NULL) AS wing_count,
                (SELECT COUNT(*) FROM programmes p WHERE p.school_id = s.id AND p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL) AS programme_count
         FROM schools s
         LEFT JOIN school_settings ss ON ss.school_id = s.id
         WHERE s.status = 'active'
           AND s.deleted_at IS NULL
           AND COALESCE(ss.public_site_enabled, 1) = 1
         ORDER BY s.name ASC`
      );
      res.json({ success: true, data: result.rows });
    } catch {
      sendError(res, 500, 'PUBLIC_SCHOOLS_ERROR', 'Failed to load public schools.');
    }
  });

  router.get('/public/schools/:slug', async (req: Request, res: Response) => {
    const slug = normalizeSlug(String(req.params.slug || ''));
    if (!slug) {
      sendError(res, 404, 'SCHOOL_NOT_FOUND', 'School not found.');
      return;
    }

    try {
      const schoolRes = await client.execute({
        sql: `SELECT s.id, s.name, s.short_name, s.slug, s.email, s.phone, s.website_url,
                     s.city, s.state, s.country, s.primary_color, s.secondary_color,
                     s.about_summary, s.established_year,
                     COALESCE(ss.public_site_enabled, 1) AS public_site_enabled,
                     COALESCE(ss.public_news_enabled, 1) AS public_news_enabled,
                     COALESCE(ss.public_achievements_enabled, 1) AS public_achievements_enabled,
                     COALESCE(ss.public_programmes_enabled, 1) AS public_programmes_enabled
              FROM schools s
              LEFT JOIN school_settings ss ON ss.school_id = s.id
              WHERE s.slug = ? AND s.status = 'active' AND s.deleted_at IS NULL
              LIMIT 1`,
        args: [slug],
      });

      const school = schoolRes.rows[0];
      if (!school || Number(school.public_site_enabled) !== 1) {
        sendError(res, 404, 'SCHOOL_NOT_FOUND', 'Public school website not found.');
        return;
      }

      const schoolId = String(school.id);

      const [wingsRes, programmesRes, achievementsRes, newsRes, noticesRes] = await Promise.all([
        client.execute({
          sql: `SELECT id, name, slug, wing_type, description
                FROM wings
                WHERE school_id = ? AND status = 'active' AND deleted_at IS NULL
                ORDER BY name ASC`,
          args: [schoolId],
        }),
        Number(school.public_programmes_enabled) === 1
          ? client.execute({
              sql: `SELECT id, wing_id, title, slug, summary, description, programme_type,
                           registration_required, start_at, end_at, venue, max_participants, published_at
                    FROM programmes
                    WHERE school_id = ? AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
                    ORDER BY COALESCE(start_at, created_at) DESC`,
              args: [schoolId],
            })
          : Promise.resolve({ rows: [] }),
        Number(school.public_achievements_enabled) === 1
          ? client.execute({
              sql: `SELECT id, title, description, achievement_level, achieved_on, recipient_type, recipient_name
                    FROM achievements
                    WHERE school_id = ? AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
                    ORDER BY COALESCE(achieved_on, created_at) DESC`,
              args: [schoolId],
            })
          : Promise.resolve({ rows: [] }),
        Number(school.public_news_enabled) === 1
          ? client.execute({
              sql: `SELECT id, title, slug, excerpt, body_markdown, published_at
                    FROM news_posts
                    WHERE school_id = ? AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
                    ORDER BY COALESCE(published_at, created_at) DESC`,
              args: [schoolId],
            })
          : Promise.resolve({ rows: [] }),
        client.execute({
          sql: `SELECT id, title, body, priority, is_pinned, publish_at, created_at
                FROM notices
                WHERE school_id = ? AND status = 'published' AND audience = 'public'
                ORDER BY is_pinned DESC, COALESCE(publish_at, created_at) DESC`,
          args: [schoolId],
        }),
      ]);

      res.json({
        success: true,
        data: {
          school,
          wings: wingsRes.rows,
          programmes: programmesRes.rows,
          achievements: achievementsRes.rows,
          news: newsRes.rows,
          notices: noticesRes.rows,
        },
      });
    } catch {
      sendError(res, 500, 'PUBLIC_SCHOOL_DETAIL_ERROR', 'Failed to load school website.');
    }
  });

  router.post('/public/school-registration', publicWriteLimiter, async (req: Request, res: Response) => {
    const parsed = publicRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed);
      return;
    }

    const slugCheck = validateSchoolSlug(parsed.data.requestedSlug);
    if (!slugCheck.valid) {
      sendError(res, 400, 'INVALID_SLUG', slugCheck.reason);
      return;
    }

    try {
      const existingSchool = await client.execute({
        sql: 'SELECT id FROM schools WHERE slug = ? LIMIT 1',
        args: [slugCheck.slug],
      });
      if (existingSchool.rows.length > 0) {
        sendError(res, 409, 'SLUG_TAKEN', `The slug "${slugCheck.slug}" is already assigned to a registered school.`);
        return;
      }

      const id = `onb_${crypto.randomUUID()}`;
      const normalizedEmail = parsed.data.contactEmail.toLowerCase();

      await client.execute({
        sql: `INSERT INTO school_onboarding_requests (
          id, school_name, requested_slug, contact_name, contact_email, contact_phone,
          city, state, country, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        args: [
          id,
          parsed.data.schoolName,
          slugCheck.slug,
          parsed.data.contactName,
          normalizedEmail,
          parsed.data.contactPhone ?? null,
          parsed.data.city ?? null,
          parsed.data.state ?? null,
          parsed.data.country ?? 'India',
          parsed.data.notes ?? null,
        ],
      });

      await enqueueOutboxEvent(client, {
        eventType: 'onboarding.submitted',
        payload: { requestId: id, schoolName: parsed.data.schoolName, requestedSlug: slugCheck.slug },
        idempotencyKey: `onboarding.submitted:${id}`,
      });

      await writeAuditLog(client, {
        scope: 'platform',
        action: 'onboarding.submitted',
        entityType: 'school_onboarding_request',
        entityId: id,
        metadata: { schoolName: parsed.data.schoolName, requestedSlug: slugCheck.slug, contactEmail: normalizedEmail },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.status(201).json({
        success: true,
        data: {
          id,
          schoolName: parsed.data.schoolName,
          requestedSlug: slugCheck.slug,
          status: 'pending',
        },
      });
    } catch {
      sendError(res, 500, 'ONBOARDING_SUBMIT_ERROR', 'Unable to submit school registration request.');
    }
  });

  // =========================================================
  // 3. AUTHENTICATED IDENTITY & INVITATION ACCEPTANCE
  // =========================================================
  router.post('/auth/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.authUser!;
    const membershipsRes = await client.execute({
      sql: `SELECT m.id AS membership_id, m.school_id, m.membership_status, m.is_primary_school,
                   s.name AS school_name, s.slug AS school_slug, s.status AS school_status
            FROM school_memberships m
            JOIN schools s ON s.id = m.school_id
            WHERE m.user_id = ? AND m.membership_status = 'active' AND s.deleted_at IS NULL`,
      args: [authUser.userId],
    });

    res.json({
      success: true,
      data: {
        user: authUser,
        memberships: membershipsRes.rows,
      },
    });
  });

  router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.authUser!;
    const membershipsRes = await client.execute({
      sql: `SELECT m.id AS membership_id, m.school_id, m.membership_status, m.is_primary_school,
                   s.name AS school_name, s.slug AS school_slug, s.status AS school_status
            FROM school_memberships m
            JOIN schools s ON s.id = m.school_id
            WHERE m.user_id = ? AND m.membership_status = 'active' AND s.deleted_at IS NULL`,
      args: [authUser.userId],
    });

    res.json({
      success: true,
      data: {
        user: authUser,
        memberships: membershipsRes.rows,
      },
    });
  });

  router.post('/invitations/accept', publicWriteLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed);
      return;
    }

    try {
      const accepted = await acceptSchoolInvitation(client, {
        rawToken: parsed.data.token,
        userId: req.authUser!.userId,
        userEmail: req.authUser!.email,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      res.json({ success: true, data: accepted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to accept invitation.';
      sendError(res, 400, 'INVITATION_ACCEPT_FAILED', msg);
    }
  });

  // =========================================================
  // 4. PLATFORM (SUPERADMIN) GOVERNANCE ROUTES
  // =========================================================
  router.get(
    '/platform/dashboard',
    requireAuth,
    requirePlatformPermission('platform.schools.read'),
    async (_req: AuthenticatedRequest, res: Response) => {
      try {
        const [schoolsCount, activeSchoolsCount, pendingOnboarding, usersCount, outboxPending, auditCount] =
          await Promise.all([
            client.execute('SELECT COUNT(*) AS cnt FROM schools WHERE deleted_at IS NULL'),
            client.execute(`SELECT COUNT(*) AS cnt FROM schools WHERE status = 'active' AND deleted_at IS NULL`),
            client.execute(`SELECT COUNT(*) AS cnt FROM school_onboarding_requests WHERE status = 'pending'`),
            client.execute('SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL'),
            client.execute(`SELECT COUNT(*) AS cnt FROM outbox_events WHERE status IN ('pending', 'failed')`),
            client.execute('SELECT COUNT(*) AS cnt FROM audit_logs'),
          ]);

        res.json({
          success: true,
          data: {
            totalSchools: Number(schoolsCount.rows[0]?.cnt ?? 0),
            activeSchools: Number(activeSchoolsCount.rows[0]?.cnt ?? 0),
            pendingOnboarding: Number(pendingOnboarding.rows[0]?.cnt ?? 0),
            totalUsers: Number(usersCount.rows[0]?.cnt ?? 0),
            pendingOutbox: Number(outboxPending.rows[0]?.cnt ?? 0),
            totalAuditLogs: Number(auditCount.rows[0]?.cnt ?? 0),
          },
        });
      } catch {
        sendError(res, 500, 'PLATFORM_DASHBOARD_ERROR', 'Failed to load platform summary.');
      }
    }
  );

  router.get(
    '/platform/schools',
    requireAuth,
    requirePlatformPermission('platform.schools.read'),
    async (_req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await client.execute(
          `SELECT s.id, s.name, s.short_name, s.slug, s.status, s.school_code, s.email, s.phone,
                  s.city, s.state, s.country, s.created_at, s.approved_at,
                  (SELECT COUNT(*) FROM school_memberships m WHERE m.school_id = s.id AND m.membership_status = 'active') AS member_count,
                  (SELECT COUNT(*) FROM wings w WHERE w.school_id = s.id AND w.deleted_at IS NULL) AS wing_count,
                  (SELECT COUNT(*) FROM programmes p WHERE p.school_id = s.id AND p.deleted_at IS NULL) AS programme_count
           FROM schools s
           WHERE s.deleted_at IS NULL
           ORDER BY s.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
      } catch {
        sendError(res, 500, 'PLATFORM_SCHOOLS_ERROR', 'Failed to list schools.');
      }
    }
  );

  router.post(
    '/platform/schools',
    requireAuth,
    requirePlatformPermission('platform.schools.create'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createSchoolSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      try {
        const provisioned = await provisionSchoolTransactionally(client, {
          ...parsed.data,
          actorUserId: req.authUser!.userId,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });
        res.status(201).json({ success: true, data: provisioned });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to provision school.';
        const status = msg.toLowerCase().includes('already exists') ? 409 : 400;
        sendError(res, status, 'SCHOOL_PROVISION_FAILED', msg);
      }
    }
  );

  router.post(
    '/platform/schools/:schoolId/status',
    requireAuth,
    requirePlatformPermission('platform.schools.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = schoolStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = String(req.params.schoolId || '').trim();
      const existing = await client.execute({
        sql: 'SELECT id, status, slug FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1',
        args: [schoolId],
      });
      if (!existing.rows[0]) {
        sendError(res, 404, 'SCHOOL_NOT_FOUND', 'School not found.');
        return;
      }

      const prevStatus = String(existing.rows[0].status);
      const now = new Date().toISOString();

      await client.execute({
        sql: 'UPDATE schools SET status = ?, updated_at = ? WHERE id = ?',
        args: [parsed.data.status, now, schoolId],
      });

      await writeAuditLog(client, {
        scope: 'platform',
        schoolId,
        actorUserId: req.authUser!.userId,
        action: 'school.status_changed',
        entityType: 'school',
        entityId: schoolId,
        metadata: { from: prevStatus, to: parsed.data.status, reason: parsed.data.reason ?? null },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({ success: true, data: { id: schoolId, status: parsed.data.status } });
    }
  );

  router.get(
    '/platform/onboarding',
    requireAuth,
    requirePlatformPermission('platform.onboarding.review'),
    async (_req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await client.execute(
          `SELECT id, school_name, requested_slug, contact_name, contact_email, contact_phone,
                  city, state, country, notes, status, reviewed_at, rejection_reason,
                  provisioned_school_id, created_at
           FROM school_onboarding_requests
           ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC`
        );
        res.json({ success: true, data: result.rows });
      } catch {
        sendError(res, 500, 'ONBOARDING_LIST_ERROR', 'Failed to load onboarding requests.');
      }
    }
  );

  router.post(
    '/platform/onboarding/:requestId/approve',
    requireAuth,
    requirePlatformPermission('platform.onboarding.review'),
    async (req: AuthenticatedRequest, res: Response) => {
      const requestId = String(req.params.requestId || '').trim();
      const reqRowRes = await client.execute({
        sql: 'SELECT * FROM school_onboarding_requests WHERE id = ? LIMIT 1',
        args: [requestId],
      });
      const row = reqRowRes.rows[0];
      if (!row) {
        sendError(res, 404, 'ONBOARDING_NOT_FOUND', 'Onboarding request not found.');
        return;
      }

      try {
        const provisioned = await provisionSchoolTransactionally(client, {
          name: String(row.school_name),
          slug: String(row.requested_slug),
          contactEmail: String(row.contact_email),
          contactPhone: row.contact_phone ? String(row.contact_phone) : null,
          city: row.city ? String(row.city) : null,
          state: row.state ? String(row.state) : null,
          country: row.country ? String(row.country) : 'India',
          aboutSummary: row.notes ? String(row.notes) : null,
          actorUserId: req.authUser!.userId,
          onboardingRequestId: requestId,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });
        res.json({ success: true, data: provisioned });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to approve onboarding request.';
        const status = msg.toLowerCase().includes('already exists') ? 409 : 400;
        sendError(res, status, 'ONBOARDING_APPROVE_FAILED', msg);
      }
    }
  );

  router.post(
    '/platform/onboarding/:requestId/reject',
    requireAuth,
    requirePlatformPermission('platform.onboarding.review'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = rejectOnboardingSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const requestId = String(req.params.requestId || '').trim();
      const existing = await client.execute({
        sql: 'SELECT id, status FROM school_onboarding_requests WHERE id = ? LIMIT 1',
        args: [requestId],
      });
      if (!existing.rows[0]) {
        sendError(res, 404, 'ONBOARDING_NOT_FOUND', 'Onboarding request not found.');
        return;
      }
      if (String(existing.rows[0].status) !== 'pending') {
        sendError(res, 400, 'INVALID_STATE', 'Only pending onboarding requests can be rejected.');
        return;
      }

      const now = new Date().toISOString();
      await client.execute({
        sql: `UPDATE school_onboarding_requests
              SET status = 'rejected', reviewed_by_user_id = ?, reviewed_at = ?, rejection_reason = ?, updated_at = ?
              WHERE id = ?`,
        args: [req.authUser!.userId, now, parsed.data.reason, now, requestId],
      });

      await writeAuditLog(client, {
        scope: 'platform',
        actorUserId: req.authUser!.userId,
        action: 'onboarding.rejected',
        entityType: 'school_onboarding_request',
        entityId: requestId,
        metadata: { reason: parsed.data.reason },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({ success: true, data: { id: requestId, status: 'rejected' } });
    }
  );

  router.get(
    '/platform/audit-logs',
    requireAuth,
    requirePlatformPermission('platform.audit.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const result = await client.execute({
        sql: `SELECT a.id, a.scope, a.school_id, s.name AS school_name, a.actor_user_id,
                     u.email AS actor_email, a.action, a.entity_type, a.entity_id,
                     a.metadata_json, a.created_at
              FROM audit_logs a
              LEFT JOIN schools s ON s.id = a.school_id
              LEFT JOIN users u ON u.id = a.actor_user_id
              ORDER BY a.created_at DESC
              LIMIT ?`,
        args: [limit],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.get(
    '/platform/outbox',
    requireAuth,
    requirePlatformPermission('platform.outbox.manage'),
    async (_req: AuthenticatedRequest, res: Response) => {
      const result = await client.execute(
        `SELECT id, school_id, event_type, payload_json, status, attempts, max_attempts,
                last_error, idempotency_key, created_at, processed_at
         FROM outbox_events
         ORDER BY created_at DESC
         LIMIT 100`
      );
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/platform/outbox/:eventId/retry',
    requireAuth,
    requirePlatformPermission('platform.outbox.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const eventId = String(req.params.eventId || '').trim();
      const now = new Date().toISOString();
      const updated = await client.execute({
        sql: `UPDATE outbox_events
              SET status = 'processed', attempts = attempts + 1, processed_at = ?, last_error = NULL
              WHERE id = ?`,
        args: [now, eventId],
      });
      if (updated.rowsAffected === 0) {
        sendError(res, 404, 'OUTBOX_NOT_FOUND', 'Outbox event not found.');
        return;
      }
      res.json({ success: true, data: { id: eventId, status: 'processed' } });
    }
  );

  // =========================================================
  // 5. TENANT-SCOPED SCHOOL ROUTES (/api/school/:schoolId/*)
  //    Every query enforces WHERE school_id = req.schoolAccess!.schoolId
  // =========================================================
  router.get(
    '/school/:schoolId/profile',
    requireAuth,
    requireSchoolPermission('school.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT s.*, ss.public_site_enabled, ss.public_news_enabled, ss.public_gallery_enabled,
                     ss.public_achievements_enabled, ss.public_programmes_enabled, ss.student_self_registration_enabled
              FROM schools s
              LEFT JOIN school_settings ss ON ss.school_id = s.id
              WHERE s.id = ? AND s.deleted_at IS NULL
              LIMIT 1`,
        args: [schoolId],
      });
      if (!result.rows[0]) {
        sendError(res, 404, 'SCHOOL_NOT_FOUND', 'School not found.');
        return;
      }
      res.json({
        success: true,
        data: {
          school: result.rows[0],
          access: req.schoolAccess,
        },
      });
    }
  );

  router.patch(
    '/school/:schoolId/profile',
    requireAuth,
    requireSchoolPermission('school.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateSchoolProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const now = new Date().toISOString();
      const d = parsed.data;

      await client.execute({
        sql: `UPDATE schools
              SET name = COALESCE(?, name),
                  short_name = COALESCE(?, short_name),
                  phone = COALESCE(?, phone),
                  website_url = COALESCE(?, website_url),
                  city = COALESCE(?, city),
                  state = COALESCE(?, state),
                  about_summary = COALESCE(?, about_summary),
                  primary_color = COALESCE(?, primary_color),
                  updated_at = ?
              WHERE id = ?`,
        args: [
          d.name ?? null,
          d.shortName ?? null,
          d.phone ?? null,
          d.websiteUrl ?? null,
          d.city ?? null,
          d.state ?? null,
          d.aboutSummary ?? null,
          d.primaryColor ?? null,
          now,
          schoolId,
        ],
      });

      if (
        d.publicSiteEnabled !== undefined ||
        d.publicNewsEnabled !== undefined ||
        d.publicAchievementsEnabled !== undefined ||
        d.publicProgrammesEnabled !== undefined
      ) {
        await client.execute({
          sql: `UPDATE school_settings
                SET public_site_enabled = COALESCE(?, public_site_enabled),
                    public_news_enabled = COALESCE(?, public_news_enabled),
                    public_achievements_enabled = COALESCE(?, public_achievements_enabled),
                    public_programmes_enabled = COALESCE(?, public_programmes_enabled),
                    updated_by_user_id = ?,
                    updated_at = ?
                WHERE school_id = ?`,
          args: [
            d.publicSiteEnabled === undefined ? null : d.publicSiteEnabled ? 1 : 0,
            d.publicNewsEnabled === undefined ? null : d.publicNewsEnabled ? 1 : 0,
            d.publicAchievementsEnabled === undefined ? null : d.publicAchievementsEnabled ? 1 : 0,
            d.publicProgrammesEnabled === undefined ? null : d.publicProgrammesEnabled ? 1 : 0,
            req.authUser!.userId,
            now,
            schoolId,
          ],
        });
      }

      await writeAuditLog(client, {
        scope: 'school',
        schoolId,
        actorUserId: req.authUser!.userId,
        action: 'school.profile_updated',
        entityType: 'school',
        entityId: schoolId,
        metadata: d as Record<string, unknown>,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({ success: true, data: { schoolId, updatedAt: now } });
    }
  );

  // ---- Wings ----
  router.get(
    '/school/:schoolId/wings',
    requireAuth,
    requireSchoolPermission('school.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT id, school_id, name, slug, wing_type, description, status, created_at
              FROM wings
              WHERE school_id = ? AND deleted_at IS NULL
              ORDER BY created_at DESC`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/school/:schoolId/wings',
    requireAuth,
    requireSchoolPermission('wings.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createWingSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const slug = normalizeSlug(parsed.data.slug || parsed.data.name);
      const id = `wng_${crypto.randomUUID()}`;

      try {
        await client.execute({
          sql: `INSERT INTO wings (id, school_id, name, slug, wing_type, description, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          args: [id, schoolId, parsed.data.name, slug, parsed.data.wingType, parsed.data.description ?? null],
        });

        await writeAuditLog(client, {
          scope: 'school',
          schoolId,
          actorUserId: req.authUser!.userId,
          action: 'wing.created',
          entityType: 'wing',
          entityId: id,
          metadata: { name: parsed.data.name, wingType: parsed.data.wingType },
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.status(201).json({
          success: true,
          data: { id, school_id: schoolId, name: parsed.data.name, slug, wing_type: parsed.data.wingType },
        });
      } catch {
        sendError(res, 409, 'WING_CONFLICT', 'A wing with that slug already exists in this school.');
      }
    }
  );

  // ---- Students ----
  router.get(
    '/school/:schoolId/students',
    requireAuth,
    requireSchoolPermission('students.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT id, school_id, admission_no, roll_no, first_name, last_name, gender,
                     class_id, guardian_name, guardian_phone, guardian_email, status, created_at
              FROM students
              WHERE school_id = ? AND deleted_at IS NULL
              ORDER BY created_at DESC`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/school/:schoolId/students',
    requireAuth,
    requireSchoolPermission('students.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const id = `stu_${crypto.randomUUID()}`;
      try {
        await client.execute({
          sql: `INSERT INTO students (
            id, school_id, admission_no, roll_no, first_name, last_name, gender,
            class_id, guardian_name, guardian_phone, guardian_email, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          args: [
            id,
            schoolId,
            parsed.data.admissionNo,
            parsed.data.rollNo ?? null,
            parsed.data.firstName,
            parsed.data.lastName ?? null,
            parsed.data.gender ?? null,
            parsed.data.classId ?? null,
            parsed.data.guardianName ?? null,
            parsed.data.guardianPhone ?? null,
            parsed.data.guardianEmail ?? null,
          ],
        });

        res.status(201).json({
          success: true,
          data: { id, school_id: schoolId, admission_no: parsed.data.admissionNo, first_name: parsed.data.firstName },
        });
      } catch {
        sendError(res, 400, 'STUDENT_CREATE_FAILED', 'Could not create student (duplicate admission number or invalid class).');
      }
    }
  );

  // ---- Programmes & Registrations ----
  router.get(
    '/school/:schoolId/programmes',
    requireAuth,
    requireSchoolPermission('school.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT p.id, p.school_id, p.wing_id, w.name AS wing_name, p.title, p.slug,
                     p.summary, p.description, p.programme_type, p.visibility, p.status,
                     p.registration_required, p.start_at, p.end_at, p.venue, p.max_participants,
                     p.published_at, p.created_at,
                     (SELECT COUNT(*) FROM programme_registrations pr WHERE pr.school_id = p.school_id AND pr.programme_id = p.id) AS registration_count
              FROM programmes p
              LEFT JOIN wings w ON w.id = p.wing_id AND w.school_id = p.school_id
              WHERE p.school_id = ? AND p.deleted_at IS NULL
              ORDER BY p.created_at DESC`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/school/:schoolId/programmes',
    requireAuth,
    requireSchoolPermission('programmes.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createProgrammeSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const id = `prg_${crypto.randomUUID()}`;
      const baseSlug = normalizeSlug(parsed.data.slug || parsed.data.title) || `prog-${Date.now()}`;
      const slug = `${baseSlug}-${crypto.randomInt(100, 999)}`;
      const now = new Date().toISOString();
      const publishedAt = parsed.data.status === 'published' ? now : null;

      try {
        await client.execute({
          sql: `INSERT INTO programmes (
            id, school_id, wing_id, title, slug, summary, description, programme_type,
            visibility, status, registration_required, start_at, end_at, venue,
            max_participants, created_by_user_id, published_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            schoolId,
            parsed.data.wingId || null,
            parsed.data.title,
            slug,
            parsed.data.summary ?? null,
            parsed.data.description ?? null,
            parsed.data.programmeType,
            parsed.data.visibility,
            parsed.data.status,
            parsed.data.registrationRequired ? 1 : 0,
            parsed.data.startAt ?? null,
            parsed.data.endAt ?? null,
            parsed.data.venue ?? null,
            parsed.data.maxParticipants ?? null,
            req.authUser!.userId,
            publishedAt,
          ],
        });

        await writeAuditLog(client, {
          scope: 'school',
          schoolId,
          actorUserId: req.authUser!.userId,
          action: 'programme.created',
          entityType: 'programme',
          entityId: id,
          metadata: { title: parsed.data.title, status: parsed.data.status, visibility: parsed.data.visibility },
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.status(201).json({
          success: true,
          data: { id, school_id: schoolId, title: parsed.data.title, slug, status: parsed.data.status, visibility: parsed.data.visibility },
        });
      } catch {
        sendError(res, 400, 'PROGRAMME_CREATE_FAILED', 'Failed to create programme (check wing belongs to this school).');
      }
    }
  );

  router.post(
    '/school/:schoolId/programmes/:programmeId/publish',
    requireAuth,
    requireSchoolPermission('programmes.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const programmeId = String(req.params.programmeId || '').trim();
      const visibility = req.body?.visibility === 'school_only' ? 'school_only' : 'public';
      const now = new Date().toISOString();

      const result = await client.execute({
        sql: `UPDATE programmes
              SET status = 'published', visibility = ?, published_at = COALESCE(published_at, ?), updated_at = ?
              WHERE id = ? AND school_id = ? AND deleted_at IS NULL`,
        args: [visibility, now, now, programmeId, schoolId],
      });

      if (result.rowsAffected === 0) {
        sendError(res, 404, 'PROGRAMME_NOT_FOUND', 'Programme not found in this school.');
        return;
      }

      await writeAuditLog(client, {
        scope: 'school',
        schoolId,
        actorUserId: req.authUser!.userId,
        action: 'programme.published',
        entityType: 'programme',
        entityId: programmeId,
        metadata: { visibility },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({ success: true, data: { id: programmeId, status: 'published', visibility } });
    }
  );

  router.post(
    '/school/:schoolId/programmes/:programmeId/register',
    requireAuth,
    requireSchoolPermission('programmes.register'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = registerStudentForProgrammeSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const programmeId = String(req.params.programmeId || '').trim();
      const id = `preg_${crypto.randomUUID()}`;

      try {
        await client.execute({
          sql: `INSERT INTO programme_registrations (
            id, school_id, programme_id, student_id, registered_by_user_id, status, notes
          ) VALUES (?, ?, ?, ?, ?, 'approved', ?)`,
          args: [id, schoolId, programmeId, parsed.data.studentId, req.authUser!.userId, parsed.data.notes ?? null],
        });
        res.status(201).json({ success: true, data: { id, programmeId, studentId: parsed.data.studentId } });
      } catch {
        sendError(res, 400, 'REGISTRATION_FAILED', 'Student could not be registered (already registered or cross-school reference).');
      }
    }
  );

  // ---- Achievements ----
  router.get(
    '/school/:schoolId/achievements',
    requireAuth,
    requireSchoolPermission('school.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT id, school_id, title, description, achievement_level, achieved_on,
                     recipient_type, recipient_name, visibility, status, created_at
              FROM achievements
              WHERE school_id = ? AND deleted_at IS NULL
              ORDER BY created_at DESC`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/school/:schoolId/achievements',
    requireAuth,
    requireSchoolPermission('achievements.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createAchievementSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const id = `ach_${crypto.randomUUID()}`;
      try {
        await client.execute({
          sql: `INSERT INTO achievements (
            id, school_id, programme_id, wing_id, title, description, achievement_level,
            achieved_on, recipient_type, recipient_name, visibility, status, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            schoolId,
            parsed.data.programmeId || null,
            parsed.data.wingId || null,
            parsed.data.title,
            parsed.data.description ?? null,
            parsed.data.achievementLevel,
            parsed.data.achievedOn ?? new Date().toISOString().slice(0, 10),
            parsed.data.recipientType,
            parsed.data.recipientName,
            parsed.data.visibility,
            parsed.data.status,
            req.authUser!.userId,
          ],
        });
        res.status(201).json({ success: true, data: { id, title: parsed.data.title, status: parsed.data.status } });
      } catch {
        sendError(res, 400, 'ACHIEVEMENT_CREATE_FAILED', 'Failed to create achievement.');
      }
    }
  );

  // ---- News & Notices ----
  router.get(
    '/school/:schoolId/news',
    requireAuth,
    requireSchoolPermission('school.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT id, title, slug, excerpt, body_markdown, visibility, status, published_at, created_at
              FROM news_posts
              WHERE school_id = ? AND deleted_at IS NULL
              ORDER BY created_at DESC`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/school/:schoolId/news',
    requireAuth,
    requireSchoolPermission('content.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createNewsSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const id = `nws_${crypto.randomUUID()}`;
      const baseSlug = normalizeSlug(parsed.data.slug || parsed.data.title) || `news-${Date.now()}`;
      const slug = `${baseSlug}-${crypto.randomInt(100, 999)}`;
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT INTO news_posts (
          id, school_id, title, slug, excerpt, body_markdown, visibility, status, published_at, author_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          schoolId,
          parsed.data.title,
          slug,
          parsed.data.excerpt ?? null,
          parsed.data.bodyMarkdown,
          parsed.data.visibility,
          parsed.data.status,
          parsed.data.status === 'published' ? now : null,
          req.authUser!.userId,
        ],
      });

      res.status(201).json({ success: true, data: { id, title: parsed.data.title, slug, status: parsed.data.status } });
    }
  );

  router.get(
    '/school/:schoolId/notices',
    requireAuth,
    requireSchoolPermission('school.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT id, title, body, priority, audience, status, is_pinned, publish_at, created_at
              FROM notices
              WHERE school_id = ?
              ORDER BY is_pinned DESC, created_at DESC`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/school/:schoolId/notices',
    requireAuth,
    requireSchoolPermission('content.manage'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createNoticeSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      const schoolId = req.schoolAccess!.schoolId;
      const id = `not_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT INTO notices (
          id, school_id, title, body, priority, audience, wing_id, status, is_pinned, publish_at, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          schoolId,
          parsed.data.title,
          parsed.data.body,
          parsed.data.priority,
          parsed.data.audience,
          parsed.data.wingId || null,
          parsed.data.status,
          parsed.data.isPinned ? 1 : 0,
          parsed.data.status === 'published' ? now : null,
          req.authUser!.userId,
        ],
      });

      res.status(201).json({ success: true, data: { id, title: parsed.data.title, status: parsed.data.status } });
    }
  );

  // ---- Invitations & School Audit Logs ----
  router.get(
    '/school/:schoolId/invitations',
    requireAuth,
    requireSchoolPermission('users.invite'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT i.id, i.email, r.code AS role_code, r.name AS role_name,
                     i.status, i.expires_at, i.accepted_at, i.created_at
              FROM school_invitations i
              JOIN school_roles r ON r.id = i.school_role_id AND r.school_id = i.school_id
              WHERE i.school_id = ?
              ORDER BY i.created_at DESC`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  router.post(
    '/school/:schoolId/invitations',
    requireAuth,
    requireSchoolPermission('users.invite'),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createInvitationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed);
        return;
      }

      try {
        const created = await createSchoolInvitation(client, {
          schoolId: req.schoolAccess!.schoolId,
          email: parsed.data.email,
          schoolRoleCode: parsed.data.roleCode,
          invitedByUserId: req.authUser!.userId,
          expiresInHours: parsed.data.expiresInHours,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });
        res.status(201).json({ success: true, data: created });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to create invitation.';
        sendError(res, 400, 'INVITATION_CREATE_FAILED', msg);
      }
    }
  );

  router.get(
    '/school/:schoolId/audit-logs',
    requireAuth,
    requireSchoolPermission('audit.read'),
    async (req: AuthenticatedRequest, res: Response) => {
      const schoolId = req.schoolAccess!.schoolId;
      const result = await client.execute({
        sql: `SELECT a.id, a.scope, a.action, a.entity_type, a.entity_id,
                     u.email AS actor_email, a.metadata_json, a.created_at
              FROM audit_logs a
              LEFT JOIN users u ON u.id = a.actor_user_id
              WHERE a.school_id = ?
              ORDER BY a.created_at DESC
              LIMIT 100`,
        args: [schoolId],
      });
      res.json({ success: true, data: result.rows });
    }
  );

  return router;
}
