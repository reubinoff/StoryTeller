import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  Filter,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { api, ApiError } from "./api";
import type {
  AdminAuditEvent,
  AdminOverview,
  AdminSession,
  AdminUserDetail,
  AdminUserSummary,
  Page,
  UserRole,
  UserStatus,
} from "./types";

type AuthState = "loading" | "login" | "denied" | "ready";
type RangeDays = 7 | 30 | 90;

const EMPTY_USERS: Page<AdminUserSummary> = { items: [], next_cursor: null };
const EMPTY_AUDIT: Page<AdminAuditEvent> = { items: [], next_cursor: null };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.problem.detail || error.problem.title;
  if (error instanceof Error) return error.message;
  return "Request failed";
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function initials(user: Pick<AdminUserSummary, "first_name" | "last_name" | "email">) {
  const first = user.first_name?.[0] || user.email[0] || "A";
  const last = user.last_name?.[0] || "";
  return `${first}${last}`.toUpperCase();
}

interface AppProps {
  initialAuthError?: string;
  onAuthenticated?: () => void;
}

export function App({ initialAuthError, onAuthenticated }: AppProps) {
  const [authState, setAuthState] = useState<AuthState>(
    initialAuthError ? "login" : "loading"
  );
  const [authError, setAuthError] = useState<string | null>(initialAuthError ?? null);
  const [session, setSession] = useState<AdminSession | null>(null);

  const hydrateSession = useCallback(async () => {
    try {
      const next = await api.admin.session();
      setSession(next);
      setAuthState("ready");
      setAuthError(null);
      onAuthenticated?.();
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setAuthState("denied");
        setAuthError(null);
        return null;
      }
      setAuthState("login");
      setAuthError(initialAuthError ?? null);
      return null;
    }
  }, [initialAuthError, onAuthenticated]);

  useEffect(() => {
    if (initialAuthError) return;
    void hydrateSession();
  }, [hydrateSession, initialAuthError]);

  const handleSignout = useCallback(async () => {
    setSession(null);
    setAuthState("login");
    await api.auth.logout().catch(() => undefined);
  }, []);

  if (authState === "loading") return <LoadingScreen />;

  if (authState === "login") {
    return (
      <LoginScreen
        error={authError}
        onLogin={async (email, password) => {
          setAuthError(null);
          await api.auth.login({ email, password });
          await hydrateSession();
        }}
      />
    );
  }

  if (authState === "denied") {
    return <DeniedScreen onSignout={handleSignout} />;
  }

  if (!session) return <LoadingScreen />;

  return <AdminWorkspace session={session} onSignout={handleSignout} />;
}

function LoadingScreen() {
  return (
    <main className="center-screen">
      <div className="loading-mark" aria-label="Loading admin console">
        <ShieldCheck size={28} />
      </div>
    </main>
  );
}

function LoginScreen({
  error,
  onLogin,
}: {
  error: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      setLocalError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="admin-login-title">
        <div className="brand-lock">
          <ShieldCheck size={26} />
        </div>
        <h1 id="admin-login-title">StoryTeller Admin</h1>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {(error || localError) && (
            <div className="inline-alert" role="alert">
              <AlertTriangle size={16} />
              <span>{localError || error}</span>
            </div>
          )}
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? <RefreshCw size={16} className="spin" /> : <Shield size={16} />}
            <span>Sign in</span>
          </button>
        </form>
        <a className="secondary-btn" href={api.auth.googleStartUrl("/")}>
          <ShieldCheck size={16} />
          <span>Continue with Google</span>
        </a>
      </section>
    </main>
  );
}

function DeniedScreen({ onSignout }: { onSignout: () => void }) {
  return (
    <main className="center-screen">
      <section className="denied-panel" aria-labelledby="access-denied-title">
        <div className="danger-mark">
          <Ban size={28} />
        </div>
        <h1 id="access-denied-title">Access denied</h1>
        <button className="secondary-btn" type="button" onClick={onSignout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </section>
    </main>
  );
}

function AdminWorkspace({
  session,
  onSignout,
}: {
  session: AdminSession;
  onSignout: () => void;
}) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<Page<AdminUserSummary>>(EMPTY_USERS);
  const [audit, setAudit] = useState<Page<AdminAuditEvent>>(EMPTY_AUDIT);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<UserStatus | "">("active");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadUsers = useCallback(
    async (nextCursor: string | null = null) => {
      const page = await api.admin.users({
        query,
        role,
        status,
        limit: 50,
        cursor: nextCursor,
      });
      setUsers((prev) =>
        nextCursor ? { items: [...prev.items, ...page.items], next_cursor: page.next_cursor } : page
      );
      if (!selectedUser && page.items[0]) {
        const detail = await api.admin.user(page.items[0].id);
        setSelectedUser(detail);
      }
    },
    [query, role, selectedUser, status]
  );

  const loadAudit = useCallback(async (targetId?: string) => {
    setAudit(await api.admin.audit({ target_user_id: targetId, limit: 25 }));
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [nextOverview, nextUsers, nextAudit] = await Promise.all([
        api.admin.overview(rangeDays),
        api.admin.users({ query, role, status, limit: 50 }),
        api.admin.audit({ limit: 25 }),
      ]);
      setOverview(nextOverview);
      setUsers(nextUsers);
      setAudit(nextAudit);
      if (nextUsers.items[0]) {
        setSelectedUser(await api.admin.user(nextUsers.items[0].id));
      } else {
        setSelectedUser(null);
      }
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query, rangeDays, role, status]);

  useEffect(() => {
    void loadWorkspace();
    // Filters are applied by the form submit; range changes refresh the whole workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  const selectUser = async (userId: string) => {
    setActionError(null);
    const detail = await api.admin.user(userId);
    setSelectedUser(detail);
    await loadAudit(userId);
  };

  const replaceUser = (detail: AdminUserDetail) => {
    setSelectedUser(detail);
    setUsers((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === detail.id ? detail : item)),
    }));
  };

  const runAction = async (key: string, action: () => Promise<AdminUserDetail>) => {
    setActionBusy(key);
    setActionError(null);
    try {
      const detail = await action();
      replaceUser(detail);
      await Promise.all([loadAudit(detail.id), api.admin.overview(rangeDays).then(setOverview)]);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const currentAdminId = session.user.id;

  return (
    <div className="admin-shell">
      <aside className="rail">
        <div className="rail-brand">
          <ShieldCheck size={24} />
          <span>StoryTeller</span>
        </div>
        <nav aria-label="Admin navigation">
          <a href="#overview" className="rail-link active">
            <BarChart3 size={18} />
            <span>Overview</span>
          </a>
          <a href="#users" className="rail-link">
            <Users size={18} />
            <span>Users</span>
          </a>
          <a href="#audit" className="rail-link">
            <Activity size={18} />
            <span>Audit</span>
          </a>
        </nav>
        <div className="admin-card">
          <div className="avatar">{initials(session.user)}</div>
          <div>
            <strong>{session.user.first_name}</strong>
            <span>{session.protected_admin ? "Protected admin" : "Admin"}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Admin console</p>
            <h1>Operations</h1>
          </div>
          <div className="header-actions">
            <select
              aria-label="Metric range"
              value={rangeDays}
              onChange={(event) => setRangeDays(Number(event.target.value) as RangeDays)}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <button className="icon-btn" type="button" onClick={() => void loadWorkspace()}>
              <RefreshCw size={17} />
              <span>Refresh</span>
            </button>
            <button className="icon-btn" type="button" onClick={onSignout}>
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {actionError && (
          <div className="inline-alert workspace-alert" role="alert">
            <AlertTriangle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        <section id="overview" className="overview-grid" aria-busy={loading}>
          <KpiCard label="Users" value={overview?.kpis.users_total ?? 0} tone="blue" />
          <KpiCard label="Active" value={overview?.kpis.users_active ?? 0} tone="green" />
          <KpiCard label="Admins" value={overview?.kpis.admins_total ?? 0} tone="amber" />
          <KpiCard
            label="Avg score"
            value={overview?.kpis.avg_completed_score ?? 0}
            suffix="%"
            tone="violet"
          />
        </section>

        <section className="content-grid">
          <div className="panel activity-panel">
            <div className="panel-head">
              <h2>Activity</h2>
              <span>{overview?.range_days ?? rangeDays} days</span>
            </div>
            <ActivityChart overview={overview} />
            <div className="mini-metrics">
              <Metric label="Signups" value={overview?.kpis.signups_in_range ?? 0} />
              <Metric
                label="Tasks"
                value={overview?.kpis.tasks_created_in_range ?? 0}
              />
              <Metric
                label="Completed"
                value={overview?.kpis.tasks_completed_in_range ?? 0}
              />
              <Metric
                label="Failed"
                value={overview?.kpis.tasks_failed_in_range ?? 0}
                danger
              />
            </div>
          </div>

          <section id="users" className="panel users-panel">
            <div className="panel-head">
              <h2>Users</h2>
              <span>{users.items.length} loaded</span>
            </div>
            <form
              className="filters"
              onSubmit={(event) => {
                event.preventDefault();
                void loadUsers();
              }}
            >
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="Search users"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                />
              </label>
              <select
                aria-label="Role filter"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole | "")}
              >
                <option value="">All roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
                <option value="support">Support</option>
              </select>
              <select
                aria-label="Status filter"
                value={status}
                onChange={(event) => setStatus(event.target.value as UserStatus | "")}
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deleted">Deleted</option>
              </select>
              <button className="icon-btn compact" type="submit">
                <Filter size={16} />
                <span>Apply</span>
              </button>
            </form>
            <UserTable
              users={users.items}
              selectedUserId={selectedUser?.id}
              onSelect={(userId) => void selectUser(userId)}
            />
            {users.next_cursor && (
              <button
                className="secondary-btn load-more"
                type="button"
                onClick={() => void loadUsers(users.next_cursor)}
              >
                <RefreshCw size={16} />
                <span>Load more</span>
              </button>
            )}
          </section>

          <UserDetailPanel
            user={selectedUser}
            currentAdminId={currentAdminId}
            busyKey={actionBusy}
            onPromote={(user) =>
              void runAction(`admin-${user.id}`, () => api.admin.setAdmin(user.id, true))
            }
            onDemote={(user) =>
              void runAction(`admin-${user.id}`, () => api.admin.setAdmin(user.id, false))
            }
            onSuspend={(user) =>
              void runAction(`status-${user.id}`, () =>
                api.admin.setStatus(user.id, "suspended")
              )
            }
            onReactivate={(user) =>
              void runAction(`status-${user.id}`, () =>
                api.admin.setStatus(user.id, "active")
              )
            }
          />

          <section id="audit" className="panel audit-panel">
            <div className="panel-head">
              <h2>Audit</h2>
              <span>{selectedUser ? selectedUser.email : "Global"}</span>
            </div>
            <AuditList audit={audit.items} />
          </section>
        </section>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix = "",
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: "blue" | "green" | "amber" | "violet";
}) {
  return (
    <div className={`kpi ${tone}`}>
      <span>{label}</span>
      <strong>
        {formatNumber(value)}
        {suffix}
      </strong>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric danger" : "metric"}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function ActivityChart({ overview }: { overview: AdminOverview | null }) {
  const days = overview?.daily_activity ?? [];
  const max = Math.max(
    1,
    ...days.map((day) => day.signups + day.tasks_created + day.tasks_completed)
  );
  const visible = days.slice(-30);

  return (
    <div className="chart" aria-label="Daily admin activity">
      {visible.map((day) => {
        const total = day.signups + day.tasks_created + day.tasks_completed;
        const height = Math.max(6, Math.round((total / max) * 100));
        return (
          <div className="bar-wrap" key={day.date} title={`${day.date}: ${total}`}>
            <span className="bar" style={{ height: `${height}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function UserTable({
  users,
  selectedUserId,
  onSelect,
}: {
  users: AdminUserSummary[];
  selectedUserId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Tasks</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className={selectedUserId === user.id ? "selected" : ""}
              onClick={() => onSelect(user.id)}
            >
              <td>
                <button className="table-user" type="button">
                  <span className="mini-avatar">{initials(user)}</span>
                  <span>
                    <strong>
                      {user.first_name} {user.last_name}
                    </strong>
                    <small>{user.email}</small>
                  </span>
                </button>
              </td>
              <td>
                <Pill tone={user.role === "admin" ? "admin" : "neutral"}>
                  {user.protected_admin ? "protected" : user.role}
                </Pill>
              </td>
              <td>
                <Pill tone={user.status === "active" ? "active" : "danger"}>
                  {user.status}
                </Pill>
              </td>
              <td>{user.tasks_completed} / {user.tasks_total}</td>
              <td>{formatDate(user.last_activity_at)}</td>
            </tr>
          ))}
          {!users.length && (
            <tr>
              <td colSpan={5} className="empty-cell">
                No users
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function UserDetailPanel({
  user,
  currentAdminId,
  busyKey,
  onPromote,
  onDemote,
  onSuspend,
  onReactivate,
}: {
  user: AdminUserDetail | null;
  currentAdminId: string;
  busyKey: string | null;
  onPromote: (user: AdminUserDetail) => void;
  onDemote: (user: AdminUserDetail) => void;
  onSuspend: (user: AdminUserDetail) => void;
  onReactivate: (user: AdminUserDetail) => void;
}) {
  if (!user) {
    return (
      <aside className="panel detail-panel">
        <div className="empty-state">No user selected</div>
      </aside>
    );
  }

  const isSelf = user.id === currentAdminId;
  const roleBusy = busyKey === `admin-${user.id}`;
  const statusBusy = busyKey === `status-${user.id}`;
  const canChangeAdmin = !user.protected_admin && !isSelf && user.status === "active";
  const canChangeStatus = !user.protected_admin && !isSelf && user.status !== "deleted";

  return (
    <aside className="panel detail-panel" aria-label="Selected user detail">
      <div className="detail-top">
        <div className="avatar large">{initials(user)}</div>
        <div>
          <h2>{user.first_name} {user.last_name}</h2>
          <span>{user.email}</span>
        </div>
      </div>
      <div className="detail-pills">
        <Pill tone={user.role === "admin" ? "admin" : "neutral"}>{user.role}</Pill>
        <Pill tone={user.status === "active" ? "active" : "danger"}>{user.status}</Pill>
        {user.protected_admin && <Pill tone="admin">protected</Pill>}
      </div>
      <div className="detail-actions">
        {user.role === "admin" ? (
          <button
            className="secondary-btn"
            type="button"
            disabled={!canChangeAdmin || roleBusy}
            onClick={() => onDemote(user)}
          >
            {roleBusy ? <RefreshCw size={16} className="spin" /> : <Shield size={16} />}
            <span>Remove admin</span>
          </button>
        ) : (
          <button
            className="primary-btn"
            type="button"
            disabled={!canChangeAdmin || roleBusy}
            onClick={() => onPromote(user)}
          >
            {roleBusy ? <RefreshCw size={16} className="spin" /> : <UserCheck size={16} />}
            <span>Make admin</span>
          </button>
        )}
        {user.status === "suspended" ? (
          <button
            className="secondary-btn"
            type="button"
            disabled={!canChangeStatus || statusBusy}
            onClick={() => onReactivate(user)}
          >
            {statusBusy ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
            <span>Reactivate</span>
          </button>
        ) : (
          <button
            className="danger-btn"
            type="button"
            disabled={!canChangeStatus || statusBusy}
            onClick={() => onSuspend(user)}
          >
            {statusBusy ? <RefreshCw size={16} className="spin" /> : <Ban size={16} />}
            <span>Suspend</span>
          </button>
        )}
      </div>
      <dl className="detail-list">
        <div>
          <dt>Grade</dt>
          <dd>{user.grade_level}</dd>
        </div>
        <div>
          <dt>Tasks</dt>
          <dd>{user.tasks_completed} / {user.tasks_total}</dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd>{user.avg_score === null ? "None" : `${user.avg_score}%`}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{formatDate(user.created_at)}</dd>
        </div>
      </dl>
      <div className="status-counts">
        {user.task_status_counts.map((item) => (
          <span key={item.status}>
            {item.status.replace("_", " ")} <strong>{item.count}</strong>
          </span>
        ))}
      </div>
    </aside>
  );
}

function AuditList({ audit }: { audit: AdminAuditEvent[] }) {
  return (
    <div className="audit-list">
      {audit.map((event) => (
        <article key={event.id} className="audit-row">
          <span className="audit-dot" />
          <div>
            <strong>{event.action.replaceAll("_", " ")}</strong>
            <small>
              {event.actor_email ?? "system"} to {event.target_email ?? event.target_user_id}
            </small>
          </div>
          <time>{formatDate(event.created_at)}</time>
        </article>
      ))}
      {!audit.length && <div className="empty-state">No audit events</div>}
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "active" | "admin" | "danger" | "neutral";
  children: ReactNode;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
