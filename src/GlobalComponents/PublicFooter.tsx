import { Link } from 'react-router-dom';

export default function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="SchoolGrid logo"
            className="h-8 w-auto object-contain"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">SchoolGrid</p>
            <p className="text-xs text-slate-500">
              One Platform. Multiple Schools. Unified Management. © {year}
            </p>
          </div>
        </div>

        <nav
          aria-label="Legal and platform links"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-600"
        >
          <Link to="/schools" className="hover:text-slate-900 transition-colors">
            Schools Directory
          </Link>
          <Link to="/services" className="hover:text-slate-900 transition-colors">
            Plans &amp; Services
          </Link>
          <Link to="/register-school" className="hover:text-slate-900 transition-colors">
            Register School
          </Link>
          <Link to="/privacy" className="hover:text-slate-900 transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-slate-900 transition-colors">
            Terms of Service
          </Link>
          <a
            href="mailto:shafeealam1364@gmail.com"
            className="hover:text-slate-900 transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
