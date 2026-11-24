import type { SupabaseClient } from '@supabase/supabase-js';
import SupaBaseClientFunction from '../SupaBaseClient/SupaBaseClientFunction';

export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  SCHOOL: 'School',
  WING: 'Wing',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES] | string;

export const DASHBOARD_PATHS: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: '/super-admin-dashboard',
  [ROLES.SCHOOL]: '/school-dashboard',
  [ROLES.WING]: '/wing-dashboard',
  [ROLES.TEACHER]: '/teacher-dashboard',
  [ROLES.STUDENT]: '/student-dashboard',
};

export interface SchoolUserProfile {
  profile_uuid: string;
  created_at?: string;
  user_uuid: string | null;
  full_name: string | null;
  school_id?: string | null;
  user_role: string | null;
  is_active: boolean | null;
}

export interface RoleAccessResult {
  userId: string;
  role: string;
  dashboardPath: string;
  schoolId: string | null;
  teacherId?: string | null;
  studentAddNo?: string | null;
  classId?: string | null;
  fullName: string | null;
  profileUuid: string | null;
  isActive: boolean;
  source: 'school_user_profile' | 'our_schools' | 'metadata' | 'email_fallback';
}

export function isGmailAddress(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex === -1) return false;
  const domain = normalized.slice(atIndex + 1);
  return domain === 'gmail.com' || domain === 'googlemail.com';
}

export function normalizeRole(rawRole?: unknown): string | null {
  if (typeof rawRole !== 'string') return null;
  const cleaned = rawRole.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!cleaned) return null;

  if (cleaned === 'superadmin' || cleaned === 'super_admin' || cleaned === 'superadmi' || cleaned === 'admin') {
    return ROLES.SUPER_ADMIN;
  }
  if (
    cleaned === 'school' ||
    cleaned === 'schooladmin' ||
    cleaned === 'school_admin' ||
    cleaned === 'principal'
  ) {
    return ROLES.SCHOOL;
  }
  if (
    cleaned === 'wing' ||
    cleaned === 'wing_manager' ||
    cleaned === 'wingmanager' ||
    cleaned === 'wing_admin' ||
    cleaned === 'content_manager' ||
    cleaned === 'coordinator'
  ) {
    return ROLES.WING;
  }
  if (cleaned === 'teacher' || cleaned === 'staff' || cleaned === 'faculty') {
    return ROLES.TEACHER;
  }
  if (cleaned === 'student') {
    return ROLES.STUDENT;
  }
  return rawRole.trim();
}

export function getDashboardPathForRole(role: string): string {
  return DASHBOARD_PATHS[role] ?? '/school-dashboard';
}

export function canAccessDashboard(
  role: string | null | undefined,
  requiredArea: 'SuperAdmin' | 'School' | 'Wing' | 'Teacher' | 'Student'
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (normalized === ROLES.SUPER_ADMIN) return true;
  if (requiredArea === 'SuperAdmin') return false;
  if (requiredArea === 'School') return normalized === ROLES.SCHOOL;
  if (requiredArea === 'Wing') return normalized === ROLES.WING || normalized === ROLES.SCHOOL;
  if (requiredArea === 'Teacher') return normalized === ROLES.TEACHER;
  if (requiredArea === 'Student') return normalized === ROLES.STUDENT;
  return false;
}

export function inferRoleFromEmail(email?: string | null): string {
  if (!email) return ROLES.SCHOOL;
  const lower = email.trim().toLowerCase();
  if (lower.startsWith('superadmin') || lower.startsWith('admin@')) {
    return ROLES.SUPER_ADMIN;
  }
  if (lower.startsWith('wing') || lower.includes('.wing@')) {
    return ROLES.WING;
  }
  if (lower.startsWith('teacher') || lower.includes('.teacher@')) {
    return ROLES.TEACHER;
  }
  if (lower.startsWith('student') || lower.includes('.student@')) {
    return ROLES.STUDENT;
  }
  if (
    lower.startsWith('school') ||
    lower.includes('principal') ||
    lower.includes('academy') ||
    lower.includes('vidyalaya')
  ) {
    return ROLES.SCHOOL;
  }
  return ROLES.SUPER_ADMIN;
}

interface LinkedSchoolResolution {
  schoolId: string | null;
  inferredRole: string | null;
  teacherId: string | null;
  studentAddNo: string | null;
  classId: string | null;
  fullName: string | null;
}

/**
 * Resolves the school_id (and entity IDs) for any logged-in school member
 * (School, Wing, Teacher, Student, etc.) across Supabase tables + optional Turso membership.
 */
async function resolveLinkedSchoolForUser(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
  preferredRole?: string | null,
  accessToken?: string | null
): Promise<LinkedSchoolResolution> {
  const normalizedEmail = email?.trim().toLowerCase() || null;
  let schoolId: string | null = null;
  let inferredRole: string | null = null;
  let teacherId: string | null = null;
  let studentAddNo: string | null = null;
  let classId: string | null = null;
  let fullName: string | null = null;

  const checkOurSchools = async () => {
    const { data: byUuid } = await supabase
      .from('OurSchools')
      .select('school_id, school_manager')
      .eq('user_uuid', userId)
      .maybeSingle();
    if (byUuid) {
      const row = byUuid as { school_id?: string; school_manager?: string | null };
      if (row.school_id) {
        schoolId = row.school_id;
        inferredRole = inferredRole ?? ROLES.SCHOOL;
        fullName = fullName ?? row.school_manager ?? null;
        return true;
      }
    }
    if (normalizedEmail) {
      const { data: byEmail } = await supabase
        .from('OurSchools')
        .select('school_id, school_manager')
        .eq('schoole_gmail', normalizedEmail)
        .maybeSingle();
      if (byEmail) {
        const row = byEmail as { school_id?: string; school_manager?: string | null };
        if (row.school_id) {
          schoolId = row.school_id;
          inferredRole = inferredRole ?? ROLES.SCHOOL;
          fullName = fullName ?? row.school_manager ?? null;
          return true;
        }
      }
    }
    return false;
  };

  const checkTeachers = async () => {
    const { data: byUuid } = await supabase
      .from('SchoolTeachers')
      .select('teacher_id, school_id, class_id, teacher_full_name')
      .eq('user_id', userId)
      .maybeSingle();
    if (byUuid) {
      const row = byUuid as {
        teacher_id?: string;
        school_id?: string;
        class_id?: string | null;
        teacher_full_name?: string | null;
      };
      if (row.school_id) {
        schoolId = row.school_id;
        teacherId = row.teacher_id ?? null;
        classId = row.class_id ?? null;
        inferredRole = inferredRole ?? ROLES.TEACHER;
        fullName = fullName ?? row.teacher_full_name ?? null;
        return true;
      }
    }
    if (normalizedEmail) {
      const { data: byEmail } = await supabase
        .from('SchoolTeachers')
        .select('teacher_id, school_id, class_id, teacher_full_name')
        .eq('teacher_email', normalizedEmail)
        .maybeSingle();
      if (byEmail) {
        const row = byEmail as {
          teacher_id?: string;
          school_id?: string;
          class_id?: string | null;
          teacher_full_name?: string | null;
        };
        if (row.school_id) {
          schoolId = row.school_id;
          teacherId = row.teacher_id ?? null;
          classId = row.class_id ?? null;
          inferredRole = inferredRole ?? ROLES.TEACHER;
          fullName = fullName ?? row.teacher_full_name ?? null;
          return true;
        }
      }
    }
    return false;
  };

  const checkStudents = async () => {
    const { data: byUuid } = await supabase
      .from('StudentsBox')
      .select('AddNo, school_id, Stn_Class, StudentName')
      .eq('stn_user_id', userId)
      .maybeSingle();
    if (byUuid) {
      const row = byUuid as {
        AddNo?: string;
        school_id?: string;
        Stn_Class?: string | null;
        StudentName?: string | null;
      };
      if (row.school_id) {
        schoolId = row.school_id;
        studentAddNo = row.AddNo ?? null;
        classId = row.Stn_Class ?? null;
        inferredRole = inferredRole ?? ROLES.STUDENT;
        fullName = fullName ?? row.StudentName ?? null;
        return true;
      }
    }
    if (normalizedEmail) {
      const { data: byEmail } = await supabase
        .from('StudentsBox')
        .select('AddNo, school_id, Stn_Class, StudentName')
        .eq('StudentEmail', normalizedEmail)
        .maybeSingle();
      if (byEmail) {
        const row = byEmail as {
          AddNo?: string;
          school_id?: string;
          Stn_Class?: string | null;
          StudentName?: string | null;
        };
        if (row.school_id) {
          schoolId = row.school_id;
          studentAddNo = row.AddNo ?? null;
          classId = row.Stn_Class ?? null;
          inferredRole = inferredRole ?? ROLES.STUDENT;
          fullName = fullName ?? row.StudentName ?? null;
          return true;
        }
      }
    }
    return false;
  };

  const checkLegacyProfileSchool = async () => {
    const { data } = await supabase
      .from('school_user_profile')
      .select('school_id, full_name')
      .eq('user_uuid', userId)
      .maybeSingle();
    const row = data as { school_id?: string | null; full_name?: string | null } | null;
    if (row?.school_id) {
      schoolId = row.school_id;
      fullName = fullName ?? row.full_name ?? null;
      return true;
    }
    return false;
  };

  // Run the most likely table first based on preferredRole, then fall through all school-member tables
  const checks: Array<() => Promise<boolean>> =
    preferredRole === ROLES.TEACHER
      ? [checkTeachers, checkOurSchools, checkStudents, checkLegacyProfileSchool]
      : preferredRole === ROLES.STUDENT
        ? [checkStudents, checkTeachers, checkOurSchools, checkLegacyProfileSchool]
        : [checkOurSchools, checkTeachers, checkStudents, checkLegacyProfileSchool];

  for (const runCheck of checks) {
    try {
      if (await runCheck()) break;
    } catch {
      // Ignore individual table errors (e.g., if optional table doesn't exist)
    }
  }

  // Final check: Turso server memberships (covers Wing Managers, Content Managers, invited school staff)
  if (!schoolId && accessToken && typeof fetch === 'function') {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          success?: boolean;
          data?: {
            memberships?: Array<{ school_id?: string; role_codes?: string[] }>;
          };
        };
        const firstMembership = payload.data?.memberships?.find((m) => m.school_id);
        if (firstMembership?.school_id) {
          schoolId = firstMembership.school_id;
          if (!inferredRole && firstMembership.role_codes?.length) {
            inferredRole = normalizeRole(firstMembership.role_codes[0]) ?? ROLES.WING;
          }
        }
      }
    } catch {
      // Ignore network/SSR errors
    }
  }

  return {
    schoolId,
    inferredRole,
    teacherId,
    studentAddNo,
    classId,
    fullName,
  };
}

/**
 * Resolves the authenticated user's id (`userId`), role, linked `schoolId`, and target dashboard:
 * 1. Matches Supabase `auth.users.id` against `public.school_user_info.user_uuid`
 *    (with legacy fallback to `public.school_user_profile`).
 * 2. For every non-SuperAdmin member (School, Wing, Teacher, Student, etc.), ALWAYS resolves
 *    their linked `school_id` across `OurSchools`, `SchoolTeachers`, `StudentsBox`,
 *    `school_user_profile`, and Turso memberships.
 */
export async function resolveUserRoleAccess(
  userId: string,
  userMetadataRole?: unknown,
  appMetadataRole?: unknown,
  email?: string | null,
  clientOverride?: SupabaseClient | null,
  options?: { accessToken?: string | null; metadataSchoolId?: string | null }
): Promise<RoleAccessResult> {
  const supabase = clientOverride === undefined ? SupaBaseClientFunction() : clientOverride;
  const accessToken = options?.accessToken ?? null;
  const metaSchoolId = options?.metadataSchoolId?.trim() || null;

  // 1. Primary authoritative lookup: public.school_user_info matched by user_uuid = auth.users.id
  if (supabase && userId) {
    for (const profileTable of ['school_user_info', 'school_user_profile'] as const) {
      try {
        const selectCols =
          profileTable === 'school_user_info'
            ? 'profile_uuid, user_uuid, full_name, user_role, is_active'
            : 'profile_uuid, user_uuid, full_name, school_id, user_role, is_active';
        const { data: profile, error: profileErr } = await supabase
          .from(profileTable)
          .select(selectCols)
          .eq('user_uuid', userId)
          .maybeSingle();

        if (!profileErr && profile) {
          const typedProfile = profile as unknown as SchoolUserProfile;
          if (typedProfile.is_active === false) {
            throw new Error(
              'Your SchoolGrid account is currently inactive. Please contact SuperAdmin or your School Administrator.'
            );
          }

          const profileRole =
            normalizeRole(typedProfile.user_role) ??
            normalizeRole(appMetadataRole) ??
            normalizeRole(userMetadataRole) ??
            inferRoleFromEmail(email);

          // SuperAdmin operates across the full platform database (not locked to one school)
          if (profileRole === ROLES.SUPER_ADMIN) {
            return {
              userId,
              role: ROLES.SUPER_ADMIN,
              dashboardPath: DASHBOARD_PATHS[ROLES.SUPER_ADMIN],
              schoolId: null,
              teacherId: null,
              studentAddNo: null,
              classId: null,
              fullName: typedProfile.full_name ?? null,
              profileUuid: typedProfile.profile_uuid ?? null,
              isActive: true,
              source: 'school_user_profile',
            };
          }

          // Every non-SuperAdmin user must resolve their school_id (School, Wing, Teacher, Student, etc.)
          const linked = await resolveLinkedSchoolForUser(
            supabase,
            userId,
            email,
            profileRole,
            accessToken
          );
          const resolvedSchoolId = typedProfile.school_id ?? linked.schoolId ?? metaSchoolId ?? null;

          return {
            userId,
            role: profileRole,
            dashboardPath: getDashboardPathForRole(profileRole),
            schoolId: resolvedSchoolId,
            teacherId: linked.teacherId,
            studentAddNo: linked.studentAddNo,
            classId: linked.classId,
            fullName: typedProfile.full_name ?? linked.fullName ?? null,
            profileUuid: typedProfile.profile_uuid ?? null,
            isActive: true,
            source: 'school_user_profile',
          };
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('currently inactive')) {
          throw err;
        }
      }
    }

    // 2. Secondary lookup: directly match OurSchools, SchoolTeachers, StudentsBox, or Turso memberships
    try {
      const linked = await resolveLinkedSchoolForUser(
        supabase,
        userId,
        email,
        normalizeRole(appMetadataRole) ?? normalizeRole(userMetadataRole),
        accessToken
      );
      if (linked.schoolId) {
        const resolvedRole =
          normalizeRole(appMetadataRole) ??
          normalizeRole(userMetadataRole) ??
          linked.inferredRole ??
          ROLES.SCHOOL;
        return {
          userId,
          role: resolvedRole,
          dashboardPath: getDashboardPathForRole(resolvedRole),
          schoolId: linked.schoolId,
          teacherId: linked.teacherId,
          studentAddNo: linked.studentAddNo,
          classId: linked.classId,
          fullName: linked.fullName,
          profileUuid: null,
          isActive: true,
          source: 'our_schools',
        };
      }
    } catch {
      // Fall through to metadata/email fallback
    }
  }

  // 3. Fallback to Supabase auth metadata or email inference
  const metaRole = normalizeRole(appMetadataRole) ?? normalizeRole(userMetadataRole);
  if (metaRole) {
    return {
      userId,
      role: metaRole,
      dashboardPath: getDashboardPathForRole(metaRole),
      schoolId: metaRole === ROLES.SUPER_ADMIN ? null : metaSchoolId,
      fullName: null,
      profileUuid: null,
      isActive: true,
      source: 'metadata',
    };
  }

  const inferred = inferRoleFromEmail(email);
  return {
    userId,
    role: inferred,
    dashboardPath: getDashboardPathForRole(inferred),
    schoolId: inferred === ROLES.SUPER_ADMIN ? null : metaSchoolId,
    fullName: null,
    profileUuid: null,
    isActive: true,
    source: 'email_fallback',
  };
}
