/**
 * Frontend type contract for the Storyteller API.
 *
 * These types mirror the data models documented in API_CONTRACT.md
 * and PRD §13.2 / Backend §3 (data model). The backend MUST emit JSON
 * exactly matching these shapes; field names are snake_case on the wire.
 */

export type ISO8601 = string;
export type UUID = string;

// ----- Auth -----

export interface AuthTokens {
  access_token: string;
  expires_in: number;
}

export interface SignupRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  year_of_birth: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface CompleteOnboardingRequest {
  year_of_birth: number;
  grade_level: number;
  interest_ids: InterestId[];
}

// ----- User -----

export type ThemePreference = "auto" | "light" | "dark";
export type TextSizePreference = "sm" | "md" | "lg";
export type UserRole = "user" | "admin" | "support";
export type UserStatus = "active" | "suspended" | "deleted";

export interface User {
  id: UUID;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  year_of_birth: number;
  grade_level: number; // 1..12
  phone_number: string | null;
  avatar_url: string | null;
  display_locale: string;
  theme_preference: ThemePreference;
  text_size_preference: TextSizePreference;
  reduce_motion: boolean;
  notif_email_enabled: boolean;
  notif_inapp_enabled: boolean;
  interests: InterestId[];
  role: UserRole;
  status: UserStatus;
  created_at: ISO8601;
  onboarding_completed: boolean;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  phone_number?: string | null;
  theme_preference?: ThemePreference;
  text_size_preference?: TextSizePreference;
  reduce_motion?: boolean;
  notif_email_enabled?: boolean;
  notif_inapp_enabled?: boolean;
}

// ----- Catalog -----

export type InterestId =
  | "animals"
  | "sports"
  | "music"
  | "movies"
  | "science"
  | "space"
  | "tech"
  | "food"
  | "travel"
  | "art"
  | "books"
  | "games"
  | "history"
  | "cars"
  | "health";

export interface Interest {
  id: InterestId;
  display_name: string;
  emoji: string;
  display_order: number;
}

export type CourseId = "reading" | "writing";
export type CourseType = "unseen_text" | "short_writing";

export interface Course {
  id: CourseId;
  slug: string;
  type: CourseType;
  title: string;
  subtitle: string;
  description: string;
  min_grade: number;
  max_grade: number;
  estimated_minutes: number;
  illustration: "reading" | "writing";
}

export interface CourseProgress {
  tasks_completed: number;
  average_score: number;
}

// ----- Tasks -----

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "processing"
  | "completed"
  | "needs_retry"
  | "failed";

export const PASSING_SCORE = 70;

export type QuestionType = "multiple_choice" | "true_false" | "fill_blank";

export interface TaskQuestion {
  id: UUID;
  position: number;
  question_type: QuestionType;
  prompt: string;
  options: string[] | null;
  /** correct_answer hidden by API while the task is in progress */
  correct_answer?: string;
  explanation?: string;
  max_points: number;
}

export interface TaskAnswer {
  question_id: UUID | null;
  answer_text: string;
  is_correct?: boolean;
  points_awarded?: number;
}

export interface ReadingPayload {
  title: string;
  passage_text: string;
  passage_paragraphs: string[];
  passage_word_count: number;
  questions: TaskQuestion[];
}

export interface WritingPayload {
  title: string;
  prompt: string;
  hints: string[];
  min_words: number;
  max_words: number;
  draft?: string;
}

export interface Task {
  id: UUID;
  user_id: UUID;
  course_id: CourseId;
  course_type: CourseType;
  interest_id: InterestId;
  grade_level_at_roll: number;
  status: TaskStatus;
  title: string;
  topic_label: string;
  /** Reading-only payload */
  reading?: ReadingPayload;
  /** Writing-only payload */
  writing?: WritingPayload;
  score: number | null;
  xp_awarded: number;
  started_at: ISO8601 | null;
  submitted_at: ISO8601 | null;
  completed_at: ISO8601 | null;
  failed_at: ISO8601 | null;
  fail_reason: string | null;
  passed: boolean | null;
  passing_score: number;
  created_at: ISO8601;
  updated_at: ISO8601;
}

export interface RollTaskRequest {
  interest_id?: InterestId;
}

export interface AnswerQuestionRequest {
  question_id: UUID;
  answer: string | number;
}

export type SubmitTaskRequest =
  | { full_text: string }
  | { answers: Array<{ question_id: UUID; answer: string | number }> };

export interface ReadingResult {
  task_id: UUID;
  mode: "reading";
  score: number; // correct count
  total: number;
  percentage: number; // 0..100
  duration_seconds: number;
  xp_earned: number;
  passed: boolean;
  passing_score: number;
  questions: Array<
    TaskQuestion & {
      user_answer: string | number | null;
      is_correct: boolean;
    }
  >;
}

export type HighlightKind = "grammar" | "word_choice" | "suggestion";

export interface WritingHighlight {
  start: number;
  end: number;
  kind: HighlightKind;
  message: string;
}

export interface WritingEvaluation {
  score_overall: number;
  score_grammar: number;
  score_vocabulary: number;
  score_structure: number;
  score_relevance: number;
  feedback_summary: string;
  feedback_detail: string[];
  focus_next: string[];
  highlights: WritingHighlight[];
}

export interface WritingResult {
  task_id: UUID;
  mode: "writing";
  status: TaskStatus;
  answer_text: string;
  evaluation: WritingEvaluation | null;
  xp_earned: number;
  passed: boolean | null;
  passing_score: number;
  submitted_at: ISO8601 | null;
  completed_at: ISO8601 | null;
}

export type TaskResult = ReadingResult | WritingResult;

// ----- Dashboard / Achievements / Notifications -----

export interface DashboardMetrics {
  tasks_completed: number;
  current_streak: number;
  longest_streak: number;
  avg_score: number;
  xp_total: number;
  level: number;
  level_label: string;
}

export interface TaskProgress {
  /** Reading: questions answered. Writing: words written. */
  current: number;
  /** Reading: total questions. Writing: min_words target. */
  total: number;
  /** 0..100 — capped at 100 so writing past the min still reads as full. */
  percentage: number;
  /** Human label, e.g. "3 of 6 answered" or "82 / 60 words". */
  label: string;
}

export interface RecentTask {
  id: UUID;
  course: string;
  course_type: CourseType;
  topic: string;
  status: TaskStatus;
  score: number | null;
  when: string;
  progress: TaskProgress | null;
  passed: boolean | null;
  passing_score: number;
}

export interface DashboardResponse {
  greeting: string;
  metrics: DashboardMetrics;
  in_progress: RecentTask[];
  recent: RecentTask[];
  recommended: Course[];
  achievements_recent: Achievement[];
}

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_at: ISO8601 | null;
}

export interface Notification {
  id: UUID;
  kind: "task_completed" | "task_failed" | "streak_milestone" | "system";
  payload: Record<string, unknown>;
  read_at: ISO8601 | null;
  created_at: ISO8601;
}

// ----- Errors (RFC 7807) -----

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  errors?: Array<{ field: string; message: string }>;
}

// ----- Paginated response -----

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}
