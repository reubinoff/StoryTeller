import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  IconBell,
  IconBook,
  IconDoc,
  IconHelp,
  IconHome,
  IconLogout,
  IconPen,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkle,
  IconFlame,
  IconTrophy,
} from "./Icons";
import { BrandLogo } from "./Mascot";
import { useAuth } from "~/lib/auth";

interface NavItem {
  id: string;
  label: string;
  to: string;
  Icon: (props: { size?: number; className?: string }) => ReactNode;
  match?: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    to: "/dashboard",
    Icon: IconHome,
    match: (p) => p === "/dashboard" || p === "/",
  },
  {
    id: "courses",
    label: "Courses",
    to: "/courses",
    Icon: IconBook,
    match: (p) => p.startsWith("/courses"),
  },
  {
    id: "tasks",
    label: "My Tasks",
    to: "/tasks",
    Icon: IconDoc,
    match: (p) => p.startsWith("/tasks"),
  },
  {
    id: "achievements",
    label: "Achievements",
    to: "/achievements",
    Icon: IconTrophy,
    match: (p) => p === "/achievements",
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    to: "/settings",
    Icon: IconSettings,
    match: (p) => p === "/settings",
  },
  {
    id: "help",
    label: "Help & FAQ",
    to: "/help",
    Icon: IconHelp,
    match: (p) => p === "/help",
  },
];

interface ShellProps {
  children: ReactNode;
}

export const Shell = ({ children }: ShellProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signout, metrics } = useAuth();
  const pathname = location.pathname;

  const handleSignout = () => {
    signout();
    navigate("/");
  };

  if (!user) return null;

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <Link
            to="/dashboard"
            className="brand-row brand-logo-link"
            style={{ color: "inherit" }}
          >
            <BrandLogo width={154} />
          </Link>
          <div className="col gap-4">
            {NAV_ITEMS.map(({ id, label, to, Icon, match }) => {
              const active = match ? match(pathname) : pathname === to;
              return (
                <Link
                  key={id}
                  to={to}
                  className={`nav-item ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} className="nav-icon" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
          <div style={{ marginTop: "auto" }}>
            <div className="col gap-4">
              {BOTTOM_ITEMS.map(({ id, label, to, Icon, match }) => {
                const active = match ? match(pathname) : pathname === to;
                return (
                  <Link
                    key={id}
                    to={to}
                    className={`nav-item ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} className="nav-icon" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
            <div
              style={{
                borderTop: "1px solid var(--line)",
                marginTop: 14,
                paddingTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div className="avatar">{user.first_name[0]}</div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.first_name} {user.last_name}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                  Grade {user.grade_level} · {user.year_of_birth}
                </div>
              </div>
            </div>
          </div>
        </aside>
        <div className="col" style={{ minWidth: 0 }}>
          <header className="topbar">
            <div className="topbar-search">
              <IconSearch size={16} />
              <span>Search courses, tasks…</span>
            </div>
            <div className="row gap-12 topbar-actions" style={{ marginLeft: "auto" }}>
              <span className="streak-pill">
                <IconFlame size={14} />{" "}
                <span className="pill-full-label">
                  {metrics.current_streak} day streak
                </span>
                <span className="pill-compact-label" aria-hidden="true">
                  {metrics.current_streak}
                </span>
              </span>
              <span className="xp-pill">
                <IconSparkle size={14} />{" "}
                <span className="pill-full-label">
                  {metrics.xp_total.toLocaleString()} XP
                </span>
                <span className="pill-compact-label" aria-hidden="true">
                  {metrics.xp_total.toLocaleString()}
                </span>
              </span>
              <button
                className="icon-btn"
                aria-label="Help"
                onClick={() => navigate("/help")}
              >
                <IconHelp size={18} />
              </button>
              <button className="icon-btn" aria-label="Notifications">
                <IconBell size={18} />
              </button>
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={handleSignout}
              >
                <IconLogout size={18} />
              </button>
            </div>
          </header>
          <main className="main-content page-fadein" key={pathname}>
            {children}
          </main>
        </div>
      </div>
      <MobileTabbar pathname={pathname} />
    </>
  );
};

const MobileTabbar = ({ pathname }: { pathname: string }) => {
  const tabs: Array<{
    to: string;
    label: string;
    Icon: (p: { size?: number }) => ReactNode;
    match: (p: string) => boolean;
    center?: boolean;
  }> = [
    {
      to: "/dashboard",
      label: "Home",
      Icon: IconHome,
      match: (p) => p === "/dashboard",
    },
    {
      to: "/courses",
      label: "Courses",
      Icon: IconBook,
      match: (p) => p.startsWith("/courses"),
    },
    {
      to: "/tasks",
      label: "Tasks",
      Icon: IconDoc,
      match: (p) => p.startsWith("/tasks"),
    },
    {
      to: "/courses",
      label: "New task",
      Icon: IconPlus,
      match: () => false,
      center: true,
    },
    {
      to: "/achievements",
      label: "Badges",
      Icon: IconTrophy,
      match: (p) => p === "/achievements",
    },
    {
      to: "/settings",
      label: "Profile",
      Icon: IconPen,
      match: (p) => p === "/settings",
    },
  ];
  return (
    <nav className="mobile-tabbar" aria-label="Primary mobile navigation">
      {tabs.map((t, i) => {
        const active = t.match(pathname);
        const cls = `tab${active ? " active" : ""}${t.center ? " center" : ""}`;
        return (
          <Link
            key={i}
            to={t.to}
            className={cls}
            aria-current={active ? "page" : undefined}
            aria-label={t.center ? "Choose a course to roll a new task" : undefined}
          >
            <t.Icon size={t.center ? 22 : 18} />
            {t.center ? <span className="sr">{t.label}</span> : <span>{t.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
};
