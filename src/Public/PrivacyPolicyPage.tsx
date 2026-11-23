import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { usePageSeo } from '../lib/seo/usePageSeo';

export default function PrivacyPolicyPage() {
  usePageSeo({
    title: 'Privacy Policy – SchoolGrid',
    description:
      'Learn how SchoolGrid protects school, teacher, student, and Google account data with strict multi-tenant isolation and security safeguards.',
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
            <Link to="/terms" className="hover:text-slate-900">Terms of Service</Link>
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
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Effective Date: November 22, 2026 · Application: SchoolGrid (https://ms-school-grid.vercel.app)
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">1. Overview &amp; Scope</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              SchoolGrid (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the Platform&rdquo;) provides a multi-tenant
              institutional management and public portal platform for schools, administrators, teachers,
              and students. This Privacy Policy explains what information we collect, how it is used,
              and how we protect institutional and personal data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
              <li>
                <strong>Account &amp; Google Sign-In Data:</strong> When you sign in using Email/Password or
                Google OAuth via Supabase Authentication, we receive your verified email address, display
                name, and unique authentication identifier solely to authenticate your session and assign
                your institutional role.
              </li>
              <li>
                <strong>Institutional &amp; School Records:</strong> Schools voluntarily enter campus
                profiles, academic wings, classes, staff rosters, student records, programmes, notices,
                and achievements within their tenant-isolated workspace.
              </li>
              <li>
                <strong>Optional Per-School Google Drive Integration:</strong> Where explicitly enabled by
                an institution&apos;s administrator, documents remain stored in that school&apos;s own Google
                Drive account, while SchoolGrid records only document metadata references.
              </li>
              <li>
                <strong>Security &amp; Audit Logs:</strong> We record append-only audit events (action type,
                timestamp, actor ID) with automated redaction of tokens and secrets to preserve account
                security and institutional compliance.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. How We Use Information</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              We use collected data strictly to authenticate users, enforce role-based access control
              (SuperAdmin, School Admin, Wing Manager, Teacher, Content Manager, Student), render
              school-approved public pages, and maintain platform reliability. We never sell personal
              or student data to third parties or use Google user data for advertising.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">4. Multi-Tenant Isolation &amp; Security</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              All school records are strictly isolated by tenant identifier using database-level composite
              foreign keys, server-side permission checks, hashed single-use invitation tokens, encrypted
              HTTPS transport, and role-scoped queries. Draft items and private student information are
              never exposed on public school websites.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">5. Data Retention &amp; Deletion</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Schools retain ownership of their institutional data and may request export, suspension, or
              permanent removal of their records at any time by contacting the platform administrator.
            </p>
          </section>

          <section className="space-y-2 border-t border-slate-100 pt-5">
            <h2 className="text-base font-bold text-slate-900">6. Contact Us</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              For privacy inquiries, Google OAuth verification questions, or data removal requests,
              contact us at{' '}
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
