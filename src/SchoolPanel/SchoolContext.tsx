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
import { ROLES } from '../lib/auth/roleResolver';
import {
  fetchTursoSchoolInfo,
  type TursoSchoolInfo,
} from '../lib/services/tursoSchoolData';

interface SchoolContextValue {
  school: SchoolRecord | null;
  schoolInfo: TursoSchoolInfo | null;
  allSchools: SchoolRecord[];
  loading: boolean;
  canSwitchSchools: boolean;
  selectSchoolById: (schoolId: string) => void;
  refreshSchool: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

const ACTIVE_SCHOOL_KEY = 'schoolgrid_active_school_id';

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user, userId, role, schoolId: profileSchoolId, loading: authLoading } = useAuth();
  const [allSchools, setAllSchools] = useState<SchoolRecord[]>([]);
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<TursoSchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Any logged-in non-SuperAdmin user is strictly locked to their own linked school_id
  const isLockedToOwnSchool = Boolean(user && role && role !== ROLES.SUPER_ADMIN);
  const canSwitchSchools = !isLockedToOwnSchool && allSchools.length > 1;

  const loadSchoolInfo = useCallback(async (targetSchoolId?: string | null) => {
    if (!targetSchoolId) {
      setSchoolInfo(null);
      return;
    }
    const info = await fetchTursoSchoolInfo(targetSchoolId);
    setSchoolInfo(info);
  }, []);

  const loadSchool = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      const supabase = SupaBaseClientFunction();
      const userEmail = user?.email?.trim().toLowerCase() ?? '';

      // When signed in as a School user (or any non-SuperAdmin member), query ONLY their own school row
      if (isLockedToOwnSchool) {
        let matched: SchoolRecord | null = null;

        if (profileSchoolId) {
          const { data } = await supabase
            .from('OurSchools')
            .select('*')
            .eq('school_id', profileSchoolId)
            .maybeSingle();
          matched = (data as SchoolRecord | null) ?? null;
        }

        if (!matched && userId) {
          const { data } = await supabase
            .from('OurSchools')
            .select('*')
            .eq('user_uuid', userId)
            .maybeSingle();
          matched = (data as SchoolRecord | null) ?? null;
        }

        if (!matched && userEmail) {
          const { data } = await supabase
            .from('OurSchools')
            .select('*')
            .eq('schoole_gmail', userEmail)
            .maybeSingle();
          matched = (data as SchoolRecord | null) ?? null;
        }

        setAllSchools(matched ? [matched] : []);
        setSchool(matched);
        await loadSchoolInfo(matched?.school_id);
        return;
      }

      // SuperAdmin (or unauthenticated sandbox preview) can inspect across all schools
      const { data: schoolsData } = await supabase
        .from('OurSchools')
        .select('*')
        .order('created_at', { ascending: false });

      const schoolsList = (schoolsData as SchoolRecord[]) || [];
      setAllSchools(schoolsList);

      let storedId: string | null = null;
      try {
        storedId = window.localStorage.getItem(ACTIVE_SCHOOL_KEY);
      } catch {
        storedId = null;
      }

      const matched =
        schoolsList.find((s) => storedId && s.school_id === storedId) ??
        schoolsList.find((s) => profileSchoolId && s.school_id === profileSchoolId) ??
        schoolsList.find((s) => userId && s.user_uuid === userId) ??
        schoolsList.find(
          (s) => s.schoole_gmail && s.schoole_gmail.trim().toLowerCase() === userEmail
        ) ??
        schoolsList.find((s) => s.is_approved) ??
        schoolsList[0] ??
        null;

      setSchool(matched);
      await loadSchoolInfo(matched?.school_id);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isLockedToOwnSchool, loadSchoolInfo, profileSchoolId, user?.email, userId]);

  useEffect(() => {
    void loadSchool();
  }, [loadSchool]);

  useRealtimeTables(
    'school-context-realtime',
    [
      {
        table: 'OurSchools',
        filter:
          isLockedToOwnSchool && (school?.school_id || profileSchoolId)
            ? `school_id=eq.${school?.school_id || profileSchoolId}`
            : undefined,
        onChange: (payload) => {
          const updated = payload.new as Partial<SchoolRecord> | null | undefined;
          const deleted = payload.old as Partial<SchoolRecord> | null | undefined;

          if (!isLockedToOwnSchool) {
            setAllSchools((prev) =>
              applyRealtimeChange(prev, payload, 'school_id', {
                sort: (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
              })
            );
          }

          if (payload.eventType === 'UPDATE' && updated?.school_id) {
            setSchool((prev) =>
              prev && prev.school_id === updated.school_id ? { ...prev, ...updated } : prev
            );
            if (isLockedToOwnSchool) {
              setAllSchools((prev) =>
                prev.map((item) =>
                  item.school_id === updated.school_id ? { ...item, ...updated } : item
                )
              );
            }
          } else if (payload.eventType === 'DELETE' && deleted?.school_id) {
            setSchool((prev) => (prev && prev.school_id === deleted.school_id ? null : prev));
            if (isLockedToOwnSchool) {
              setAllSchools((prev) => prev.filter((item) => item.school_id !== deleted.school_id));
            }
          } else if (payload.eventType === 'INSERT' && updated?.school_id && !isLockedToOwnSchool) {
            setSchool((prev) => prev ?? (updated as SchoolRecord));
          }
        },
      },
    ],
    { enabled: !authLoading, onResync: () => void loadSchool() }
  );

  const selectSchoolById = useCallback(
    (schoolId: string) => {
      if (isLockedToOwnSchool) return;
      const next = allSchools.find((s) => s.school_id === schoolId) ?? null;
      setSchool(next);
      void loadSchoolInfo(next?.school_id);
      try {
        window.localStorage.setItem(ACTIVE_SCHOOL_KEY, schoolId);
      } catch {
        // Ignore storage errors
      }
    },
    [allSchools, isLockedToOwnSchool, loadSchoolInfo]
  );

  return (
    <SchoolContext.Provider
      value={{
        school,
        schoolInfo,
        allSchools,
        loading: authLoading || loading,
        canSwitchSchools,
        selectSchoolById,
        refreshSchool: loadSchool,
      }}
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
