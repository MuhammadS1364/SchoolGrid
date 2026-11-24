import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ExternalLink, Globe, Plus, ShieldAlert } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/api/platformApi';
import { useActiveSchool } from '../SchoolContext';

interface ProgrammeItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  programme_type: string;
  visibility: string;
  status: string;
  venue: string | null;
  start_at: string | null;
  registration_count?: number;
}

export default function SchoolProgrammesPage() {
  const { school } = useActiveSchool();
  const [schoolId, setSchoolId] = useState('');
  const [schoolSlug, setSchoolSlug] = useState('');
  const [programmes, setProgrammes] = useState<ProgrammeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [programmeType, setProgrammeType] = useState<'event' | 'competition' | 'workshop' | 'seminar' | 'sports' | 'cultural' | 'other'>('event');
  const [visibility, setVisibility] = useState<'public' | 'school_only'>('public');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [venue, setVenue] = useState('');

  const loadProgrammes = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    setError(null);
    let resolvedSlug = '';
    try {
      const pubSchools = await apiRequest<Array<{ id: string; name: string; slug: string }>>('/api/public/schools', {
        requireAuth: false,
      });
      const normalizedTitle = school.school_title.trim().toLowerCase();
      const matched =
        pubSchools.find((s) => s.id === school.school_id) ??
        pubSchools.find((s) => s.name.trim().toLowerCase() === normalizedTitle) ??
        null;
      const targetId = matched?.id ?? school.school_id;
      resolvedSlug = matched?.slug ?? '';
      setSchoolId(targetId);
      setSchoolSlug(resolvedSlug);

      const list = await apiRequest<ProgrammeItem[]>(`/api/school/${encodeURIComponent(targetId)}/programmes`);
      setProgrammes(list);
      setAuthRequired(false);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        setAuthRequired(true);
        if (resolvedSlug) {
          try {
            const pub = await apiRequest<{ programmes: ProgrammeItem[] }>(
              `/api/public/schools/${encodeURIComponent(resolvedSlug)}`,
              { requireAuth: false }
            );
            setProgrammes(pub.programmes.map((p) => ({ ...p, visibility: 'public', status: 'published' })));
          } catch {
            setProgrammes([]);
          }
        } else {
          setProgrammes([]);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load programmes.');
      }
    } finally {
      setLoading(false);
    }
  }, [school]);

  useEffect(() => {
    void loadProgrammes();
  }, [loadProgrammes]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/school/${encodeURIComponent(schoolId)}/programmes`, {
        method: 'POST',
        body: {
          title: title.trim(),
          summary: summary.trim() || undefined,
          programmeType,
          visibility,
          status,
          venue: venue.trim() || undefined,
          registrationRequired: true,
        },
      });
      setTitle('');
      setSummary('');
      setVenue('');
      await loadProgrammes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create programme.');
    }
  };

  const handlePublish = async (progId: string) => {
    setError(null);
    try {
      await apiRequest(`/api/school/${encodeURIComponent(schoolId)}/programmes/${encodeURIComponent(progId)}/publish`, {
        method: 'POST',
        body: { visibility: 'public' },
      });
      await loadProgrammes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish programme.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Programmes &amp; Institutional Activities
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage draft and published events, competitions, and workshops. Only published public
            programmes appear on your public school website.
          </p>
        </div>
        <Link
          to={`/s/${schoolSlug}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Globe className="h-4 w-4 text-indigo-600" />
          Public Portal
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      {authRequired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-2.5 text-sm text-amber-900">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Showing published programmes in read-only mode. Sign in with a verified Supabase
              session to create or publish programmes.
            </span>
          </div>
          <Link
            to="/login"
            className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
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

      {/* Create Programme Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">New Programme / Event</h2>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="progTitle" className="mb-1 block text-xs font-semibold text-slate-700">
              Programme Title *
            </label>
            <input
              id="progTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National Science Fair 2026"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="progType" className="mb-1 block text-xs font-semibold text-slate-700">
              Category
            </label>
            <select
              id="progType"
              value={programmeType}
              onChange={(e) => setProgrammeType(e.target.value as typeof programmeType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="event">Event</option>
              <option value="competition">Competition</option>
              <option value="workshop">Workshop</option>
              <option value="seminar">Seminar</option>
              <option value="sports">Sports</option>
              <option value="cultural">Cultural</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="progVenue" className="mb-1 block text-xs font-semibold text-slate-700">
              Venue
            </label>
            <input
              id="progVenue"
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Main Auditorium"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="progVisibility" className="mb-1 block text-xs font-semibold text-slate-700">
              Visibility
            </label>
            <select
              id="progVisibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="public">Public Website + School</option>
              <option value="school_only">School Members Only</option>
            </select>
          </div>

          <div>
            <label htmlFor="progStatus" className="mb-1 block text-xs font-semibold text-slate-700">
              Initial Status
            </label>
            <select
              id="progStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="draft">Draft (Hidden from public)</option>
              <option value="published">Published Immediately</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="progSummary" className="mb-1 block text-xs font-semibold text-slate-700">
              Summary
            </label>
            <textarea
              id="progSummary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short description for students, parents, and public visitors."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={authRequired}
              className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              Save Programme
            </button>
          </div>
        </form>
      </section>

      {/* Programmes Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            School Programmes ({programmes.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading programmes...</div>
        ) : programmes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No programmes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Visibility</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programmes.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{p.title}</p>
                      {p.venue && <p className="text-xs text-slate-500">Venue: {p.venue}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-xs uppercase text-slate-600">{p.programme_type}</td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-700">{p.visibility}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold uppercase ${
                          p.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.status !== 'published' && !authRequired ? (
                        <button
                          type="button"
                          onClick={() => void handlePublish(p.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Publish Publicly
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Live</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
