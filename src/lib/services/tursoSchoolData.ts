import SupaBaseClientFunction, {
  isUsingMockSupabase,
} from '../SupaBaseClient/SupaBaseClientFunction';

export interface TursoSchoolInfo {
  school_info_id: string;
  created_at: string;
  school_id: string;
  total_class: number;
  primery_class_fee: number;
  seconday_class_fee: number;
  insta_id_link: string | null;
  facebook_link: string | null;
  youtube_link: string | null;
  is_computer_lab: 0 | 1;
  is_library: 0 | 1;
  about_school: string | null;
  school_vission: string | null;
  school_mission: string | null;
}

export interface TursoSchoolClass {
  class_id: string;
  created_at: string;
  school_id?: string | null;
  class_title: string;
  class_teacher_id: string | null;
  total_students: number;
  sub_title: string;
  is_active: 0 | 1;
}

export function toSqliteBit(val: unknown): 0 | 1 {
  if (val === true || val === 1 || val === '1') return 1;
  return 0;
}

export function normalizeTursoSchoolInfo(
  raw: Record<string, unknown> | null | undefined
): TursoSchoolInfo | null {
  if (!raw) return null;
  return {
    school_info_id: String(raw.school_info_id ?? ''),
    created_at: String(raw.created_at ?? ''),
    school_id: String(raw.school_id ?? ''),
    total_class: Number(raw.total_class ?? 5),
    primery_class_fee: Number(raw.primery_class_fee ?? 550),
    seconday_class_fee: Number(raw.seconday_class_fee ?? 750),
    insta_id_link: raw.insta_id_link ? String(raw.insta_id_link) : null,
    facebook_link: raw.facebook_link ? String(raw.facebook_link) : null,
    youtube_link: raw.youtube_link ? String(raw.youtube_link) : null,
    is_computer_lab: toSqliteBit(raw.is_computer_lab),
    is_library: toSqliteBit(raw.is_library),
    about_school: raw.about_school ? String(raw.about_school) : null,
    school_vission: raw.school_vission ? String(raw.school_vission) : null,
    school_mission: raw.school_mission ? String(raw.school_mission) : null,
  };
}

export function normalizeTursoSchoolClass(
  raw: Record<string, unknown>
): TursoSchoolClass {
  return {
    class_id: String(raw.class_id ?? ''),
    created_at: String(raw.created_at ?? ''),
    school_id: raw.school_id ? String(raw.school_id) : null,
    class_title: String(raw.class_title ?? raw.class_name ?? 'Seconday First Year'),
    class_teacher_id: raw.class_teacher_id ? String(raw.class_teacher_id) : null,
    total_students: Number(raw.total_students ?? raw.capacity ?? 0),
    sub_title: String(raw.sub_title ?? raw.wing ?? 'U1'),
    is_active: raw.is_active === undefined ? 1 : toSqliteBit(raw.is_active),
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const supabase = SupaBaseClientFunction();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // Ignore session lookup errors
  }
  return headers;
}

export async function fetchTursoSchoolInfo(schoolId: string): Promise<TursoSchoolInfo | null> {
  if (!schoolId) return null;

  // 1. Primary: Turso via Express API
  if (!isUsingMockSupabase()) {
    try {
      const res = await fetch(`/api/turso/school-info/${encodeURIComponent(schoolId)}`);
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> | null };
        if (json.success && json.data) {
          return normalizeTursoSchoolInfo(json.data);
        }
      }
    } catch {
      // Fallback below
    }
  }

  // 2. Fallback: mock / Supabase SchoolInfo table if present
  try {
    const supabase = SupaBaseClientFunction();
    const { data, error } = await supabase
      .from('SchoolInfo')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();
    if (!error && data) {
      return normalizeTursoSchoolInfo(data as unknown as Record<string, unknown>);
    }
  } catch {
    // Ignore fallback error
  }

  return null;
}

export async function saveTursoSchoolInfo(
  schoolId: string,
  payload: Partial<Omit<TursoSchoolInfo, 'school_info_id' | 'created_at' | 'school_id'>>
): Promise<TursoSchoolInfo | null> {
  if (!schoolId) return null;

  const normalizedPayload = {
    total_class: Number(payload.total_class ?? 5),
    primery_class_fee: Number(payload.primery_class_fee ?? 550),
    seconday_class_fee: Number(payload.seconday_class_fee ?? 750),
    insta_id_link: payload.insta_id_link ?? null,
    facebook_link: payload.facebook_link ?? null,
    youtube_link: payload.youtube_link ?? null,
    is_computer_lab: toSqliteBit(payload.is_computer_lab),
    is_library: toSqliteBit(payload.is_library),
    about_school: payload.about_school ?? null,
    school_vission: payload.school_vission ?? null,
    school_mission: payload.school_mission ?? null,
  };

  if (!isUsingMockSupabase()) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/turso/school-info/${encodeURIComponent(schoolId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(normalizedPayload),
      });
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> | null };
        if (json.success && json.data) {
          return normalizeTursoSchoolInfo(json.data);
        }
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for sandbox/mock mode
  try {
    const supabase = SupaBaseClientFunction();
    const { data: existing } = await supabase
      .from('SchoolInfo')
      .select('school_info_id')
      .eq('school_id', schoolId)
      .maybeSingle();

    const rowData = {
      school_id: schoolId,
      ...normalizedPayload,
      is_computer_lab: normalizedPayload.is_computer_lab === 1,
      is_library: normalizedPayload.is_library === 1,
    };

    if (existing && (existing as { school_info_id?: string }).school_info_id) {
      const { data } = await supabase
        .from('SchoolInfo')
        .update(rowData)
        .eq('school_id', schoolId)
        .select();
      return normalizeTursoSchoolInfo(data?.[0] as unknown as Record<string, unknown>);
    }
    const { data } = await supabase.from('SchoolInfo').insert([rowData]).select();
    return normalizeTursoSchoolInfo(data?.[0] as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function fetchTursoSchoolClasses(params: {
  schoolId?: string | null;
  teacherIds?: string[];
  classId?: string | null;
}): Promise<TursoSchoolClass[]> {
  if (!isUsingMockSupabase()) {
    try {
      const qs = new URLSearchParams();
      if (params.classId) qs.set('classId', params.classId);
      if (params.schoolId) qs.set('schoolId', params.schoolId);
      if (params.teacherIds && params.teacherIds.length > 0) {
        qs.set('teacherIds', params.teacherIds.join(','));
      }
      const res = await fetch(`/api/turso/school-classes?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as {
          success?: boolean;
          data?: Array<Record<string, unknown>>;
        };
        if (json.success && Array.isArray(json.data)) {
          return json.data.map(normalizeTursoSchoolClass);
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback for sandbox/mock mode
  try {
    const supabase = SupaBaseClientFunction();
    let query = supabase.from('SchoolClasses').select('*');
    if (params.classId) {
      query = query.eq('class_id', params.classId);
    } else if (params.schoolId) {
      query = query.eq('school_id', params.schoolId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return (data as Array<Record<string, unknown>>).map(normalizeTursoSchoolClass);
    }
  } catch {
    // Ignore
  }

  return [];
}

export async function createTursoSchoolClass(input: {
  school_id?: string | null;
  class_title: string;
  class_teacher_id?: string | null;
  total_students?: number;
  sub_title?: string;
  is_active?: boolean | 0 | 1;
}): Promise<{ data: TursoSchoolClass | null; error: string | null }> {
  const payload = {
    school_id: input.school_id ?? null,
    class_title: input.class_title.trim() || 'Seconday First Year',
    class_teacher_id: input.class_teacher_id?.trim() || null,
    total_students: Number(input.total_students ?? 0),
    sub_title: input.sub_title?.trim() || 'U1',
    is_active: toSqliteBit(input.is_active ?? 1),
  };

  if (!isUsingMockSupabase()) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/turso/school-classes', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: Record<string, unknown>;
        error?: { message?: string };
      } | null;
      if (res.ok && json?.success && json.data) {
        return { data: normalizeTursoSchoolClass(json.data), error: null };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          data: null,
          error: json?.error?.message || 'Sign in to create classes in Turso.',
        };
      }
    } catch {
      // Fall through to sandbox fallback
    }
  }

  const supabase = SupaBaseClientFunction();
  const { data, error } = await supabase
    .from('SchoolClasses')
    .insert([
      {
        school_id: payload.school_id,
        class_name: payload.class_title,
        class_title: payload.class_title,
        class_teacher_id: payload.class_teacher_id,
        total_students: payload.total_students,
        sub_title: payload.sub_title,
        wing: payload.sub_title,
        capacity: payload.total_students,
        is_active: payload.is_active === 1,
      },
    ])
    .select();

  if (error) {
    return { data: null, error: error.message || 'Could not create class.' };
  }
  const row = data?.[0] as Record<string, unknown> | undefined;
  return { data: row ? normalizeTursoSchoolClass(row) : null, error: null };
}

export async function updateTursoSchoolClass(
  classId: string,
  patch: Partial<{
    class_title: string;
    class_teacher_id: string | null;
    total_students: number;
    sub_title: string;
    is_active: boolean | 0 | 1;
  }>
): Promise<{ data: TursoSchoolClass | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.class_title !== undefined) payload.class_title = patch.class_title.trim();
  if (patch.class_teacher_id !== undefined) payload.class_teacher_id = patch.class_teacher_id || null;
  if (patch.total_students !== undefined) payload.total_students = Number(patch.total_students);
  if (patch.sub_title !== undefined) payload.sub_title = patch.sub_title.trim();
  if (patch.is_active !== undefined) payload.is_active = toSqliteBit(patch.is_active);

  if (!isUsingMockSupabase()) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/turso/school-classes/${encodeURIComponent(classId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: Record<string, unknown>;
        error?: { message?: string };
      } | null;
      if (res.ok && json?.success && json.data) {
        return { data: normalizeTursoSchoolClass(json.data), error: null };
      }
      if (res.status === 401 || res.status === 403) {
        return { data: null, error: json?.error?.message || 'Sign in to update classes in Turso.' };
      }
    } catch {
      // Fallback below
    }
  }

  const supabase = SupaBaseClientFunction();
  const { data, error } = await supabase
    .from('SchoolClasses')
    .update({
      ...(patch.class_title !== undefined
        ? { class_name: patch.class_title.trim(), class_title: patch.class_title.trim() }
        : {}),
      ...(patch.sub_title !== undefined
        ? { wing: patch.sub_title.trim(), sub_title: patch.sub_title.trim() }
        : {}),
      ...(patch.total_students !== undefined
        ? { capacity: Number(patch.total_students), total_students: Number(patch.total_students) }
        : {}),
      ...(patch.class_teacher_id !== undefined
        ? { class_teacher_id: patch.class_teacher_id || null }
        : {}),
      ...(patch.is_active !== undefined ? { is_active: toSqliteBit(patch.is_active) === 1 } : {}),
    })
    .eq('class_id', classId)
    .select();

  if (error) {
    return { data: null, error: error.message || 'Could not update class.' };
  }
  const row = data?.[0] as Record<string, unknown> | undefined;
  return { data: row ? normalizeTursoSchoolClass(row) : null, error: null };
}

export async function deleteTursoSchoolClass(
  classId: string
): Promise<{ error: string | null }> {
  if (!isUsingMockSupabase()) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/turso/school-classes/${encodeURIComponent(classId)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) return { error: null };
    } catch {
      // Fallback below
    }
  }

  const supabase = SupaBaseClientFunction();
  const { error } = await supabase.from('SchoolClasses').delete().eq('class_id', classId);
  return { error: error ? error.message || 'Could not delete class.' : null };
}
