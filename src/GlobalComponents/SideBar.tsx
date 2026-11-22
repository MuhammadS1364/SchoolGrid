import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  School,
  Loader2,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth/AuthContext";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface SidebarProps {
  navItems: NavItem[]; // sent from the Dashboard (first item = home)
  collapsed: boolean; // desktop (lg+) icon-only mode
  onToggle: () => void; // desktop collapse / expand
  loginPath?: string;
  title?: string;
  subtitle?: string;
  userLabel?: string;
}

/*  < lg  : off-canvas drawer with its own hamburger button (phones + tablets)
    >= lg : static sidebar, can collapse to an icon rail                      */
export default function Sidebar({
  navItems,
  collapsed,
  onToggle,
  loginPath = "/login",
  title = "EduCloud",
  subtitle = "School Management",
  userLabel = "Admin User",
}: SidebarProps) {
  const navigate = useNavigate();
  const { key } = useLocation();
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // Drawer is "open" only for the history entry it was opened on,
  // so any navigation closes it automatically.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const mobileOpen = openedAt === key;
  const openMenu = useCallback(() => setOpenedAt(key), [key]);
  const closeMenu = useCallback(() => setOpenedAt(null), []);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef<boolean>(false);

  // While the drawer is open: Esc closes it, page behind can't scroll
  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  // Focus: into the drawer when it opens, back to the menu button when it closes
  useEffect(() => {
    if (mobileOpen) {
      closeButtonRef.current?.focus();
    } else if (wasOpen.current) {
      menuButtonRef.current?.focus();
    }
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await signOut();
    } finally {
      setLoggingOut(false);
      navigate(loginPath, { replace: true });
    }
  };

  const initial = (email[0] ?? "A").toUpperCase();
  const homePath = navItems[0]?.to;
  const hideLabel = collapsed ? "lg:hidden" : "";

  return (
    <>
      {/* phone / tablet: open-menu button (hidden on desktop and while open) */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={openMenu}
        aria-label="Open menu"
        aria-controls="app-sidebar"
        aria-expanded={mobileOpen}
        className={`fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden ${
          mobileOpen ? "invisible" : ""
        }`}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* phone / tablet: backdrop behind the drawer */}
      <div
        aria-hidden="true"
        onClick={closeMenu}
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity duration-200 motion-reduce:transition-none lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl transition-[transform,visibility,width] duration-200 motion-reduce:transition-none ${
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        } lg:visible lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          collapsed ? "lg:w-16" : "lg:w-56"
        }`}
      >
        {/* Brand + buttons */}
        <div
          className={`flex items-center gap-3 border-b border-slate-200 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] ${
            collapsed ? "lg:flex-col lg:px-0 lg:py-4" : "lg:py-5"
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <School className="h-5 w-5" />
          </div>

          <div className={`min-w-0 flex-1 ${hideLabel}`}>
            <p className="truncate text-sm font-bold leading-tight text-slate-900">{title}</p>
            <p className="truncate text-[11px] leading-tight text-slate-500">{subtitle}</p>
          </div>

          {/* phone / tablet: close drawer */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          {/* desktop: collapse / expand */}
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="hidden rounded p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:block"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav buttons (from props) */}
        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-2.5 py-4" aria-label="Main">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === homePath}
              onClick={closeMenu}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:min-h-0 lg:py-2 ${
                  collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""
                } ${isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"}`
              }
            >
              <Icon className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" />
              <span className={`truncate ${hideLabel}`}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div
          className={`flex items-center gap-3 border-t border-slate-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            collapsed ? "lg:flex-col lg:px-0" : ""
          }`}
        >
          <div
            title={collapsed ? email || userLabel : undefined}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
          >
            {initial}
          </div>

          <div className={`min-w-0 flex-1 ${hideLabel}`}>
            <p className="truncate text-sm font-medium text-slate-900">{userLabel}</p>
            <p className="truncate text-[11px] text-slate-500">{email || "—"}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
            title="Log out"
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60 lg:h-8 lg:w-8"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}