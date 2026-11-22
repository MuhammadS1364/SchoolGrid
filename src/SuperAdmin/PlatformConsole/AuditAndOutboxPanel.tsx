import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, RefreshCw, RotateCw, ShieldAlert } from 'lucide-react';
import {
  ApiRequestError,
  apiRequest,
  type AuditLogItem,
  type OutboxEventItem,
} from '../../lib/api/platformApi';

export default function AuditAndOutboxPanel() {
  const [tab, setTab] = useState<'audit' | 'outbox'>('audit');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [auditData, outboxData] = await Promise.all([
        apiRequest<AuditLogItem[]>('/api/platform/audit-logs?limit=100'),
        apiRequest<OutboxEventItem[]>('/api/platform/outbox'),
      ]);
      setLogs(auditData);
      setOutbox(outboxData);
      setNeedsAuth(false);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        setNeedsAuth(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load audit logs and outbox.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRetryOutbox = async (eventId: string) => {
    setRetryingId(eventId);
    try {
      await apiRequest(`/api/platform/outbox/${encodeURIComponent(eventId)}/retry`, {
        method: 'POST',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process outbox event.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Audit Trail &amp; Transactional Outbox
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Append-only security audit log with automatic secret redaction and idempotent outbox
            event queue for email &amp; storage dispatch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {needsAuth ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">SuperAdmin Sign-In Required</h2>
              <p className="mt-1 text-sm text-slate-700">
                {error || 'Sign in with a verified SuperAdmin session to inspect platform audit logs and outbox events.'}
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

      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            tab === 'audit'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Audit Logs ({logs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('outbox')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            tab === 'outbox'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Outbox Queue ({outbox.length})
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading records...
        </div>
      ) : tab === 'audit' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              <Activity className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2">No audit events recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Scope</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Entity</th>
                    <th className="px-5 py-3">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold uppercase text-slate-600">
                        {item.scope}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-indigo-700">
                        {item.action}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700">
                        {item.entity_type} {item.school_name ? `· ${item.school_name}` : ''}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        {item.actor_email || 'system'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {outbox.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No outbox events queued.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Event Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Attempts</th>
                    <th className="px-5 py-3">Idempotency Key</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outbox.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                        {ev.event_type}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold uppercase text-slate-700">
                        {ev.status}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600 tabular-nums">
                        {ev.attempts} / {ev.max_attempts}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 max-w-xs truncate">
                        {ev.idempotency_key || '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {ev.status !== 'processed' ? (
                          <button
                            type="button"
                            disabled={retryingId === ev.id}
                            onClick={() => void handleRetryOutbox(ev.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Dispatch Now
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-medium">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
