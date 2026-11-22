import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, School } from 'lucide-react';
import { apiRequest } from '../lib/api/platformApi';

function slugifyPreview(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PublicSchoolRegistrationPage() {
  const [schoolName, setSchoolName] = useState('');
  const [requestedSlug, setRequestedSlug] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: string; schoolName: string; requestedSlug: string } | null>(null);

  const effectiveSlug = useMemo(
    () => slugifyPreview(requestedSlug || schoolName),
    [requestedSlug, schoolName]
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!schoolName.trim() || !effectiveSlug || !contactName.trim() || !contactEmail.trim()) {
      setError('Please complete all required school and administrator fields.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiRequest<{ id: string; schoolName: string; requestedSlug: string; status: string }>(
        '/api/public/school-registration',
        {
          method: 'POST',
          requireAuth: false,
          body: {
            schoolName: schoolName.trim(),
            requestedSlug: effectiveSlug,
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: contactPhone.trim() || undefined,
            city: city.trim() || undefined,
            state: stateName.trim() || undefined,
            country: 'India',
            notes: notes.trim() || undefined,
          },
        }
      );
      setSubmitted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit registration request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-slate-900">
            SchoolGrid
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link to="/schools" className="hover:text-slate-900">
              Schools Directory
            </Link>
            <Link to="/services" className="hover:text-slate-900">
              Plans &amp; Services
            </Link>
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {submitted ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">Onboarding Request Submitted</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your registration for <strong>{submitted.schoolName}</strong> (
              <span className="font-mono text-slate-800">/s/{submitted.requestedSlug}</span>) has been
              queued for SuperAdmin approval. Once approved, your school workspace, default roles,
              and initial administrator invitation will be provisioned atomically.
            </p>
            <p className="font-mono text-xs text-slate-400">Reference ID: {submitted.id}</p>
            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <Link
                to="/schools"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Browse Active Schools
              </Link>
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <School className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Register Your Institution
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Submit an institutional onboarding request for SuperAdmin verification and
                  multi-tenant workspace provisioning.
                </p>
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="schoolName" className="mb-1 block text-xs font-semibold text-slate-700">
                  School Name *
                </label>
                <input
                  id="schoolName"
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. St. Xavier Senior Secondary School"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label htmlFor="requestedSlug" className="mb-1 block text-xs font-semibold text-slate-700">
                  Public Portal Slug *
                </label>
                <input
                  id="requestedSlug"
                  type="text"
                  value={requestedSlug}
                  onChange={(e) => setRequestedSlug(e.target.value)}
                  placeholder="st-xavier-high"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Public website URL: <span className="font-mono text-slate-700">/s/{effectiveSlug || 'your-school'}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contactName" className="mb-1 block text-xs font-semibold text-slate-700">
                    Primary Contact / Principal *
                  </label>
                  <input
                    id="contactName"
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Dr. Ananya Sharma"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="contactEmail" className="mb-1 block text-xs font-semibold text-slate-700">
                    Official Administrator Email *
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="principal@school.edu"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="contactPhone" className="mb-1 block text-xs font-semibold text-slate-700">
                    Phone
                  </label>
                  <input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="mb-1 block text-xs font-semibold text-slate-700">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="stateName" className="mb-1 block text-xs font-semibold text-slate-700">
                    State
                  </label>
                  <input
                    id="stateName"
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="Karnataka"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="mb-1 block text-xs font-semibold text-slate-700">
                  Institutional Notes (Wings, Google Drive needs, approximate enrollment)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell us about your academic wings, clubs, and media archiving requirements."
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Submitting Request...' : 'Submit Institutional Registration'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
