import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import {
  SupaBaseClientFunction,
  exchangeAuthCodeOnce,
  formatSupabaseError,
  parseOAuthUrlParams,
} from '../SupaBaseClient/SupaBaseClientFunction';
import { resolveUserRoleAccess, type RoleAccessResult } from './roleResolver';
import { useRealtimeTables } from '../realtime/useRealtimeTable';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  userId: string | null;
  role: string | null;
  dashboardPath: string;
  schoolId: string | null;
  teacherId: string | null;
  studentAddNo: string | null;
  classId: string | null;
  fullName: string | null;
  profileUuid: string | null;
  roleSource: RoleAccessResult['source'] | null;
  loading: boolean;
  isRecoveryMode: boolean;
  authError: string | null;
  refreshSession: () => Promise<{ session: Session | null; access: RoleAccessResult | null }>;
  signOut: () => Promise<void>;
  clearRecoveryMode: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVE_SCHOOL_STORAGE_KEY = 'schoolgrid_active_school_id';
const ACTIVE_USER_STORAGE_KEY = 'schoolgrid_active_user_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [dashboardPath, setDashboardPath] = useState<string>('/school-dashboard');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [studentAddNo, setStudentAddNo] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [profileUuid, setProfileUuid] = useState<string | null>(null);
  const [roleSource, setRoleSource] = useState<RoleAccessResult['source'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearRoleState = useCallback(() => {
    setRole(null);
    setDashboardPath('/school-dashboard');
    setSchoolId(null);
    setTeacherId(null);
    setStudentAddNo(null);
    setClassId(null);
    setFullName(null);
    setProfileUuid(null);
    setRoleSource(null);
    try {
      window.localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_SCHOOL_STORAGE_KEY);
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const applySessionState = useCallback(
    async (nextSession: Session | null): Promise<RoleAccessResult | null> => {
      setSession(nextSession);
      if (!nextSession?.user) {
        clearRoleState();
        return null;
      }

      try {
        const metaSchoolId =
          typeof nextSession.user.user_metadata?.school_id === 'string'
            ? nextSession.user.user_metadata.school_id
            : null;
        const access = await resolveUserRoleAccess(
          nextSession.user.id,
          nextSession.user.user_metadata?.role,
          nextSession.user.app_metadata?.role,
          nextSession.user.email,
          undefined,
          {
            accessToken: nextSession.access_token,
            metadataSchoolId: metaSchoolId,
          }
        );
        setRole(access.role);
        setDashboardPath(access.dashboardPath);
        setSchoolId(access.schoolId);
        setTeacherId(access.teacherId ?? null);
        setStudentAddNo(access.studentAddNo ?? null);
        setClassId(access.classId ?? null);
        setFullName(access.fullName);
        setProfileUuid(access.profileUuid);
        setRoleSource(access.source);

        // Persist the active authenticated user's id & linked school_id (and clear stale school_id on switch)
        try {
          window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, nextSession.user.id);
          if (access.schoolId) {
            window.localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, access.schoolId);
          } else {
            window.localStorage.removeItem(ACTIVE_SCHOOL_STORAGE_KEY);
          }
        } catch {
          // Ignore storage errors
        }
        return access;
      } catch (err: unknown) {
        const message = formatSupabaseError(err, 'Account access denied.');
        setAuthError(message);
        const supabase = SupaBaseClientFunction();
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // Ignore signout error
        }
        setSession(null);
        clearRoleState();
        return null;
      }
    },
    [clearRoleState]
  );

  const refreshSession = useCallback(async (): Promise<{
    session: Session | null;
    access: RoleAccessResult | null;
  }> => {
    const supabase = SupaBaseClientFunction();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setAuthError(formatSupabaseError(error, 'Unable to load active session.'));
      await applySessionState(null);
      return { session: null, access: null };
    }
    const activeSession = data.session ?? null;
    const access = await applySessionState(activeSession);
    return { session: activeSession, access };
  }, [applySessionState]);

  useEffect(() => {
    let active = true;
    const supabase = SupaBaseClientFunction();

    async function bootstrapSession() {
      setLoading(true);
      let handledIncomingOAuth = false;
      let isIncomingRecovery = false;
      try {
        if (typeof window !== 'undefined' && window.location.pathname !== '/auth/callback') {
          const parsed = parseOAuthUrlParams(window.location.search, window.location.hash);

          if (parsed.error) {
            if (active) setAuthError(parsed.error);
          }

          if (parsed.type === 'recovery') {
            isIncomingRecovery = true;
            if (active) setIsRecoveryMode(true);
          }

          if (parsed.code) {
            handledIncomingOAuth = true;
            const { error: exchangeErr } = await exchangeAuthCodeOnce(supabase, parsed.code);
            if (exchangeErr && active) {
              setAuthError(formatSupabaseError(exchangeErr, 'Could not complete sign-in session.'));
            }
          } else if (parsed.accessToken && parsed.refreshToken) {
            handledIncomingOAuth = true;
            const { error: setErr } = await supabase.auth.setSession({
              access_token: parsed.accessToken,
              refresh_token: parsed.refreshToken,
            });
            if (setErr && active) {
              setAuthError(formatSupabaseError(setErr, 'Could not establish session from callback.'));
            }
          }

          if (parsed.code || parsed.accessToken || parsed.refreshToken || parsed.error) {
            const cleanUrl = `${window.location.pathname}`;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }

        const { data } = await supabase.auth.getSession();
        if (active) {
          const access = await applySessionState(data.session ?? null);
          if (data.session?.access_token) {
            void fetch('/api/auth/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.session.access_token}`,
              },
            }).catch(() => {
              // Non-blocking sync
            });
          }
          if (handledIncomingOAuth && access && !isIncomingRecovery) {
            navigate(access.dashboardPath, { replace: true });
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
      }
      void applySessionState(nextSession ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [applySessionState, navigate]);

  // Real-time role & active-status sync from public.school_user_info for the signed-in user
  useRealtimeTables(
    'auth-user-profile-realtime',
    [
      {
        table: 'school_user_info',
        filter: session?.user?.id ? `user_uuid=eq.${session.user.id}` : undefined,
        onChange: () => {
          void refreshSession();
        },
      },
    ],
    { enabled: Boolean(session?.user?.id) }
  );

  const signOut = useCallback(async () => {
    const supabase = SupaBaseClientFunction();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Fall through to clear local storage keys
    }
    [localStorage, sessionStorage].forEach((store) => {
      try {
        Object.keys(store)
          .filter(
            (k) =>
              k.startsWith('sb-') ||
              k.includes('supabase') ||
              k === 'schoolgrid-auth-session' ||
              k === ACTIVE_SCHOOL_STORAGE_KEY ||
              k === ACTIVE_USER_STORAGE_KEY
          )
          .forEach((k) => store.removeItem(k));
      } catch {
        // Ignore storage restrictions
      }
    });
    setIsRecoveryMode(false);
    setAuthError(null);
    await applySessionState(null);
  }, [applySessionState]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        userId: session?.user?.id ?? null,
        role,
        dashboardPath,
        schoolId,
        teacherId,
        studentAddNo,
        classId,
        fullName,
        profileUuid,
        roleSource,
        loading,
        isRecoveryMode,
        authError,
        refreshSession,
        signOut,
        clearRecoveryMode: () => setIsRecoveryMode(false),
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
