export type ISO8601 = string;
export type UUID = string;

export type UserRole = "user" | "admin" | "support";
export type UserStatus = "active" | "suspended" | "deleted";
export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "processing"
  | "completed"
  | "needs_retry"
  | "failed";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: UUID;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  year_of_birth: number;
  grade_level: number;
  english_level: number;
  phone_number: string | null;
  avatar_url: string | null;
  display_locale: string;
  theme_preference: "auto" | "light" | "dark";
  text_size_preference: "sm" | "md" | "lg";
  reduce_motion: boolean;
  notif_email_enabled: boolean;
  notif_inapp_enabled: boolean;
  interests: string[];
  role: UserRole;
  status: UserStatus;
  created_at: ISO8601;
  onboarding_completed: boolean;
}

export interface AuthResponse {
  user: User;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface AdminSession {
  user: AdminUserSummary;
  protected_admin: boolean;
}

export interface AdminOverview {
  range_days: 7 | 30 | 90;
  generated_at: ISO8601;
  kpis: {
    users_total: number;
    users_active: number;
    users_suspended: number;
    admins_total: number;
    signups_in_range: number;
    tasks_created_in_range: number;
    tasks_completed_in_range: number;
    tasks_failed_in_range: number;
    writing_processing: number;
    avg_completed_score: number;
  };
  daily_activity: Array<{
    date: string;
    signups: number;
    tasks_created: number;
    tasks_completed: number;
  }>;
  course_metrics: Array<{
    course_type: string;
    completed_count: number;
    avg_score: number;
  }>;
}

export interface AdminTokenUsage {
  range_days: 7 | 30 | 90;
  generated_at: ISO8601;
  totals: {
    input_tokens: number;
    output_tokens: number;
    cache_write_tokens: number;
    cache_read_tokens: number;
    total_tokens: number;
    requests: number;
    cost_usd: number;
    unknown_cost_events: number;
  };
  daily: Array<{
    date: string;
    input_tokens: number;
    output_tokens: number;
    cache_write_tokens: number;
    cache_read_tokens: number;
    total_tokens: number;
    requests: number;
    cost_usd: number;
  }>;
  top_users: Array<{
    user_id: UUID;
    email: string;
    first_name: string;
    last_name: string;
    total_tokens: number;
    requests: number;
    cost_usd: number;
  }>;
  top_tasks: Array<{
    task_id: UUID;
    title: string;
    course_type: string;
    user_id: UUID | null;
    user_email: string | null;
    total_tokens: number;
    requests: number;
    cost_usd: number;
  }>;
  by_operation: Array<{
    key: string;
    label: string;
    total_tokens: number;
    requests: number;
    cost_usd: number;
  }>;
  by_model: Array<{
    key: string;
    label: string;
    total_tokens: number;
    requests: number;
    cost_usd: number;
  }>;
  forecast_30d: {
    days: number;
    total_tokens: number;
    cost_usd: number;
    avg_daily_tokens: number;
    avg_daily_cost_usd: number;
  };
}

export interface AdminUserSummary {
  id: UUID;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  protected_admin: boolean;
  created_at: ISO8601;
  updated_at: ISO8601;
  tasks_total: number;
  tasks_completed: number;
  avg_score: number | null;
  last_activity_at: ISO8601 | null;
}

export interface AdminUserDetail extends AdminUserSummary {
  email_verified: boolean;
  grade_level: number;
  english_level: number;
  year_of_birth: number;
  onboarding_completed: boolean;
  interests: string[];
  task_status_counts: Array<{ status: TaskStatus; count: number }>;
}

export interface AdminAuditEvent {
  id: UUID;
  actor_user_id: UUID | null;
  actor_email: string | null;
  target_user_id: UUID;
  target_email: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: ISO8601;
}
