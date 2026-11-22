import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { apiRequest } from '../lib/api/platformApi';

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{
    schoolId: string;
    schoolSlug: string;
    schoolName: string;
    roleCode: string;
  } | null>(null);

  const handleAccept = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError('Please enter your invitation token.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        schoolId: string;
        schoolSlug: string;
        schoolName: string;
        roleCode: string;
      }>('/api/invitations/accept', {
        method: 'POST',
        body: { token: token.trim() },
      });
      setAccepted(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {accepted ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900">Invitation Accepted</h1>
            <p className="text-sm text-slate-600">
              You have joined <strong>{accepted.schoolName}</strong> with role{' '}
              <span className="font-mono font-semibold text-indigo-700">{accepted.roleCode}</span>.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/school-dashboard"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Open School Dashboard
              </Link>
              <Link
                to={`/s/${accepted.schoolSlug}`}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Visit Public School Portal
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Accept School Invitation</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Invitations are cryptographically hashed, single-use, and bound to your verified
                  email address.
                </p>
              </div>
            </div>

            {!authLoading && !user && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 space-y-2">
                <p>Sign in with the email address that received this invitation first.</p>
                <Link
                  to="/login"
                  className="inline-flex text-xs font-semibold text-indigo-700 underline"
                >
                  Go to Login
                </Link>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label htmlFor="inviteToken" className="mb-1 block text-xs font-semibold text-slate-700">
                  Invitation Token
                </label>
                <input
                  id="inviteToken"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste one-time invitation token"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !user}
                className="h-11 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Verifying Invitation...' : 'Accept & Join School'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
