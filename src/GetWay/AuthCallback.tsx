import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import SupaBaseClientFunction, {
  formatSupabaseError,
  parseOAuthUrlParams,
} from '../lib/SupaBaseClient/SupaBaseClientFunction';
import { resolveUserRoleAccess } from '../lib/auth/roleResolver';
import { useAuth } from '../lib/auth/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      try {
        const supabase = SupaBaseClientFunction();
        const parsed = parseOAuthUrlParams(window.location.search, window.location.hash);

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        const isPopup = Boolean(window.opener && !window.opener.closed);

        // Popup mode (inside AI Studio preview iframe):
        // Hand the PKCE code or session tokens straight back to window.opener so
        // third-party storage partitioning does not block PKCE verifier lookup or session persistence.
        if (isPopup) {
          if (parsed.code) {
            window.opener.postMessage(
              { type: 'SCHOOLGRID_OAUTH_CODE', code: parsed.code },
              window.location.origin
            );
            window.close();
            return;
          }

          if (parsed.accessToken && parsed.refreshToken) {
            window.opener.postMessage(
              {
                type: 'SCHOOLGRID_OAUTH_SESSION',
                access_token: parsed.accessToken,
                refresh_token: parsed.refreshToken,
              },
              window.location.origin
            );
            window.close();
            return;
          }
        }

        // Top-level browser flow (mobile Chrome, direct tab, or fallback)
        if (parsed.code && typeof supabase.auth.exchangeCodeForSession === 'function') {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (exchangeErr) throw exchangeErr;
        } else if (parsed.accessToken && parsed.refreshToken) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (sessionErr) throw sessionErr;
        }

        // Clean sensitive tokens/code from URL immediately
        if (parsed.code || parsed.accessToken || parsed.refreshToken) {
          window.history.replaceState({}, document.title, '/auth/callback');
        }

        const { session: activeSession, access } = await refreshSession();
        const sessionUser = activeSession?.user ?? (await supabase.auth.getUser()).data.user;
        if (!sessionUser) {
          throw new Error('Unable to establish an authenticated session from Google sign-in.');
        }

        const resolvedAccess =
          access ??
          (await resolveUserRoleAccess(
            sessionUser.id,
            sessionUser.user_metadata?.role,
            sessionUser.app_metadata?.role,
            sessionUser.email
          ));

        if (!active) return;

        if (isPopup && activeSession?.access_token && activeSession?.refresh_token) {
          window.opener.postMessage(
            {
              type: 'SCHOOLGRID_OAUTH_SESSION',
              access_token: activeSession.access_token,
              refresh_token: activeSession.refresh_token,
              dashboardPath: resolvedAccess.dashboardPath,
            },
            window.location.origin
          );
          window.close();
          return;
        }

        if (isPopup) {
          window.opener.postMessage(
            { type: 'SCHOOLGRID_OAUTH_SUCCESS', dashboardPath: resolvedAccess.dashboardPath },
            window.location.origin
          );
          window.close();
          return;
        }

        navigate(resolvedAccess.dashboardPath, { replace: true });
      } catch (err: unknown) {
        if (!active) return;
        const message = formatSupabaseError(err, 'Google sign-in could not be completed.');
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: 'SCHOOLGRID_OAUTH_ERROR', message },
            window.location.origin
          );
          window.close();
          return;
        }
        setError(message);
      }
    }

    void completeAuth();
    return () => {
      active = false;
    };
  }, [navigate, refreshSession]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm space-y-3">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Google Sign-In Failed</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <Link
            to="/login"
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-700">Verifying profile &amp; redirecting...</p>
      </div>
    </div>
  );
}
