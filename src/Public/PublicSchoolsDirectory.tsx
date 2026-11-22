import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, Layers, MapPin, Search } from 'lucide-react';
import { apiRequest, type PublicSchoolSummary } from '../lib/api/platformApi';

export default function PublicSchoolsDirectory() {
  const [schools, setSchools] = useState<PublicSchoolSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<PublicSchoolSummary[]>('/api/public/schools', { requireAuth: false })
      .then((data) => {
        if (active) {
          setSchools(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load public schools.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) =>
      [s.name, s.short_name, s.slug, s.city, s.state, s.about_summary]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [schools, query]);

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            SchoolGrid
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/schools" className="text-slate-900 font-semibold">
              Schools Directory
            </Link>
            <Link to="/services" className="hover:text-slate-900 transition-colors">
              Plans &amp; Services
            </Link>
            <Link to="/register-school" className="hover:text-slate-900 transition-colors">
              Register Institution
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign In
            </Link>
            <Link
              to="/register-school"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Onboard School
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 space-y-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Registered Schools &amp; Public Portals
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Explore active institutions running on SchoolGrid. Each school maintains its own
              isolated workspace, wings, public programmes, achievements, and official notices.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by school, city, or slug..."
              aria-label="Search schools"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Building2 className="mx-auto h-9 w-9 text-slate-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">No matching schools found</h2>
            <p className="mt-1 text-sm text-slate-500">
              Try a different search term or register a new institution for review.
            </p>
            <Link
              to="/register-school"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Submit School Registration
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((school) => (
              <article
                key={school.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 leading-snug">{school.name}</h2>
                      <p className="mt-1 font-mono text-xs text-slate-500">/s/{school.slug}</p>
                    </div>
                    {school.established_year && (
                      <span className="shrink-0 font-mono text-xs font-medium text-slate-500 tabular-nums">
                        Est. {school.established_year}
                      </span>
                    )}
                  </div>

                  {(school.city || school.state) && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {[school.city, school.state, school.country].filter(Boolean).join(', ')}
                    </p>
                  )}

                  {school.about_summary && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                      {school.about_summary}
                    </p>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="mb-4 flex items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      <strong className="font-semibold text-slate-900 tabular-nums">{school.wing_count}</strong> Wings
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                      <strong className="font-semibold text-slate-900 tabular-nums">{school.programme_count}</strong> Public Programmes
                    </span>
                  </div>

                  <Link
                    to={`/s/${school.slug}`}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    Visit School Portal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
