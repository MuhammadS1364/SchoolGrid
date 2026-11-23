import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Bell,
  Calendar,
  Layers,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  Pin,
} from 'lucide-react';
import { apiRequest, type PublicSchoolWebsiteData } from '../lib/api/platformApi';
import { usePageSeo } from '../lib/seo/usePageSeo';
import PublicFooter from '../GlobalComponents/PublicFooter';

export default function PublicSchoolWebsite() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicSchoolWebsiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageSeo({
    title: data?.school?.name ? `${data.school.name} | SchoolGrid Portal` : 'School Portal | SchoolGrid',
    description:
      data?.school?.about_summary ||
      'Official public institutional portal powered by SchoolGrid featuring wings, programmes, achievements, notices, and campus news.',
    path: slug ? `/s/${slug}` : '/schools',
  });

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    apiRequest<PublicSchoolWebsiteData>(`/api/public/schools/${encodeURIComponent(slug)}`, {
      requireAuth: false,
    })
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Public school website not found.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading school portal...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">School Portal Unavailable</h1>
          <p className="text-sm text-slate-600">{error || 'This school website is not active.'}</p>
          <Link
            to="/schools"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Schools Directory
          </Link>
        </div>
      </div>
    );
  }

  const { school, wings, programmes, achievements, news, notices } = data;

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Top School Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/schools"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Directory
            </Link>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <span className="truncate text-sm font-bold text-slate-900">{school.name}</span>
          </div>
          <Link
            to="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 shrink-0"
          >
            Member Login
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="font-mono text-xs uppercase tracking-wider text-indigo-300">
            Official Public Institutional Portal · /s/{school.slug}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{school.name}</h1>
          {school.about_summary && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {school.about_summary}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-5 text-xs text-slate-300">
            {(school.city || school.state) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                {[school.city, school.state, school.country].filter(Boolean).join(', ')}
              </span>
            )}
            {school.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-indigo-400" />
                {school.email}
              </span>
            )}
            {school.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-indigo-400" />
                {school.phone}
              </span>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 space-y-12">
        {/* Public Notices */}
        {notices.length > 0 && (
          <section aria-labelledby="notices-heading" className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              <h2 id="notices-heading" className="text-lg font-bold text-slate-900">
                Official Notices
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {notices.map((notice) => (
                <article
                  key={notice.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/50 p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{notice.title}</h3>
                    {notice.is_pinned === 1 && (
                      <Pin className="h-4 w-4 shrink-0 text-amber-600" aria-label="Pinned notice" />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed">{notice.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Wings */}
        <section aria-labelledby="wings-heading" className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h2 id="wings-heading" className="text-lg font-bold text-slate-900">
              Institutional Wings ({wings.length})
            </h2>
          </div>
          {wings.length === 0 ? (
            <p className="text-sm text-slate-500">No active wings published yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {wings.map((wing) => (
                <article key={wing.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    {wing.wing_type}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">{wing.name}</h3>
                  {wing.description && (
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{wing.description}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Public Programmes */}
        <section aria-labelledby="programmes-heading" className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h2 id="programmes-heading" className="text-lg font-bold text-slate-900">
              Public Programmes &amp; Events ({programmes.length})
            </h2>
          </div>
          {programmes.length === 0 ? (
            <p className="text-sm text-slate-500">No public programmes published yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {programmes.map((prog) => (
                <article key={prog.id} className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold uppercase tracking-wide text-indigo-600">
                      {prog.programme_type}
                    </span>
                    {prog.start_at && (
                      <span className="font-mono tabular-nums">
                        {new Date(prog.start_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-bold text-slate-900">{prog.title}</h3>
                  {prog.summary && <p className="mt-2 text-sm text-slate-600">{prog.summary}</p>}
                  {prog.venue && (
                    <p className="mt-3 text-xs text-slate-500">
                      Venue: <strong className="font-medium text-slate-700">{prog.venue}</strong>
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Achievements & News Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section aria-labelledby="achievements-heading" className="space-y-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-600" />
              <h2 id="achievements-heading" className="text-lg font-bold text-slate-900">
                Achievements ({achievements.length})
              </h2>
            </div>
            {achievements.length === 0 ? (
              <p className="text-sm text-slate-500">No public achievements yet.</p>
            ) : (
              <div className="space-y-3">
                {achievements.map((ach) => (
                  <article key={ach.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold uppercase tracking-wide text-emerald-700">
                        {ach.achievement_level} level
                      </span>
                      {ach.achieved_on && (
                        <span className="font-mono text-slate-500 tabular-nums">{ach.achieved_on}</span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-sm font-bold text-slate-900">{ach.title}</h3>
                    {ach.recipient_name && (
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        Recipient: {ach.recipient_name}
                      </p>
                    )}
                    {ach.description && (
                      <p className="mt-2 text-sm text-slate-600">{ach.description}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="news-heading" className="space-y-4">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-indigo-600" />
              <h2 id="news-heading" className="text-lg font-bold text-slate-900">
                Campus News ({news.length})
              </h2>
            </div>
            {news.length === 0 ? (
              <p className="text-sm text-slate-500">No published news articles yet.</p>
            ) : (
              <div className="space-y-3">
                {news.map((post) => (
                  <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-bold text-slate-900">{post.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      {post.excerpt || post.body_markdown}
                    </p>
                    {post.published_at && (
                      <p className="mt-3 font-mono text-xs text-slate-400">
                        Published {new Date(post.published_at).toLocaleDateString()}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
