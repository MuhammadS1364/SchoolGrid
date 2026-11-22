import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, Plus, RefreshCw, ShieldAlert, X } from 'lucide-react';
import {
  ApiRequestError,
  apiRequest,
  type OnboardingRequestItem,
  type ProvisionedSchoolResponse,
  type TursoSchoolSummary,
} from '../../lib/api/platformApi';

export default function OnboardingRequestsPanel() {
  const [requests, setRequests] = useState<OnboardingRequestItem[]>([]);
  const [schools, setSchools] = useState<TursoSchoolSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLiveAuth, setNeedsLiveAuth] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [provisionBanner, setProvisionBanner] = useState<ProvisionedSchoolResponse | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqList, schoolList] = await Promise.all([
        apiRequest<OnboardingRequestItem[]>('/api/platform/onboarding'),
        apiRequest<TursoSchoolSummary[]>('/api/platform/schools'),
      ]);
      setRequests(reqList);
      setSchools(schoolList);
      setNeedsLiveAuth(false);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        setNeedsLiveAuth(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load platform onboarding data.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleApprove = async (reqItem: OnboardingRequestItem) => {
    setBusyId(reqItem.id);
    setError(null);
    try {
      const res = await apiRequest<ProvisionedSchoolResponse>(
        `/api/platform/onboarding/${encodeURIComponent(reqItem.id)}/approve`,
        { method: 'POST' }
      );
      setProvisionBanner(res);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (reqItem: OnboardingRequestItem) => {
    setBusyId(reqItem.id);
    setError(null);
    try {
      await apiRequest(`/api/platform/onboarding/${encodeURIComponent(reqItem.id)}/reject`, {
        method: 'POST',
        body: { reason: 'Institutional verification incomplete.' },
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (schoolId: string, status: 'active' | 'suspended' | 'archived') => {
    setBusyId(schoolId);
    setError(null);
    try {
      await apiRequest(`/api/platform/schools/${encodeURIComponent(schoolId)}/status`, {
        method: 'POST',
        body: { status },
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDirectCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    setBusyId('create');
    try {
      const res = await apiRequest<ProvisionedSchoolResponse>('/api/platform/schools', {
        method: 'POST',
        body: {
          name: newName.trim(),
          slug: (newSlug.trim() || newName.trim()).toLowerCase(),
          contactEmail: newEmail.trim(),
          city: newCity.trim() || undefined,
          state: newState.trim() || undefined,
        },
      });
      setProvisionBanner(res);
      setShowCreateModal(false);
      setNewName('');
      setNewSlug('');
      setNewEmail('');
      setNewCity('');
      setNewState('');
      await loadAll();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not provision school.');
    } finally {
      setBusyId(null);
    }
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    } catch {
      // Ignore clipboard permissions error
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Turso Multi-Tenant Provisioning &amp; Onboarding
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Approve institutional registration requests or provision new schools atomically with
            default RBAC roles, settings, and hashed admin invitations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Provision School
          </button>
        </div>
      </header>

      {provisionBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-emerald-900">
                School Provisioned: {provisionBanner.school.name} (/s/{provisionBanner.school.slug})
              </h2>
              <p className="mt-1 text-xs text-emerald-800">
                One-time invitation token generated for <strong>{provisionBanner.initialInvitation.email}</strong>{' '}
                (stored strictly as SHA-256 hash in Turso). Share this link once:
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProvisionBanner(null)}
              aria-label="Dismiss provisioned school banner"
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-slate-800">
              {`${window.location.origin}/accept-invitation?token=${provisionBanner.initialInvitation.rawToken}`}
            </code>
            <button
              type="button"
              onClick={() => void copyInviteLink(provisionBanner.initialInvitation.rawToken)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
            >
              {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedToken ? 'Copied' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      )}

      {needsLiveAuth ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">SuperAdmin Authentication Required</h2>
              <p className="mt-1 text-sm text-slate-700">
                {error || 'Sign in with a verified Supabase SuperAdmin session to manage Turso onboarding requests and tenant provisioning.'}
              </p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign In
          </Link>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Onboarding Requests Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Public Onboarding Requests ({requests.length})
          </h2>
          <Link to="/register-school" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Open Public Registration Form
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading onboarding queue...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No onboarding requests submitted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((reqItem) => (
                  <tr key={reqItem.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{reqItem.school_name}</p>
                      <p className="font-mono text-xs text-slate-500">/s/{reqItem.requested_slug}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-900">{reqItem.contact_name}</p>
                      <p className="text-xs text-slate-500">{reqItem.contact_email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {[reqItem.city, reqItem.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold uppercase ${
                          reqItem.status === 'approved'
                            ? 'text-emerald-700'
                            : reqItem.status === 'rejected'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {reqItem.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {reqItem.status === 'pending' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === reqItem.id}
                            onClick={() => void handleApprove(reqItem)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            Approve &amp; Provision
                          </button>
                          <button
                            type="button"
                            disabled={busyId === reqItem.id}
                            onClick={() => void handleReject(reqItem)}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Provisioned Turso Schools Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Provisioned Tenant Schools ({schools.length})
          </h2>
          <Link to="/schools" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            View Public Directory
          </Link>
        </div>

        {schools.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No provisioned schools loaded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">School</th>
                  <th className="px-5 py-3">Code / Email</th>
                  <th className="px-5 py-3">Wings / Programmes</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schools.map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{sch.name}</p>
                      <Link
                        to={`/s/${sch.slug}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:underline"
                      >
                        /s/{sch.slug}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs text-slate-700">{sch.school_code || '—'}</p>
                      <p className="text-xs text-slate-500">{sch.email || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      {sch.wing_count} wings · {sch.programme_count} programmes
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold uppercase ${
                          sch.status === 'active'
                            ? 'text-emerald-700'
                            : sch.status === 'suspended'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {sch.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {sch.status !== 'active' && (
                          <button
                            type="button"
                            disabled={busyId === sch.id}
                            onClick={() => void handleStatusChange(sch.id, 'active')}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                          >
                            Activate
                          </button>
                        )}
                        {sch.status === 'active' && (
                          <button
                            type="button"
                            disabled={busyId === sch.id}
                            onClick={() => void handleStatusChange(sch.id, 'suspended')}
                            className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 cursor-pointer"
                          >
                            Suspend
                          </button>
                        )}
                        {sch.status !== 'archived' && (
                          <button
                            type="button"
                            disabled={busyId === sch.id}
                            onClick={() => void handleStatusChange(sch.id, 'archived')}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Direct Provision Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="provision-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 id="provision-modal-title" className="text-lg font-bold text-slate-900">
                Provision New School Tenant
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close modal"
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {createError}
              </div>
            )}

            <form onSubmit={handleDirectCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="provName" className="mb-1 block text-xs font-semibold text-slate-700">
                  School Name *
                </label>
                <input
                  id="provName"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Delhi Modern Public School"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="provSlug" className="mb-1 block text-xs font-semibold text-slate-700">
                    URL Slug *
                  </label>
                  <input
                    id="provSlug"
                    type="text"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="delhi-modern-public"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="provEmail" className="mb-1 block text-xs font-semibold text-slate-700">
                    Admin Invite Email *
                  </label>
                  <input
                    id="provEmail"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="admin@delhimodern.edu"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="provCity" className="mb-1 block text-xs font-semibold text-slate-700">
                    City
                  </label>
                  <input
                    id="provCity"
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="New Delhi"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="provState" className="mb-1 block text-xs font-semibold text-slate-700">
                    State
                  </label>
                  <input
                    id="provState"
                    type="text"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    placeholder="Delhi"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === 'create'}
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {busyId === 'create' ? 'Provisioning...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
