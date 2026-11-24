import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  School,
  Settings,
  Users,
} from 'lucide-react';
import Sidebar, { type NavItem } from '../../GlobalComponents/SideBar';
import { useAuth } from '../../lib/auth/AuthContext';
import { canAccessDashboard } from '../../lib/auth/roleResolver';
import { isUsingMockSupabase } from '../../lib/SupaBaseClient/SupaBaseClientFunction';

const COLLAPSE_KEY = 'sidebar-collapsed';
const BASE = '/super-admin-dashboard';

/* Nav options live here and are sent to the Sidebar. First item = home. */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: BASE, icon: LayoutDashboard },
  { label: 'Schools', to: `${BASE}/schools`, icon: School },
  { label: 'Onboarding & Tenants', to: `${BASE}/onboarding`, icon: Building2 },
  { label: 'Services & Approvals', to: `${BASE}/services`, icon: CreditCard },
  { label: 'Students', to: `${BASE}/students`, icon: Users },
  { label: 'Audit & Outbox', to: `${BASE}/audit-outbox`, icon: Activity },
  { label: 'Platform Settings', to: `${BASE}/settings`, icon: Settings },
];

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

export default function SuperAdminDashBoard() {
  const { user, role, dashboardPath, fullName, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const isSandboxPreview = searchParams.get('sandbox') === '1' || isUsingMockSupabase();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage blocked – ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
        Verifying SuperAdmin access...
      </div>
    );
  }

  // Strictly block non-SuperAdmin authenticated users from viewing the full platform database
  if (user && !canAccessDashboard(role, 'SuperAdmin')) {
    return <Navigate to={dashboardPath} replace />;
  }

  // Require login when connected to live Supabase (allow unauthenticated preview only in sandbox mode)
  if (!user && !isSandboxPreview) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar
        navItems={NAV_ITEMS}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        loginPath="/login"
        title="SchoolGrid"
        subtitle="SuperAdmin Console"
        userLabel={fullName || user?.email || 'SuperAdmin'}
      />

      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}