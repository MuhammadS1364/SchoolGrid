import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Award, Bell, Newspaper, ShieldAlert } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/api/platformApi';

interface AchievementRow {
  id: string;
  title: string;
  achievement_level: string;
  recipient_name: string | null;
  visibility: string;
  status: string;
}

interface NewsRow {
  id: string;
  title: string;
  excerpt: string | null;
  visibility: string;
  status: string;
}

interface NoticeRow {
  id: string;
  title: string;
  body: string;
  priority: string;
  audience: string;
  status: string;
}

export default function SchoolContentPage() {
  const [schoolId, setSchoolId] = useState('sch_greenwood_001');
  const [tab, setTab] = useState<'achievements' | 'news' | 'notices'>('achievements');
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [news, setNews] = useState<NewsRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Achievement form
  const [achTitle, setAchTitle] = useState('');
  const [achRecipient, setAchRecipient] = useState('');
  const [achLevel, setAchLevel] = useState<'school' | 'district' | 'state' | 'national' | 'international'>('district');

  // News form
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');

  // Notice form
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeAudience, setNoticeAudience] = useState<'public' | 'school_all'>('public');

  const loadContent = useCallback(async () => {
    setError(null);
    try {
      const pubSchools = await apiRequest<Array<{ id: string; slug: string }>>('/api/public/schools', {
        requireAuth: false,
      });
      const target = pubSchools[0] ?? { id: 'sch_greenwood_001', slug: 'greenwood-academy' };
      setSchoolId(target.id);

      const [achData, newsData, noticeData] = await Promise.all([
        apiRequest<AchievementRow[]>(`/api/school/${encodeURIComponent(target.id)}/achievements`),
        apiRequest<NewsRow[]>(`/api/school/${encodeURIComponent(target.id)}/news`),
        apiRequest<NoticeRow[]>(`/api/school/${encodeURIComponent(target.id)}/notices`),
      ]);
      setAchievements(achData);
      setNews(newsData);
      setNotices(noticeData);
      setAuthRequired(false);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        setAuthRequired(true);
        try {
          const pub = await apiRequest<{
            achievements: AchievementRow[];
            news: NewsRow[];
            notices: NoticeRow[];
          }>('/api/public/schools/greenwood-academy', { requireAuth: false });
          setAchievements(pub.achievements.map((a) => ({ ...a, visibility: 'public', status: 'published' })));
          setNews(pub.news.map((n) => ({ ...n, visibility: 'public', status: 'published' })));
          setNotices(pub.notices.map((n) => ({ ...n, audience: 'public', status: 'published' })));
        } catch {
          // Ignore fallback
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load school content.');
      }
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const handleAddAchievement = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/school/${encodeURIComponent(schoolId)}/achievements`, {
        method: 'POST',
        body: {
          title: achTitle.trim(),
          recipientName: achRecipient.trim(),
          achievementLevel: achLevel,
          recipientType: 'student',
          visibility: 'public',
          status: 'published',
        },
      });
      setAchTitle('');
      setAchRecipient('');
      await loadContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save achievement.');
    }
  };

  const handleAddNews = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/school/${encodeURIComponent(schoolId)}/news`, {
        method: 'POST',
        body: {
          title: newsTitle.trim(),
          excerpt: newsBody.trim().slice(0, 180),
          bodyMarkdown: newsBody.trim(),
          visibility: 'public',
          status: 'published',
        },
      });
      setNewsTitle('');
      setNewsBody('');
      await loadContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish news post.');
    }
  };

  const handleAddNotice = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/school/${encodeURIComponent(schoolId)}/notices`, {
        method: 'POST',
        body: {
          title: noticeTitle.trim(),
          body: noticeBody.trim(),
          priority: 'high',
          audience: noticeAudience,
          status: 'published',
          isPinned: true,
        },
      });
      setNoticeTitle('');
      setNoticeBody('');
      await loadContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish notice.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Achievements, News &amp; Notices
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Publish school awards, campus news stories, and official notices directly to your public
          institutional portal or internal school feed.
        </p>
      </header>

      {authRequired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-2.5 text-sm text-amber-900">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Viewing published items in read-only mode. Sign in with a verified school account to
              publish new entries.
            </span>
          </div>
          <Link to="/login" className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white">
            Sign In
          </Link>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setTab('achievements')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer ${
            tab === 'achievements' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="h-4 w-4" />
          Achievements ({achievements.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('news')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer ${
            tab === 'news' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Newspaper className="h-4 w-4" />
          News Posts ({news.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('notices')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer ${
            tab === 'notices' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bell className="h-4 w-4" />
          Notices ({notices.length})
        </button>
      </div>

      {tab === 'achievements' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form
            onSubmit={handleAddAchievement}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <h2 className="text-sm font-bold text-slate-900">Record Public Achievement</h2>
            <div>
              <label htmlFor="achTitle" className="mb-1 block text-xs font-semibold text-slate-700">
                Title *
              </label>
              <input
                id="achTitle"
                type="text"
                required
                value={achTitle}
                onChange={(e) => setAchTitle(e.target.value)}
                placeholder="1st Place — District Science Quiz"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="achRecipient" className="mb-1 block text-xs font-semibold text-slate-700">
                Recipient *
              </label>
              <input
                id="achRecipient"
                type="text"
                required
                value={achRecipient}
                onChange={(e) => setAchRecipient(e.target.value)}
                placeholder="Aarav Mehta (Grade 10)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="achLevel" className="mb-1 block text-xs font-semibold text-slate-700">
                Level
              </label>
              <select
                id="achLevel"
                value={achLevel}
                onChange={(e) => setAchLevel(e.target.value as typeof achLevel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="school">School</option>
                <option value="district">District</option>
                <option value="state">State</option>
                <option value="national">National</option>
                <option value="international">International</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={authRequired}
              className="h-10 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              Publish Achievement
            </button>
          </form>

          <div className="lg:col-span-2 space-y-3">
            {achievements.map((a) => (
              <article key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase text-emerald-700">{a.achievement_level}</span>
                  <span className="text-slate-500">{a.visibility} · {a.status}</span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900">{a.title}</h3>
                {a.recipient_name && <p className="mt-1 text-xs text-slate-600">Awarded to: {a.recipient_name}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'news' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form onSubmit={handleAddNews} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Publish Campus News</h2>
            <div>
              <label htmlFor="newsTitle" className="mb-1 block text-xs font-semibold text-slate-700">
                Headline *
              </label>
              <input
                id="newsTitle"
                type="text"
                required
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                placeholder="Annual Sports Day Highlights"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="newsBody" className="mb-1 block text-xs font-semibold text-slate-700">
                Article Content *
              </label>
              <textarea
                id="newsBody"
                rows={4}
                required
                value={newsBody}
                onChange={(e) => setNewsBody(e.target.value)}
                placeholder="Write the full announcement..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={authRequired}
              className="h-10 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              Publish News
            </button>
          </form>

          <div className="lg:col-span-2 space-y-3">
            {news.map((n) => (
              <article key={n.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-bold text-slate-900">{n.title}</h3>
                {n.excerpt && <p className="mt-2 text-sm text-slate-600">{n.excerpt}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'notices' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form onSubmit={handleAddNotice} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Post Official Notice</h2>
            <div>
              <label htmlFor="noticeTitle" className="mb-1 block text-xs font-semibold text-slate-700">
                Notice Title *
              </label>
              <input
                id="noticeTitle"
                type="text"
                required
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="Term-End Schedule Released"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="noticeAudience" className="mb-1 block text-xs font-semibold text-slate-700">
                Audience
              </label>
              <select
                id="noticeAudience"
                value={noticeAudience}
                onChange={(e) => setNoticeAudience(e.target.value as typeof noticeAudience)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="public">Public (Visible on School Website)</option>
                <option value="school_all">Internal School Members Only</option>
              </select>
            </div>
            <div>
              <label htmlFor="noticeBody" className="mb-1 block text-xs font-semibold text-slate-700">
                Details *
              </label>
              <textarea
                id="noticeBody"
                rows={4}
                required
                value={noticeBody}
                onChange={(e) => setNoticeBody(e.target.value)}
                placeholder="Notice details..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={authRequired}
              className="h-10 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              Post Notice
            </button>
          </form>

          <div className="lg:col-span-2 space-y-3">
            {notices.map((n) => (
              <article key={n.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
                <div className="flex items-center justify-between text-xs text-amber-800">
                  <span className="font-semibold uppercase">{n.audience}</span>
                  <span className="uppercase">{n.priority}</span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900">{n.title}</h3>
                <p className="mt-1.5 text-sm text-slate-700">{n.body}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
