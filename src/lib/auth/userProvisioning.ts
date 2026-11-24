import { createClient } from '@supabase/supabase-js';
import SupaBaseClientFunction, {
  formatSupabaseError,
  isUsingMockSupabase,
} from '../SupaBaseClient/SupaBaseClientFunction';
import { ROLES } from './roleResolver';

export type ProvisionableRole = 'SuperAdmin' | 'School' | 'Teacher' | 'Student';

export const PROVISIONABLE_ROLES: ProvisionableRole[] = [
  'SuperAdmin',
  'School',
  'Teacher',
  'Student',
];

export interface ProvisionUserInput {
  email: string;
  password: string;
  fullName: string;
  role: ProvisionableRole;
  schoolId?: string | null;
}

export interface ProvisionUserResult {
  user_uuid: string;
  profile_uuid: string | null;
  email: string;
  user_role: ProvisionableRole;
  full_name: string;
  provider: 'server_admin' | 'client_signup' | 'mock';
}

export function normalizeProvisionableRole(raw: string): ProvisionableRole {
  const cleaned = raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (cleaned === 'superadmin' || cleaned === 'superadmi') return 'SuperAdmin';
  if (cleaned === 'school' || cleaned === 'schooladmin') return 'School';
  if (cleaned === 'teacher') return 'Teacher';
  if (cleaned === 'student') return 'Student';
  throw new Error(
    `Invalid role "${raw}". Expected one of: SuperAdmin, School, Teacher, Student.`
  );
}

export function validateProvisionUserInput(input: ProvisionUserInput): {
  email: string;
  password: string;
  fullName: string;
  role: ProvisionableRole;
} {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const fullName = input.fullName.trim();
  const role = normalizeProvisionableRole(input.role);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required to create the user account.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  if (!fullName) {
    throw new Error('Full name is required.');
  }
  return { email, password, fullName, role };
}

async function hashPasswordClientSide(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const saltBytes = new Uint8Array(12);
    crypto.getRandomValues(saltBytes);
    const saltHex = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const data = new TextEncoder().encode(`${saltHex}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256$${saltHex}$${hashHex}`;
  }
  return `protected$${Date.now()}`;
}

/**
 * Step 1 + Step 2 of the unified document creation flow:
 * 1. Creates a new user in Supabase auth.users and captures `id` as `user_uuid`.
 * 2. Inserts a row into `public.school_user_info` with `user_uuid`, `full_name`,
 *    hashed `user_password`, `user_role` (SuperAdmin | School | Teacher | Student), and `is_active = true`.
 *
 * Uses the server-side admin route when configured (never logs out the active admin),
 * or an isolated non-persisting Supabase client fallback when running as a static SPA.
 */
export async function provisionSupabaseAccountAndProfile(
  rawInput: ProvisionUserInput
): Promise<ProvisionUserResult> {
  const { email, password, fullName, role } = validateProvisionUserInput(rawInput);

  // 0. Sandbox / mock mode
  if (isUsingMockSupabase()) {
    const supabase = SupaBaseClientFunction();
    const userUuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const hashedPassword = await hashPasswordClientSide(password);

    const { data: inserted } = await supabase
      .from('school_user_info')
      .insert([
        {
          user_uuid: userUuid,
          full_name: fullName,
          user_password: hashedPassword,
          user_role: role,
          is_active: true,
        },
      ])
      .select();

    const profileRow = (inserted?.[0] as { profile_uuid?: string } | undefined) ?? null;

    return {
      user_uuid: userUuid,
      profile_uuid: profileRow?.profile_uuid ?? null,
      email,
      user_role: role,
      full_name: fullName,
      provider: 'mock',
    };
  }

  // 1. Try server-side admin provisioning endpoint first (preserves current admin session)
  try {
    const supabase = SupaBaseClientFunction();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const response = await fetch('/api/supabase/provision-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        user_role: role,
        school_id: rawInput.schoolId ?? null,
      }),
    });

    if (response.ok) {
      const json = (await response.json()) as {
        success?: boolean;
        data?: {
          user_uuid: string;
          profile_uuid?: string | null;
          email: string;
          user_role: ProvisionableRole;
          full_name: string;
        };
      };
      if (json.success && json.data?.user_uuid) {
        return {
          user_uuid: json.data.user_uuid,
          profile_uuid: json.data.profile_uuid ?? null,
          email: json.data.email,
          user_role: json.data.user_role,
          full_name: json.data.full_name,
          provider: 'server_admin',
        };
      }
    } else if (response.status >= 400 && response.status < 500 && response.status !== 404) {
      const errJson = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      // Fall through to client signup only if backend admin key isn't configured
      if (errJson?.error?.code && errJson.error.code !== 'SUPABASE_ADMIN_UNCONFIGURED') {
        throw new Error(errJson.error.message || 'User provisioning rejected by server.');
      }
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes('Failed to fetch')) {
      // Re-throw explicit validation/permission errors from backend
      if (
        err.message.includes('already') ||
        err.message.includes('Permission') ||
        err.message.includes('Invalid')
      ) {
        throw err;
      }
    }
  }

  // 2. Fallback: isolated ephemeral Supabase client (persistSession: false)
  // Creates the auth.users row without overwriting the logged-in SuperAdmin/School Admin session!
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const supabaseUrl = metaEnv.VITE_SUPABASE_URL ?? '';
  const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY ?? '';

  const ephemeralClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: signUpData, error: signUpErr } = await ephemeralClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: fullName,
        ...(rawInput.schoolId ? { school_id: rawInput.schoolId } : {}),
      },
    },
  });

  if (signUpErr) {
    throw new Error(
      formatSupabaseError(signUpErr, 'Could not create auth user account in Supabase.')
    );
  }

  const newUserId = signUpData.user?.id;
  if (!newUserId) {
    throw new Error(
      'Supabase Auth did not return a user ID. Ensure this email is not already registered.'
    );
  }

  // Insert into public.school_user_info linking user_uuid -> auth.users.id
  const hashedPassword = await hashPasswordClientSide(password);
  const activeClient = SupaBaseClientFunction();
  let profileUuid: string | null = null;

  const { data: infoData, error: infoErr } = await activeClient
    .from('school_user_info')
    .insert([
      {
        user_uuid: newUserId,
        full_name: fullName,
        user_password: hashedPassword,
        user_role: role,
        is_active: true,
      },
    ])
    .select();

  if (!infoErr && infoData?.[0]) {
    profileUuid = (infoData[0] as { profile_uuid?: string }).profile_uuid ?? null;
  } else if (infoErr) {
    // Also attempt legacy school_user_profile if school_user_info hasn't been created yet
    const msg = String(infoErr.message || '').toLowerCase();
    if (msg.includes('could not find') || msg.includes('does not exist')) {
      const { data: legacyData } = await activeClient
        .from('school_user_profile')
        .insert([
          {
            user_uuid: newUserId,
            full_name: fullName,
            school_id: rawInput.schoolId ?? null,
            user_role: role,
            is_active: true,
          },
        ])
        .select();
      profileUuid = (legacyData?.[0] as { profile_uuid?: string } | undefined)?.profile_uuid ?? null;
    } else {
      throw new Error(
        formatSupabaseError(
          infoErr,
          'Auth user created, but saving school_user_info failed. Check your RLS INSERT policy on school_user_info.'
        )
      );
    }
  }

  return {
    user_uuid: newUserId,
    profile_uuid: profileUuid,
    email,
    user_role: role,
    full_name: fullName,
    provider: 'client_signup',
  };
}

// ============================================================================
// Pure Schema Payload Builders matching the exact ERD & SQL Tables
// ============================================================================

export function buildSchoolAndInfoPayloads(input: {
  school_title: string;
  school_manager?: string | null;
  is_private?: boolean;
  loc_state?: string | null;
  loc_district?: string | null;
  loc_city_village?: string | null;
  local_address?: string | null;
  user_uuid: string;
  schoole_gmail: string;
  school_type?: string | null;
  is_approved?: boolean;
  logo_url?: string | null;
  // SchoolInfo fields
  total_class?: number;
  primery_class_fee?: number;
  seconday_class_fee?: number;
  insta_id_link?: string | null;
  facebook_link?: string | null;
  youtube_link?: string | null;
  is_computer_lab?: boolean;
  is_library?: boolean;
  about_school?: string | null;
  school_vission?: string | null;
  school_mission?: string | null;
}) {
  if (!input.school_title.trim()) {
    throw new Error('School title is required.');
  }
  if (!input.user_uuid.trim()) {
    throw new Error('user_uuid (from auth.users.id) is required when creating a school.');
  }
  if (!input.schoole_gmail.trim()) {
    throw new Error('School email (schoole_gmail) is required.');
  }

  const ourSchoolsRow = {
    school_title: input.school_title.trim(),
    school_manager: input.school_manager?.trim() || null,
    is_private: input.is_private ?? true,
    loc_state: input.loc_state?.trim() || null,
    loc_district: input.loc_district?.trim() || null,
    loc_city_village: input.loc_city_village?.trim() || null,
    local_address: input.local_address?.trim() || null,
    user_uuid: input.user_uuid.trim(),
    schoole_gmail: input.schoole_gmail.trim().toLowerCase(),
    school_type: input.school_type?.trim() || 'Senior Secondary',
    is_approved: input.is_approved ?? false,
    logo_url: input.logo_url?.trim() || null,
  };

  const buildSchoolInfoRow = (schoolId: string) => ({
    school_id: schoolId,
    total_class: Number.isFinite(input.total_class) ? Number(input.total_class) : 5,
    primery_class_fee: Number.isFinite(input.primery_class_fee)
      ? Number(input.primery_class_fee)
      : 550,
    seconday_class_fee: Number.isFinite(input.seconday_class_fee)
      ? Number(input.seconday_class_fee)
      : 750,
    insta_id_link: input.insta_id_link?.trim() || null,
    facebook_link: input.facebook_link?.trim() || null,
    youtube_link: input.youtube_link?.trim() || null,
    is_computer_lab: Boolean(input.is_computer_lab),
    is_library: Boolean(input.is_library),
    about_school: input.about_school?.trim() || null,
    school_vission: input.school_vission?.trim() || null,
    school_mission: input.school_mission?.trim() || null,
  });

  return { ourSchoolsRow, buildSchoolInfoRow };
}

export function buildTeacherInsertPayload(input: {
  school_id: string;
  user_id: string;
  teacher_full_name: string;
  teacher_email: string;
  teacher_contact?: string | null;
  class_id?: string | null;
  is_active?: boolean;
  monthly_wage?: number;
  joined_at?: string | null;
  left_at?: string | null;
  teacher_img?: string | null;
}) {
  if (!input.school_id?.trim()) {
    throw new Error('school_id is required to create a teacher in SchoolTeachers.');
  }
  if (!input.user_id?.trim()) {
    throw new Error('user_id (auth.users.id) is required to create a teacher in SchoolTeachers.');
  }
  if (!input.teacher_full_name?.trim()) {
    throw new Error('Teacher full name is required.');
  }

  return {
    school_id: input.school_id.trim(),
    user_id: input.user_id.trim(),
    teacher_full_name: input.teacher_full_name.trim(),
    teacher_email: input.teacher_email.trim().toLowerCase(),
    teacher_contact: input.teacher_contact?.trim() || null,
    class_id: input.class_id?.trim() || null,
    is_active: input.is_active ?? true,
    monthly_wage: Number.isFinite(input.monthly_wage) ? Number(input.monthly_wage) : 5500,
    joined_at: input.joined_at?.trim() || new Date().toISOString().slice(0, 10),
    left_at: input.left_at?.trim() || null,
    teacher_img: input.teacher_img?.trim() || null,
  };
}

export function buildStudentInsertPayload(input: {
  AddNo: string;
  school_id: string;
  stn_user_id: string;
  StudentName: string;
  StudentEmail: string;
  FatherName?: string | null;
  StnState?: string | null;
  StnDistrict?: string | null;
  Stn_Class?: string | null;
  Stn_Dob?: string | null;
  Student_Photo_Urls?: string | null;
  IsActive?: boolean;
}) {
  if (!input.AddNo?.trim()) {
    throw new Error('Admission Number (AddNo) is required for StudentsBox.');
  }
  if (!input.school_id?.trim()) {
    throw new Error('school_id is required to create a student in StudentsBox.');
  }
  if (!input.stn_user_id?.trim()) {
    throw new Error('stn_user_id (auth.users.id) is required to create a student in StudentsBox.');
  }
  if (!input.StudentName?.trim()) {
    throw new Error('StudentName is required.');
  }

  return {
    AddNo: input.AddNo.trim(),
    StudentName: input.StudentName.trim(),
    StudentEmail: input.StudentEmail.trim().toLowerCase(),
    FatherName: input.FatherName?.trim() || null,
    school_id: input.school_id.trim(),
    stn_user_id: input.stn_user_id.trim(),
    Registration_Count: 0,
    Resluted_Count: 0,
    Total_Point: 0,
    OutReach_Count: 0,
    OutReach_Points: 0,
    Achievements_Counts: 0,
    Achievements_Points: 0,
    Grand_Total_Points: 0,
    IsActive: input.IsActive ?? true,
    Student_Photo_Urls: input.Student_Photo_Urls?.trim() || null,
    StnState: input.StnState?.trim() || '',
    StnDistrict: input.StnDistrict?.trim() || '',
    Stn_Class: input.Stn_Class?.trim() || null,
    Stn_Dob: input.Stn_Dob?.trim() || null,
  };
}

export { ROLES };
