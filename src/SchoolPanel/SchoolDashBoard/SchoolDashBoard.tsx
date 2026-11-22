import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Clock,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Newspaper,
  Sparkles,
  Users,
} from 'lucide-react';
import Sidebar, { type NavItem } from '../../GlobalComponents/SideBar';
import { SchoolProvider, useActiveSchool } from '../SchoolContext';

const COLLAPSE_KEY = 'school-sidebar-collapsed';
const BASE = '/school-dashboard';

const SCHOOL_NAV_ITEMS: NavItem[] = [
  { label: 'Overview', to: BASE, icon: LayoutDashboard },
  { label: 'Wings & Invites', to: `${BASE}/wings`, icon: Sparkles },
  { label: 'Programmes', to: `${BASE}/programmes`, icon: Calendar },
  { label: 'News & Awards', to: `${BASE}/content`, icon: Newspaper },
  { label: 'Classes', to: `${BASE}/classes`, icon: BookOpen },
  { label: 'Teachers', to: `${BASE}/teachers`, icon: GraduationCap },
  { label: 'Students', to: `${BASE}/students`, icon: Users },
  { label: 'Plan Features', to: `${BASE}/features`, icon: Layers },
];

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

function SchoolDashboardShell() {
  const { school, allSchools, loading, selectSchoolById } = useActiveSchool();
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading School Dashboard...
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">No School Linked Yet</h1>
          <p className="text-sm text-slate-600">
            Select a service plan and complete SuperAdmin approval to register your school.
          </p>
          <Link
            to="/services"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            View Service Plans
          </Link>
        </div>
      </div>
    );
  }

  if (!school.is_approved) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Payment Verification Pending
          </h1>
          <p className="text-sm text-slate-600">
            <strong>{school.school_title}</strong> is waiting for backend payment approval from
            SuperAdmin before its School Dashboard opens.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/super-admin-dashboard/schools"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Approve in SuperAdmin Console
            </Link>
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar
        navItems={SCHOOL_NAV_ITEMS}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        loginPath="/login"
        title={school.school_title}
        subtitle={school.school_type || 'School Console'}
        userLabel={school.school_manager || 'School Admin'}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Contextual School Top Bar */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 pl-16 sm:px-6 lg:pl-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {school.school_title}
            </p>
            <p className="truncate text-xs text-slate-500">
              {school.schoole_gmail || 'No email linked'} · {school.school_type || 'School'} ·{' '}
              {[school.loc_city_village, school.loc_state].filter(Boolean).join(', ') || 'Campus'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {allSchools.length > 1 && (
              <select
                aria-label="Switch active school"
                value={school.school_id}
                onChange={(e) => selectSchoolById(e.target.value)}
                className="hidden h-9 max-w-[220px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 sm:block"
              >
                {allSchools.map((s) => (
                  <option key={s.school_id} value={s.school_id}>
                    {s.school_title} {!s.is_approved ? '(Pending)' : ''}
                  </option>
                ))}
              </select>
            )}
            <Link
              to="/super-admin-dashboard/schools"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
            >
              SuperAdmin
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function SchoolDashBoard() {
  return (
    <SchoolProvider>
      <SchoolDashboardShell />
    </SchoolProvider>
  );
}