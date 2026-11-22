import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  School,
  Settings,
  Users,
} from "lucide-react";
import Sidebar, { type NavItem } from "../../GlobalComponents/SideBar";

const COLLAPSE_KEY = "sidebar-collapsed";
const BASE = "/super-admin-dashboard";

/* Nav options live here and are sent to the Sidebar. First item = home. */
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: BASE, icon: LayoutDashboard },
  { label: "Schools", to: `${BASE}/schools`, icon: School },
  { label: "Onboarding & Tenants", to: `${BASE}/onboarding`, icon: Building2 },
  { label: "Services & Approvals", to: `${BASE}/services`, icon: CreditCard },
  { label: "Students", to: `${BASE}/students`, icon: Users },
  { label: "Audit & Outbox", to: `${BASE}/audit-outbox`, icon: Activity },
  { label: "Platform Settings", to: `${BASE}/settings`, icon: Settings },
];

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

export default function SuperAdminDashBoard() {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  // Persist the collapsed state (kept out of the state updater so it stays pure)
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage blocked – ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      {/* Sidebar owns the mobile menu button + drawer */}
      <Sidebar
        navItems={NAV_ITEMS}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        loginPath="/login"
        title="SchoolGrid"
        subtitle="SuperAdmin Console"
        userLabel="SuperAdmin"
      />

      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}