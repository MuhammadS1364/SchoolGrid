import type { SupabaseClient } from '@supabase/supabase-js';
import SupaBaseClientFunction from '../SupaBaseClient/SupaBaseClientFunction';

export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  SCHOOL: 'School',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES] | string;

export const DASHBOARD_PATHS: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: '/super-admin-dashboard',
  [ROLES.SCHOOL]: '/school-dashboard',
  [ROLES.TEACHER]: '/teacher-dashboard',
  [ROLES.STUDENT]: '/student-dashboard',
};

export interface SchoolUserProfile {
  profile_uuid: string;
  created_at?: string;
  user_uuid: string | null;
  full_name: string | null;
  school_id: string | null;
  user_role: string | null;
  is_active: boolean | null;
}

export interface RoleAccessResult {
  role: string;
  dashboardPath: string;
  schoolId: string | null;
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

  if (cleaned === 'superadmin' || cleaned === 'super_admin' || cleaned === 'admin') {
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
  if (cleaned === 'teacher' || cleaned === 'staff' || cleaned === 'faculty') {
    return ROLES.TEACHER;
  }
  if (cleaned === 'student') {
    return ROLES.STUDENT;
  }
  return rawRole.trim();
}

export function getDashboardPathForRole(role: string): string {
  return DASHBOARD_PATHS[role] ?? '/super-admin-dashboard';
}

export function inferRoleFromEmail(email?: string | null): string {
  if (!email) return ROLES.SUPER_ADMIN;
  const lower = email.trim().toLowerCase();
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

/**
 * Resolves the authenticated user's role and target dashboard by matching
 * auth.users.id (userId) against public.school_user_profile.user_uuid first,
 * then falling back to OurSchools.user_uuid, auth metadata, and email inference.
 */
export async function resolveUserRoleAccess(
  userId: string,
  userMetadataRole?: unknown,
  appMetadataRole?: unknown,
  email?: string | null,
  clientOverride?: SupabaseClient | null
): Promise<RoleAccessResult> {
  const supabase = clientOverride === undefined ? SupaBaseClientFunction() : clientOverride;

  // 1. Primary authoritative lookup: public.school_user_profile matched by user_uuid = auth.users.id
  if (supabase && userId) {
    try {
      const { data: profile, error: profileErr } = await supabase
        .from('school_user_profile')
        .select('profile_uuid, user_uuid, full_name, school_id, user_role, is_active')
        .eq('user_uuid', userId)
        .maybeSingle();

      if (!profileErr && profile) {
        const typedProfile = profile as SchoolUserProfile;
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

        return {
          role: profileRole,
          dashboardPath: getDashboardPathForRole(profileRole),
          schoolId: typedProfile.school_id ?? null,
          fullName: typedProfile.full_name ?? null,
          profileUuid: typedProfile.profile_uuid ?? null,
          isActive: true,
          source: 'school_user_profile',
        };
      }
    } catch (err) {
      // Re-throw explicit inactive-account errors; gracefully fall through on missing table / RLS
      if (err instanceof Error && err.message.includes('currently inactive')) {
        throw err;
      }
    }

    // 2. Secondary lookup: match OurSchools.user_uuid if no profile row exists yet
    try {
      const { data: schoolRow, error: schoolErr } = await supabase
        .from('OurSchools')
        .select('school_id, school_manager')
        .eq('user_uuid', userId)
        .maybeSingle();

      if (!schoolErr && schoolRow) {
        const typedSchool = schoolRow as { school_id: string; school_manager?: string | null };
        return {
          role: ROLES.SCHOOL,
          dashboardPath: DASHBOARD_PATHS[ROLES.SCHOOL],
          schoolId: typedSchool.school_id ?? null,
          fullName: typedSchool.school_manager ?? null,
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
      role: metaRole,
      dashboardPath: getDashboardPathForRole(metaRole),
      schoolId: null,
      fullName: null,
      profileUuid: null,
      isActive: true,
      source: 'metadata',
    };
  }

  const inferred = inferRoleFromEmail(email);
  return {
    role: inferred,
    dashboardPath: getDashboardPathForRole(inferred),
    schoolId: null,
    fullName: null,
    profileUuid: null,
    isActive: true,
    source: 'email_fallback',
  };
}
