import { useMemo, useState, type ReactNode } from "react";
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
  IconSettings,
  IconSparkle,
  IconFlame,
  IconTrophy,
} from "./Icons";
import { BrandLogo } from "./Mascot";
import { useAuth } from "~/lib/auth";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMetrics,
  useNotifications,
} from "~/lib/api/queries";
import type { DashboardMetrics, Notification } from "~/lib/api/types";
import { avatarImageUrl } from "~/lib/avatar";
import { englishLevelShortLabel } from "~/lib/english-level";

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

const DEFAULT_METRICS: DashboardMetrics = {
  tasks_completed: 0,
  current_streak: 0,
  longest_streak: 0,
  avg_score: 0,
  xp_total: 0,
  level: 1,
  level_label: "Apprentice",
};

interface ShellProps {
  children: ReactNode;
}

export const Shell = ({ children }: ShellProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signout } = useAuth();
  const metricsQuery = useMetrics(Boolean(user));
  const notifications = useNotifications(Boolean(user));
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pathname = location.pathname;
  const metrics = metricsQuery.data ?? DEFAULT_METRICS;
  const avatarSrc = avatarImageUrl(user?.avatar_url ?? null);
  const notificationItems = useMemo(
    () => notifications.data?.items ?? [],
    [notifications.data?.items]
  );
  const unreadCount = useMemo(
    () => notificationItems.filter((item) => !item.read_at).length,
    [notificationItems]
  );

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
              {avatarSrc ? (
                <img className="avatar" src={avatarSrc} alt="" />
              ) : (
                <div className="avatar">{user.first_name[0]}</div>
              )}
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
                  Level {user.english_level} · {englishLevelShortLabel(user.english_level)}
                </div>
              </div>
            </div>
          </div>
        </aside>
        <div className="col" style={{ minWidth: 0 }}>
          <header className="topbar">
            <div className="topbar-greeting" aria-label="Current progress">
              <span>Today</span>
              <strong>Story mission</strong>
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
              <div className="notification-anchor">
              <button
                className={`icon-btn ${unreadCount ? "has-unread" : ""}`}
                aria-label={
                  unreadCount
                    ? `${unreadCount} unread notifications`
                    : "Notifications"
                }
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <IconBell size={18} />
                {unreadCount > 0 && (
                  <span className="notification-dot" aria-hidden="true" />
                )}
              </button>
              {notificationsOpen && (
                <div
                  className="notification-popover"
                  role="dialog"
                  aria-label="Notifications"
                >
                  <div className="notification-popover-header">
                    <span>Notifications</span>
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => markAllNotificationsRead.mutate()}
                      disabled={!unreadCount || markAllNotificationsRead.isPending}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="notification-list">
                    {notificationItems.length ? (
                      notificationItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`notification-item ${
                            item.read_at ? "" : "unread"
                          }`}
                          onClick={() => {
                            if (!item.read_at) markNotificationRead.mutate(item.id);
                          }}
                        >
                          <span>{notificationTitle(item)}</span>
                          <small>{notificationDetail(item)}</small>
                        </button>
                      ))
                    ) : (
                      <div className="notification-empty">No notifications yet</div>
                    )}
                  </div>
                </div>
              )}
              </div>
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

function notificationTitle(notification: Notification): string {
  const title = notification.payload.title;
  if (typeof title === "string" && title.trim()) return title;
  switch (notification.kind) {
    case "task_completed":
      return "Task completed";
    case "task_failed":
      return "Task needs attention";
    case "streak_milestone":
      return "Streak milestone";
    default:
      return "Storyteller update";
  }
}

function notificationDetail(notification: Notification): string {
  const detail = notification.payload.detail ?? notification.payload.message;
  if (typeof detail === "string" && detail.trim()) return detail;
  return new Date(notification.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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
      to: "/tasks",
      label: "Tasks",
      Icon: IconDoc,
      match: (p) => p.startsWith("/tasks"),
    },
    {
      to: "/courses",
      label: "New",
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
      label: "More",
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
          >
            <t.Icon size={t.center ? 22 : 18} />
            {t.center ? <span className="sr">{t.label}</span> : <span>{t.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
};
