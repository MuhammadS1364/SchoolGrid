import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import { usePageSeo } from '../lib/seo/usePageSeo';

export default function TermsOfServicePage() {
  usePageSeo({
    title: 'Terms of Service – SchoolGrid',
    description:
      'Review the Terms of Service governing institutional workspaces, user accounts, public portals, and data responsibilities on SchoolGrid.',
  });

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900">
            <img src="/logo.png" alt="SchoolGrid logo" className="h-8 w-auto object-contain" />
            <span>SchoolGrid</span>
          </Link>
          <nav aria-label="Legal navigation" className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link to="/schools" className="hover:text-slate-900">Schools</Link>
            <Link to="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm space-y-6">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Effective Date: November 22, 2026 · Application: SchoolGrid (https://ms-school-grid.vercel.app)
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              By accessing or using SchoolGrid (https://ms-school-grid.vercel.app), including its public
              school portals, onboarding forms, and authenticated dashboards, you agree to these Terms
              of Service and our{' '}
              <Link to="/privacy" className="font-semibold text-indigo-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. Institutional Accounts &amp; Roles</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Each registered school is responsible for managing its School Admin, Wing Manager, Teacher,
              Content Manager, and Student invitations. Account credentials and one-time invitation links
              must not be shared across unauthorized parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. Acceptable Use &amp; Content Ownership</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Schools retain full ownership of all institutional content, notices, programmes, and student
              records published through SchoolGrid. Administrators must ensure that only lawful,
              authorized, and parent/institution-approved information is marked as &ldquo;public&rdquo;.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">4. Service Plans &amp; Availability</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Paid institutional plans require SuperAdmin verification prior to full activation. We may
              suspend or archive tenant workspaces that violate security policies or remain inactive
              after notice.
            </p>
          </section>

          <section className="space-y-2 border-t border-slate-100 pt-5">
            <h2 className="text-base font-bold text-slate-900">5. Contact</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Questions regarding these Terms may be directed to{' '}
              <a
                href="mailto:shafeealam1364@gmail.com"
                className="font-semibold text-indigo-600 hover:underline"
              >
                shafeealam1364@gmail.com
              </a>
              .
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
