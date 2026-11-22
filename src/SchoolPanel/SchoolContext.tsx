import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import SupaBaseClientFunction from '../lib/SupaBaseClient/SupaBaseClientFunction';
import type { SchoolRecord } from '../lib/SupaBaseClient/mockSupabase';
import {
  applyRealtimeChange,
  useRealtimeTables,
} from '../lib/realtime/useRealtimeTable';
import { useAuth } from '../lib/auth/AuthContext';

interface SchoolContextValue {
  school: SchoolRecord | null;
  allSchools: SchoolRecord[];
  loading: boolean;
  selectSchoolById: (schoolId: string) => void;
  refreshSchool: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

const ACTIVE_SCHOOL_KEY = 'schoolgrid_active_school_id';

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user, schoolId: profileSchoolId } = useAuth();
  const [allSchools, setAllSchools] = useState<SchoolRecord[]>([]);
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSchool = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = SupaBaseClientFunction();
      const { data: schoolsData } = await supabase
        .from('OurSchools')
        .select('*')
        .order('created_at', { ascending: false });

      const schoolsList = (schoolsData as SchoolRecord[]) || [];
      setAllSchools(schoolsList);

      const userEmail = user?.email?.trim().toLowerCase() ?? '';
      let storedId: string | null = null;
      try {
        storedId = window.localStorage.getItem(ACTIVE_SCHOOL_KEY);
      } catch {
        storedId = null;
      }

      const matched =
        schoolsList.find((s) => profileSchoolId && s.school_id === profileSchoolId) ??
        schoolsList.find((s) => storedId && s.school_id === storedId) ??
        schoolsList.find(
          (s) => s.schoole_gmail && s.schoole_gmail.trim().toLowerCase() === userEmail
        ) ??
        schoolsList.find((s) => user?.id && s.user_uuid === user.id) ??
        schoolsList.find((s) => s.is_approved) ??
        schoolsList[0] ??
        null;

      setSchool(matched);
    } finally {
      setLoading(false);
    }
  }, [profileSchoolId, user?.email, user?.id]);

  useEffect(() => {
    void loadSchool();
  }, [loadSchool]);

  useRealtimeTables(
    'school-context-realtime',
    [
      {
        table: 'OurSchools',
        onChange: (payload) => {
          setAllSchools((prev) =>
            applyRealtimeChange(prev, payload, 'school_id', {
              sort: (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
            })
          );

          const updated = payload.new as Partial<SchoolRecord> | null | undefined;
          const deleted = payload.old as Partial<SchoolRecord> | null | undefined;
          if (payload.eventType === 'UPDATE' && updated?.school_id) {
            setSchool((prev) =>
              prev && prev.school_id === updated.school_id ? { ...prev, ...updated } : prev
            );
          } else if (payload.eventType === 'DELETE' && deleted?.school_id) {
            setSchool((prev) => (prev && prev.school_id === deleted.school_id ? null : prev));
          } else if (payload.eventType === 'INSERT' && updated?.school_id) {
            setSchool((prev) => prev ?? (updated as SchoolRecord));
          }
        },
      },
    ],
    { onResync: () => void loadSchool() }
  );

  const selectSchoolById = useCallback(
    (schoolId: string) => {
      const next = allSchools.find((s) => s.school_id === schoolId) ?? null;
      setSchool(next);
      try {
        window.localStorage.setItem(ACTIVE_SCHOOL_KEY, schoolId);
      } catch {
        // Ignore storage errors
      }
    },
    [allSchools]
  );

  return (
    <SchoolContext.Provider
      value={{ school, allSchools, loading, selectSchoolById, refreshSchool: loadSchool }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

export function useActiveSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) {
    throw new Error('useActiveSchool must be used within SchoolProvider');
  }
  return ctx;
}
