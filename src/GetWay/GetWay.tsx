import { useEffect, useState, type ChangeEvent, type FC, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, KeyRound, LogOut, MailCheck, UserCheck } from 'lucide-react';
import {
  SupaBaseClientFunction,
  checkGoogleProviderEnabled,
  exchangeAuthCodeOnce,
  formatSupabaseError,
  isUsingMockSupabase,
} from '../lib/SupaBaseClient/SupaBaseClientFunction';
import { isGmailAddress, resolveUserRoleAccess } from '../lib/auth/roleResolver';
import { useAuth } from '../lib/auth/AuthContext';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const GetWay: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    session,
    user,
    role: activeRole,
    dashboardPath: activeDashboardPath,
    loading: authLoading,
    isRecoveryMode,
    authError,
    refreshSession,
    signOut,
    clearRecoveryMode,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [resetEmail, setResetEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailIsGmail = isGmailAddress(email);

  useEffect(() => {
    if (searchParams.get('autostart') === '1') {
      navigate('/super-admin-dashboard', { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    if (authError) {
      setError(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  // Listen for Google OAuth popup completion when embedded inside an iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        code?: string;
        access_token?: string;
        refresh_token?: string;
        dashboardPath?: string;
        message?: string;
      } | null;

      if (!data?.type) return;

      if (data.type === 'SCHOOLGRID_OAUTH_CODE' && data.code) {
        setLoading(true);
        setError(null);
        try {
          const supabase = SupaBaseClientFunction();
          const { error: exchangeErr } = await exchangeAuthCodeOnce(supabase, data.code);
          if (exchangeErr) throw exchangeErr;
          const { session: updatedSession, access: refreshedAccess } = await refreshSession();
          const u = updatedSession?.user;
          if (!u) {
            throw new Error('Google sign-in completed, but your account could not be verified.');
          }
          const access =
            refreshedAccess ??
            (await resolveUserRoleAccess(
              u.id,
              u.user_metadata?.role,
              u.app_metadata?.role,
              u.email
            ));
          setSuccessMessage(`Signed in with Google as ${access.role}. Redirecting...`);
          navigate(access.dashboardPath, { replace: true });
        } catch (err: unknown) {
          setError(formatSupabaseError(err, 'Failed to finalize Google sign-in session.'));
        } finally {
          setLoading(false);
        }
        return;
      }

      if (data.type === 'SCHOOLGRID_OAUTH_SESSION' && data.access_token && data.refresh_token) {
        setLoading(true);
        setError(null);
        try {
          const supabase = SupaBaseClientFunction();
          const { error: setErr } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          if (setErr) throw setErr;
          const { session: updatedSession, access: refreshedAccess } = await refreshSession();
          const u = updatedSession?.user;
          if (!u) {
            throw new Error('Google sign-in completed, but your account could not be verified.');
          }
          const access =
            refreshedAccess ??
            (await resolveUserRoleAccess(
              u.id,
              u.user_metadata?.role,
              u.app_metadata?.role,
              u.email
            ));
          setSuccessMessage(`Signed in with Google as ${access.role}. Redirecting...`);
          navigate(access.dashboardPath, { replace: true });
        } catch (err: unknown) {
          setError(formatSupabaseError(err, 'Failed to save Google sign-in session.'));
        } finally {
          setLoading(false);
        }
        return;
      }

      if (data.type === 'SCHOOLGRID_OAUTH_SUCCESS') {
        setLoading(false);
        setError(null);
        const { access } = await refreshSession();
        setSuccessMessage(
          `Signed in with Google${access?.role ? ` as ${access.role}` : ''}. Redirecting...`
        );
        navigate(access?.dashboardPath || data.dashboardPath || '/school-dashboard', {
          replace: true,
        });
      } else if (data.type === 'SCHOOLGRID_OAUTH_ERROR') {
        setLoading(false);
        setError(data.message || 'Google sign-in failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, refreshSession]);

  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);

    try {
      const supabase = SupaBaseClientFunction();

      const { data: authData, error: authErrorRes } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authErrorRes) {
        throw authErrorRes;
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('Authentication succeeded, but no user ID was returned.');
      }

      const { access } = await refreshSession();
      const resolved =
        access ??
        (await resolveUserRoleAccess(
          userId,
          authData.user?.user_metadata?.role,
          authData.user?.app_metadata?.role,
          authData.user?.email
        ));

      setSuccessMessage(`Signed in as ${resolved.role}. Redirecting to dashboard...`);
      await wait(400);
      navigate(resolved.dashboardPath, { replace: true });
    } catch (err: unknown) {
      setLoading(false);
      setSuccessMessage(null);
      setError(formatSupabaseError(err, 'Login or role check failed.'));
    }
  };

  const handleGoogleLogin = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const providerStatus = await checkGoogleProviderEnabled();
      if (providerStatus.checked && !providerStatus.enabled) {
        setLoading(false);
        setError(
          `Google provider is not enabled in your Supabase project yet. Enable it in Supabase Dashboard → Authentication → Providers → Google, add your Google Client ID & Secret, and whitelist ${window.location.origin}/auth/callback under Authentication → URL Configuration → Redirect URLs.`
        );
        return;
      }

      const supabase = SupaBaseClientFunction();
      const loginHint = isGmailAddress(email) ? email.trim() : undefined;
      const redirectTo = `${window.location.origin}/auth/callback`;
      const inIframe = window.self !== window.top;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: !isUsingMockSupabase(),
          queryParams: {
            ...(loginHint ? { login_hint: loginHint } : {}),
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (oauthError) {
        throw oauthError;
      }

      if (isUsingMockSupabase()) {
        const { access } = await refreshSession();
        const oauthUser = (data as unknown as {
          user?: {
            id: string;
            email?: string;
            user_metadata?: { role?: string };
            app_metadata?: { role?: string };
          };
        })?.user;
        const resolved =
          access ??
          (await resolveUserRoleAccess(
            oauthUser?.id ?? 'oauth-user',
            oauthUser?.user_metadata?.role,
            oauthUser?.app_metadata?.role,
            oauthUser?.email ?? loginHint ?? 'greenwood.academy@gmail.com'
          ));
        setSuccessMessage(`Signed in with Google as ${resolved.role}. Redirecting...`);
        await wait(400);
        navigate(resolved.dashboardPath, { replace: true });
        return;
      }

      const authUrl = data?.url;
      if (!authUrl) {
        throw new Error('Supabase did not return a Google OAuth authorization URL.');
      }

      if (inIframe) {
        const popup = window.open(
          authUrl,
          'schoolgrid_google_oauth',
          'width=520,height=640,noopener=no,noreferrer=no'
        );
        if (!popup) {
          setLoading(false);
          setError(
            'Popup blocked by browser. Please allow popups for this site and click "Continue with Google" again.'
          );
          return;
        }
        setSuccessMessage('Complete Google sign-in in the opened window...');
        setLoading(false);

        // If popup is closed before completing (e.g. Supabase fell back to localhost:3000), surface actionable guidance
        const pollClose = window.setInterval(() => {
          if (popup.closed) {
            window.clearInterval(pollClose);
            void supabase.auth.getSession().then(({ data: sessionData }) => {
              if (!sessionData.session) {
                setSuccessMessage(null);
                setError(
                  `Google popup closed before completing. If it redirected to localhost:3000, set Supabase Authentication → URL Configuration → Site URL to ${window.location.origin} and add ${redirectTo} under Redirect URLs.`
                );
              }
            });
          }
        }, 700);
      } else {
        window.location.assign(authUrl);
      }
    } catch (err: unknown) {
      setLoading(false);
      const rawMsg = formatSupabaseError(err, 'Google sign-in failed.');
      if (rawMsg.toLowerCase().includes('provider is not enabled')) {
        setError(
          `Google provider is not enabled in your Supabase project yet. Enable it in Supabase Dashboard → Authentication → Providers → Google, add your Google Client ID & Secret, and add ${window.location.origin}/auth/callback to Redirect URLs.`
        );
      } else {
        setError(rawMsg);
      }
    }
  };

  const handlePasswordReset = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const supabase = SupaBaseClientFunction();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) {
        throw resetError;
      }
      setSuccessMessage(
        `Password reset instructions sent to ${trimmed}. Check your inbox to set a new password.`
      );
    } catch (err: unknown) {
      setError(formatSupabaseError(err, 'Unable to send password reset email.'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecoveredPassword = async (
    e: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const supabase = SupaBaseClientFunction();
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      clearRecoveryMode();
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password updated successfully. You can now continue to your dashboard.');
      await refreshSession();
    } catch (err: unknown) {
      setError(formatSupabaseError(err, 'Unable to update password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutCurrent = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await signOut();
      setSuccessMessage('Signed out cleanly. You can log in with another account below.');
    } finally {
      setLoading(false);
    }
  };

  const openForgotMode = () => {
    setError(null);
    setSuccessMessage(null);
    setResetEmail(email.trim());
    setMode('forgot');
  };

  const backToLogin = () => {
    setError(null);
    setSuccessMessage(null);
    setMode('login');
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SchoolGrid
          </Link>
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <Link
              to="/schools"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Schools Directory
            </Link>
            <Link
              to="/services"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Plans &amp; Services
            </Link>
            <Link
              to="/super-admin-dashboard"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              SuperAdmin
            </Link>
            <Link
              to="/school-dashboard"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              School Panel
            </Link>
          </nav>
          <div className="shrink-0">
            <Link
              to="/register-school"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Register School
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8"
        >
          {/* Active Session Banner */}
          {!authLoading && session && user && !isRecoveryMode && (
            <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Active Session · {activeRole || 'Member'}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(activeDashboardPath)}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Continue to Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleSignOutCurrent()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {isRecoveryMode ? (
            <>
              <div className="mb-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Set New Password
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Enter a new password for your SchoolGrid account.
                </p>
              </div>

              {successMessage && (
                <div
                  role="status"
                  className="mb-5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg"
                >
                  {successMessage}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleUpdateRecoveredPassword} className="space-y-4">
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-70 cursor-pointer"
                >
                  {loading ? 'Updating password...' : 'Update Password'}
                </button>
              </form>
            </>
          ) : mode === 'login' ? (
            <>
              <div className="text-center mb-7">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Login To Access Your Account
                </h1>
                <p className="text-sm text-slate-500 mt-1.5">
                  SuperAdmin · School · Teacher · Student
                </p>
              </div>

              {successMessage && (
                <div
                  role="status"
                  className="mb-5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center gap-2"
                >
                  <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="userName"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email Address (Gmail or Work / School Email)
                  </label>
                  <input
                    type="email"
                    name="userName"
                    id="userName"
                    autoComplete="email"
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="name@gmail.com or name@school.edu"
                    required
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60"
                  />
                  {emailIsGmail && (
                    <p className="mt-1.5 text-xs text-indigo-700">
                      Gmail detected — sign in with your password or click{' '}
                      <strong>Continue with Google</strong> below.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="userPassword"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={openForgotMode}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    name="userPassword"
                    id="userPassword"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 cursor-pointer"
                >
                  {loading ? 'Signing in...' : 'Login with Email & Password'}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 font-medium">
                    Or sign in with Gmail
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-11 flex items-center justify-center gap-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
                New institution?{' '}
                <Link to="/services" className="font-semibold text-indigo-600 hover:text-indigo-700">
                  Browse Service Plans
                </Link>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToLogin}
                className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to login
              </button>

              <div className="mb-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Reset Your Password
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Enter your account email and we will send a Supabase password reset link.
                </p>
              </div>

              {successMessage && (
                <div
                  role="status"
                  className="mb-5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg"
                >
                  {successMessage}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label
                    htmlFor="resetEmail"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Account Email
                  </label>
                  <input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setResetEmail(e.target.value)}
                    placeholder="admin@school.edu or school@gmail.com"
                    required
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-70 cursor-pointer"
                >
                  {loading ? 'Sending reset link...' : 'Send Password Reset Link'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default GetWay;