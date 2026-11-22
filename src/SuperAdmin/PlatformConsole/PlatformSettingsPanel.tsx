import { useEffect, useState } from 'react';
import { Database, KeyRound, ShieldCheck } from 'lucide-react';
import { apiRequest, type HealthData } from '../../lib/api/platformApi';

const RBAC_MATRIX = [
  { role: 'super_admin', scope: 'Platform', permissions: 'Provision schools, approve onboarding, manage school status, audit logs, outbox, settings' },
  { role: 'platform_support', scope: 'Platform', permissions: 'Read schools, review onboarding queue, read audit logs' },
  { role: 'platform_auditor', scope: 'Platform', permissions: 'Read-only access to schools and append-only audit logs' },
  { role: 'school_admin', scope: 'Tenant School', permissions: 'Full school governance, wings, classes, students, staff, programmes, content, invitations, Google Drive' },
  { role: 'wing_manager', scope: 'Tenant School', permissions: 'Manage wings, programmes, participant registrations, and achievements' },
  { role: 'teacher', scope: 'Tenant School', permissions: 'View classes & students, register participants, record achievements' },
  { role: 'content_manager', scope: 'Tenant School', permissions: 'Manage public website pages, news posts, notices, and achievements' },
  { role: 'student', scope: 'Tenant School', permissions: 'Read school programmes/notices and self-register for enabled programmes' },
];

export default function PlatformSettingsPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<HealthData>('/api/health', { requireAuth: false })
      .then((res) => {
        if (active) setHealth(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to check backend status.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform Architecture &amp; Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Turso/libSQL multi-tenant database status, Supabase Auth verification, and Role-Based Access
          Control specification.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2 text-indigo-600">
            <Database className="h-4 w-4" />
            <h2 className="text-xs font-bold uppercase tracking-wide">Turso / libSQL Engine</h2>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Checking connection...</p>
          ) : (
            <>
              <p className="text-lg font-bold text-slate-900">
                {health?.database.mode === 'turso' ? 'Turso Cloud Connected' : 'Local SQLite Fallback'}
              </p>
              <p className="font-mono text-xs text-slate-500 break-all">{health?.database.target}</p>
              <p className="text-xs text-slate-600">
                Applied schema migrations:{' '}
                <strong className="font-mono">{health?.database.migrationsApplied ?? 0}</strong> ·
                Foreign Keys: <strong className="font-mono">ON</strong>
              </p>
            </>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <KeyRound className="h-4 w-4" />
            <h2 className="text-xs font-bold uppercase tracking-wide">Identity Verification</h2>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {health?.supabaseAuthConfigured ? 'Supabase Auth Active' : 'Pending Supabase Env'}
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every protected API call validates the Bearer token server-side via Supabase Auth and
            resolves permissions from Turso RBAC tables.
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <ShieldCheck className="h-4 w-4" />
            <h2 className="text-xs font-bold uppercase tracking-wide">Tenant Isolation</h2>
          </div>
          <p className="text-lg font-bold text-slate-900">Composite FK + Scoped Queries</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every school table enforces <code className="font-mono">UNIQUE(school_id, id)</code>{' '}
            and composite foreign keys so cross-tenant relations fail at the database level.
          </p>
        </article>
      </div>

      {/* RBAC Specification Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Role-Based Access Control Matrix</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Role Code</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">Granted Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RBAC_MATRIX.map((row) => (
                <tr key={row.role}>
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-indigo-700">
                    {row.role}
                  </td>
                  <td className="px-5 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                    {row.scope}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{row.permissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
