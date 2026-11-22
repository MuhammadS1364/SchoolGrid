import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Layers, MailPlus, ShieldAlert } from 'lucide-react';
import { useActiveSchool } from '../SchoolContext';
import { ApiRequestError, apiRequest } from '../../lib/api/platformApi';

interface WingRow {
  id: string;
  name: string;
  slug: string;
  wing_type: string;
  description: string | null;
  status: string;
}

interface InviteRow {
  id: string;
  email: string;
  role_code: string;
  role_name: string;
  status: string;
  expires_at: string;
}

export default function SchoolWingsAndInvitesPage() {
  const { school } = useActiveSchool();
  const [tursoSchoolId, setTursoSchoolId] = useState<string>('sch_greenwood_001');
  const [wings, setWings] = useState<WingRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wingName, setWingName] = useState('');
  const [wingType, setWingType] = useState<'academic' | 'cultural' | 'sports' | 'club' | 'administrative' | 'general'>('academic');
  const [wingDesc, setWingDesc] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'wing_manager' | 'teacher' | 'content_manager' | 'student' | 'school_admin'>('teacher');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Resolve matching Turso school ID from public directory or auth memberships
      const publicSchools = await apiRequest<Array<{ id: string; name: string; slug: string }>>(
        '/api/public/schools',
        { requireAuth: false }
      );
      const matched =
        publicSchools.find(
          (s) => school?.school_title && s.name.toLowerCase().includes(school.school_title.toLowerCase().split(' ')[0])
        ) ?? publicSchools[0];
      const activeId = matched?.id ?? 'sch_greenwood_001';
      setTursoSchoolId(activeId);

      const [wingsData, invitesData] = await Promise.all([
        apiRequest<WingRow[]>(`/api/school/${encodeURIComponent(activeId)}/wings`),
        apiRequest<InviteRow[]>(`/api/school/${encodeURIComponent(activeId)}/invitations`).catch(() => []),
      ]);
      setWings(wingsData);
      setInvites(invitesData);
      setAuthRequired(false);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        setAuthRequired(true);
        // Load public wings read-only so users still see institutional structure
        try {
          const pub = await apiRequest<{ wings: WingRow[] }>('/api/public/schools/greenwood-academy', {
            requireAuth: false,
          });
          setWings(pub.wings.map((w) => ({ ...w, status: 'active' })));
        } catch {
          // Ignore fallback
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load school wings.');
      }
    } finally {
      setLoading(false);
    }
  }, [school?.school_title]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateWing = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/school/${encodeURIComponent(tursoSchoolId)}/wings`, {
        method: 'POST',
        body: { name: wingName.trim(), wingType, description: wingDesc.trim() || undefined },
      });
      setWingName('');
      setWingDesc('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create wing.');
    }
  };

  const handleCreateInvite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setCreatedToken(null);
    try {
      const res = await apiRequest<{ rawToken: string }>(
        `/api/school/${encodeURIComponent(tursoSchoolId)}/invitations`,
        {
          method: 'POST',
          body: { email: inviteEmail.trim(), roleCode: inviteRole },
        }
      );
      setCreatedToken(res.rawToken);
      setInviteEmail('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to issue invitation.');
    }
  };

  const copyTokenUrl = async () => {
    if (!createdToken) return;
    const url = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(createdToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Institutional Wings &amp; Role Invitations
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Organize school clubs, academic departments, and sports wings, and issue hashed one-time
          role invitations to staff and students.
        </p>
      </header>

      {authRequired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-2.5 text-sm text-amber-900">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Viewing published wings in read-only mode. Sign in with a verified School Admin or
              SuperAdmin Supabase session to create wings or issue invitations.
            </span>
          </div>
          <Link
            to="/login"
            className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Sign In
          </Link>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Create Wing Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Create Institutional Wing</h2>
          </div>

          <form onSubmit={handleCreateWing} className="space-y-3">
            <div>
              <label htmlFor="wingName" className="mb-1 block text-xs font-semibold text-slate-700">
                Wing Name *
              </label>
              <input
                id="wingName"
                type="text"
                required
                value={wingName}
                onChange={(e) => setWingName(e.target.value)}
                placeholder="e.g. Eco & Sustainability Club"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="wingType" className="mb-1 block text-xs font-semibold text-slate-700">
                Wing Category
              </label>
              <select
                id="wingType"
                value={wingType}
                onChange={(e) => setWingType(e.target.value as typeof wingType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="academic">Academic</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="club">Club</option>
                <option value="administrative">Administrative</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label htmlFor="wingDesc" className="mb-1 block text-xs font-semibold text-slate-700">
                Description
              </label>
              <textarea
                id="wingDesc"
                rows={2}
                value={wingDesc}
                onChange={(e) => setWingDesc(e.target.value)}
                placeholder="Mission, faculty coordinators, and key activities."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={authRequired}
              className="h-10 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              Add Wing
            </button>
          </form>
        </section>

        {/* Issue Hashed Invitation Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MailPlus className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Invite Staff or Student</h2>
          </div>

          <form onSubmit={handleCreateInvite} className="space-y-3">
            <div>
              <label htmlFor="invEmail" className="mb-1 block text-xs font-semibold text-slate-700">
                Invitee Email *
              </label>
              <input
                id="invEmail"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teacher@school.edu"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="invRole" className="mb-1 block text-xs font-semibold text-slate-700">
                School Role
              </label>
              <select
                id="invRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="teacher">Teacher</option>
                <option value="wing_manager">Wing Manager</option>
                <option value="content_manager">Content Manager</option>
                <option value="student">Student</option>
                <option value="school_admin">School Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={authRequired}
              className="h-10 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              Generate One-Time Invitation
            </button>
          </form>

          {createdToken && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-900">
                One-time invitation link (only SHA-256 hash stored in DB):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800">
                  {`${window.location.origin}/accept-invitation?token=${createdToken}`}
                </code>
                <button
                  type="button"
                  onClick={() => void copyTokenUrl()}
                  className="inline-flex h-8 items-center gap-1 rounded bg-emerald-700 px-2.5 text-xs font-semibold text-white cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Active Wings List */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Active Wings ({wings.length})</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading wings...</p>
        ) : wings.length === 0 ? (
          <p className="text-sm text-slate-500">No wings created yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {wings.map((w) => (
              <article key={w.id} className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{w.wing_type}</p>
                <h3 className="mt-1 text-sm font-bold text-slate-900">{w.name}</h3>
                {w.description && <p className="mt-1.5 text-xs text-slate-600">{w.description}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Invitations Table */}
      {invites.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">Issued Invitations ({invites.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{inv.email}</td>
                    <td className="px-5 py-3 font-mono text-xs text-indigo-700">{inv.role_code}</td>
                    <td className="px-5 py-3 text-xs font-semibold uppercase text-slate-600">{inv.status}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
