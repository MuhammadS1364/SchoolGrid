import SupaBaseClientFunction from '../SupaBaseClient/SupaBaseClientFunction';

export type SchoolDirectoryTable = 'SchoolTeachers' | 'SchoolStudents' | 'SchoolClasses';

const PK_MAP: Record<SchoolDirectoryTable, string> = {
  SchoolTeachers: 'teacher_id',
  SchoolStudents: 'student_id',
  SchoolClasses: 'class_id',
};

const LOCAL_STORAGE_KEY = 'schoolgrid_school_directory_v1';

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as SupabaseErrorLike;
  const code = String(err.code ?? '').toUpperCase();
  const message = String(err.message ?? '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    err.status === 404 ||
    message.includes('could not find the table') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

type LocalStore = Record<SchoolDirectoryTable, Array<Record<string, unknown>>>;

function readLocalStore(): LocalStore {
  const empty: LocalStore = {
    SchoolTeachers: [],
    SchoolStudents: [],
    SchoolClasses: [],
  };
  try {
    if (typeof window === 'undefined' || !window.localStorage) return empty;
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LocalStore>;
    return {
      SchoolTeachers: Array.isArray(parsed.SchoolTeachers) ? parsed.SchoolTeachers : [],
      SchoolStudents: Array.isArray(parsed.SchoolStudents) ? parsed.SchoolStudents : [],
      SchoolClasses: Array.isArray(parsed.SchoolClasses) ? parsed.SchoolClasses : [],
    };
  } catch {
    return empty;
  }
}

function writeLocalStore(store: LocalStore): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

function makeLocalId(table: SchoolDirectoryTable): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${table.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listSchoolRecords<T extends object>(
  table: SchoolDirectoryTable,
  schoolId: string
): Promise<{ data: T[]; error: string | null }> {
  const supabase = SupaBaseClientFunction();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (!error) {
    return { data: ((data as unknown as T[]) ?? []), error: null };
  }

  if (isMissingTableError(error)) {
    const store = readLocalStore();
    const rows = store[table]
      .filter((row) => row.school_id === schoolId)
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    return { data: rows as unknown as T[], error: null };
  }

  return { data: [], error: error.message || `Failed to load ${table}.` };
}

export async function listAllSchoolRecords<T extends object>(
  table: SchoolDirectoryTable
): Promise<{ data: T[]; error: string | null }> {
  const supabase = SupaBaseClientFunction();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false });

  if (!error) {
    return { data: ((data as unknown as T[]) ?? []), error: null };
  }

  if (isMissingTableError(error)) {
    const store = readLocalStore();
    const rows = [...store[table]].sort((a, b) =>
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    );
    return { data: rows as unknown as T[], error: null };
  }

  return { data: [], error: error.message || `Failed to load ${table}.` };
}


export async function createSchoolRecords<T extends object>(
  table: SchoolDirectoryTable,
  rows: Array<Record<string, unknown>>
): Promise<{ data: T[]; error: string | null }> {
  const supabase = SupaBaseClientFunction();
  const { data, error } = await supabase.from(table).insert(rows).select();

  if (!error) {
    return { data: ((data as unknown as T[]) ?? []), error: null };
  }

  if (isMissingTableError(error)) {
    const pk = PK_MAP[table];
    const store = readLocalStore();
    const created = rows.map((item) => ({
      [pk]: item[pk] ?? makeLocalId(table),
      created_at: item.created_at ?? new Date().toISOString(),
      ...item,
    }));
    store[table] = [...created, ...store[table]];
    writeLocalStore(store);
    return { data: created as unknown as T[], error: null };
  }

  return { data: [], error: error.message || `Failed to create record in ${table}.` };
}

export async function updateSchoolRecord<T extends object>(
  table: SchoolDirectoryTable,
  recordId: string,
  payload: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const pk = PK_MAP[table];
  const supabase = SupaBaseClientFunction();
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq(pk, recordId)
    .select();

  if (!error) {
    return { data: ((data?.[0] as unknown as T | undefined) ?? null), error: null };
  }

  if (isMissingTableError(error)) {
    const store = readLocalStore();
    let updated: Record<string, unknown> | null = null;
    store[table] = store[table].map((row) => {
      if (row[pk] === recordId) {
        updated = { ...row, ...payload };
        return updated;
      }
      return row;
    });
    writeLocalStore(store);
    return { data: updated as unknown as T | null, error: null };
  }

  return { data: null, error: error.message || `Failed to update record in ${table}.` };
}

export async function deleteSchoolRecord(
  table: SchoolDirectoryTable,
  recordId: string
): Promise<{ error: string | null }> {
  const pk = PK_MAP[table];
  const supabase = SupaBaseClientFunction();
  const { error } = await supabase.from(table).delete().eq(pk, recordId);

  if (!error) {
    return { error: null };
  }

  if (isMissingTableError(error)) {
    const store = readLocalStore();
    store[table] = store[table].filter((row) => row[pk] !== recordId);
    writeLocalStore(store);
    return { error: null };
  }

  return { error: error.message || `Failed to delete record in ${table}.` };
}
