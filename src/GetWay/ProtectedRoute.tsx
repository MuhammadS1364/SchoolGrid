import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { SupaBaseClientFunction } from '../lib/SupaBaseClient/SupaBaseClientFunction';
import { resolveUserRoleAccess } from '../lib/auth/roleResolver';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles allowed on this route. Leave empty to allow any signed-in user with an active role. */
  allowedRoles?: string[];
  loginPath?: string;
}

type Status =
  | { state: 'checking' }
  | { state: 'anonymous' }
  | { state: 'allowed' }
  | { state: 'denied'; role: string; dashboardPath: string }
  | { state: 'error'; message: string };

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-xl">
        {children}
      </div>
    </div>
  );
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  loginPath = '/login',
}: ProtectedRouteProps) {
  const location = useLocation();
  const [status, setStatus] = useState<Status>({ state: 'checking' });

  // stable dependency for the effect
  const rolesKey = (allowedRoles ?? []).join('|');

  useEffect(() => {
    let active = true;
    const supabase = SupaBaseClientFunction();

    const verify = async (): Promise<void> => {
      try {
        // getUser() validates the token with Supabase (safer than getSession alone)
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error || !data.user) {
          setStatus({ state: 'anonymous' });
          return;
        }

        const { role, dashboardPath } = await resolveUserRoleAccess(
          data.user.id,
          data.user.user_metadata?.role,
          data.user.app_metadata?.role,
          data.user.email
        );
        if (!active) return;

        const roles = rolesKey ? rolesKey.split('|') : [];
        if (roles.length === 0 || roles.includes(role)) {
          setStatus({ state: 'allowed' });
        } else {
          setStatus({ state: 'denied', role, dashboardPath });
        }
      } catch (err) {
        if (active) {
          setStatus({
            state: 'error',
            message: err instanceof Error ? err.message : 'Could not verify your access.',
          });
        }
      }
    };

    void verify();

    // Logged out in another tab / session expired -> back to login
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) setStatus({ state: 'anonymous' });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [rolesKey]);

  switch (status.state) {
    case 'checking':
      return (
        <Screen>
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-700">Checking session &amp; permissions...</p>
        </Screen>
      );

    case 'anonymous':
      return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;

    case 'denied':
      return (
        <Screen>
          <ShieldAlert className="h-7 w-7 text-amber-500" />
          <h1 className="text-base font-semibold text-slate-900">No access to this area</h1>
          <p className="text-sm text-slate-500">
            Your account role is <span className="font-medium text-slate-700">{status.role}</span>, which
            can't open this page.
          </p>
          <Link
            to={status.dashboardPath}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Go to my dashboard
          </Link>
        </Screen>
      );

    case 'error':
      return (
        <Screen>
          <ShieldAlert className="h-7 w-7 text-rose-500" />
          <p className="text-sm text-slate-700">{status.message}</p>
          <Link
            to={loginPath}
            replace
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to login
          </Link>
        </Screen>
      );

    default:
      return <>{children}</>;
  }
}