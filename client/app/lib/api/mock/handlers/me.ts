import type {
  Achievement,
  DashboardMetrics,
  DashboardResponse,
  InterestId,
  Notification,
  RecentTask,
  Task,
  TaskProgress,
  UpdateUserRequest,
  User,
} from "../../types";
import { PASSING_SCORE } from "../../types";
import { ACHIEVEMENTS_TEMPLATE, COURSES, commit, getState } from "../db";
import { err, ok, pathParts, type MockRequest, type MockResponse } from "../router";
import { TOPIC_BY_ID } from "~/lib/topics";

function getCurrentUser(token: string | null): User | null {
  const state = getState();
  if (!token && !state.current_user_id) return null;
  const id = token ? token.split(".")[1] : state.current_user_id;
  if (!id) return null;
  return state.users[id] ?? null;
}

function metrics(userId: string): DashboardMetrics {
  const state = getState();
  const taskIds = state.user_tasks[userId] ?? [];
  const tasks = taskIds.map((id) => state.tasks[id]).filter(Boolean);
  const completed = tasks.filter((t) => t.status === "completed");
  const avg =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, t) => sum + (t.score ?? 0), 0) / completed.length
        )
      : 0;
  const xp = tasks.reduce((sum, t) => sum + (t.xp_awarded ?? 0), 0) + 1240;
  const level = 4;
  return {
    tasks_completed: completed.length || 4,
    current_streak: 7,
    longest_streak: 12,
    avg_score: avg || 86,
    xp_total: xp,
    level,
    level_label: "Apprentice",
  };
}

function ensureAchievements(userId: string): Achievement[] {
  const state = getState();
  if (!state.achievements_by_user[userId]) {
    state.achievements_by_user[userId] = ACHIEVEMENTS_TEMPLATE.map((a) => ({
      ...a,
    }));
    commit();
  }
  return state.achievements_by_user[userId];
}

function relativeWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "Yesterday";
  return `${day} days ago`;
}

function computeProgress(task: Task): TaskProgress | null {
  // Only meaningful while the task is being worked on.
  if (task.status !== "not_started" && task.status !== "in_progress") {
    return null;
  }

  if (task.course_type === "unseen_text" && task.reading) {
    const answers =
      (task as unknown as { _answers?: Record<string, string | number> })
        ._answers ?? {};
    const current = Object.values(answers).filter(
      (v) => v !== undefined && v !== ""
    ).length;
    const total = task.reading.questions.length;
    return {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      label: `${current} of ${total} answered`,
    };
  }

  if (task.course_type === "short_writing" && task.writing) {
    const draft = task.writing.draft ?? "";
    const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
    const target = task.writing.min_words;
    return {
      current: words,
      total: target,
      percentage: Math.min(100, Math.round((words / target) * 100)),
      label: `${words} / ${target} words`,
    };
  }

  return null;
}

function taskPassed(task: Task): boolean | null {
  return task.score == null ? null : task.score >= PASSING_SCORE;
}

function validateInterestIds(interestIds: unknown): InterestId[] | MockResponse<never> {
  if (!Array.isArray(interestIds)) {
    return err(422, "validation_error", "interest_ids[] required");
  }
  if (interestIds.length < 1 || interestIds.length > 6) {
    return err(
      422,
      "validation_error",
      "Validation failed",
      "Choose between 1 and 6 interests.",
      [{ field: "interest_ids", message: "Choose between 1 and 6 interests." }]
    );
  }
  const unknown = interestIds.filter(
    (id): id is string => typeof id !== "string" || !TOPIC_BY_ID[id as InterestId]
  );
  if (unknown.length > 0) {
    return err(
      422,
      "validation_error",
      "Validation failed",
      "Unknown interest slug",
      [{ field: "interest_ids", message: `Unknown: ${unknown.join(", ")}` }]
    );
  }
  return interestIds as InterestId[];
}

function removeTasksForDroppedInterests(user: User, nextInterests: InterestId[]): void {
  const state = getState();
  const removed = new Set(user.interests.filter((id) => !nextInterests.includes(id)));
  if (removed.size === 0) return;

  const taskIds = state.user_tasks[user.id] ?? [];
  state.user_tasks[user.id] = taskIds.filter((taskId) => {
    const task = state.tasks[taskId];
    if (!task || !removed.has(task.interest_id)) return true;
    delete state.tasks[taskId];
    delete state.drafts[taskId];
    return false;
  });
}

function recentTasks(userId: string): RecentTask[] {
  const state = getState();
  const taskIds = state.user_tasks[userId] ?? [];
  const tasks = taskIds
    .map((id) => state.tasks[id])
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  return tasks.map((t) => ({
    id: t.id,
    course: t.course_type === "unseen_text" ? "Story Reading" : "Writing Practice",
    course_type: t.course_type,
    topic: t.title,
    status: t.status,
    score: t.score,
    when: relativeWhen(t.updated_at),
    progress: computeProgress(t),
    passed: taskPassed(t),
    passing_score: PASSING_SCORE,
  }));
}

const DEMO_RECENT: RecentTask[] = [
  {
    id: "demo-9921",
    course: "Story Reading",
    course_type: "unseen_text",
    topic: "Animals & Pets — Octopus minds",
    status: "completed",
    score: 90,
    when: "2 hr ago",
    progress: null,
    passed: true,
    passing_score: PASSING_SCORE,
  },
  {
    id: "demo-9920",
    course: "Writing Practice",
    course_type: "short_writing",
    topic: "My favorite meal",
    status: "processing",
    score: null,
    when: "4 hr ago",
    progress: null,
    passed: null,
    passing_score: PASSING_SCORE,
  },
  {
    id: "demo-9918",
    course: "Story Reading",
    course_type: "unseen_text",
    topic: "Space — How rockets land",
    status: "completed",
    score: 75,
    when: "Yesterday",
    progress: null,
    passed: true,
    passing_score: PASSING_SCORE,
  },
  {
    id: "demo-9917",
    course: "Story Reading",
    course_type: "unseen_text",
    topic: "Tech — A brief history of the keyboard",
    status: "in_progress",
    score: null,
    when: "Yesterday",
    progress: {
      current: 4,
      total: 6,
      percentage: 67,
      label: "4 of 6 answered",
    },
    passed: null,
    passing_score: PASSING_SCORE,
  },
  {
    id: "demo-9914",
    course: "Writing Practice",
    course_type: "short_writing",
    topic: "Why I like rainy days",
    status: "completed",
    score: 82,
    when: "2 days ago",
    progress: null,
    passed: true,
    passing_score: PASSING_SCORE,
  },
  {
    id: "demo-9911",
    course: "Story Reading",
    course_type: "unseen_text",
    topic: "Sports — The longest match",
    status: "completed",
    score: 100,
    when: "3 days ago",
    progress: null,
    passed: true,
    passing_score: PASSING_SCORE,
  },
  {
    id: "demo-9908",
    course: "Writing Practice",
    course_type: "short_writing",
    topic: "My weekend plan",
    status: "failed",
    score: null,
    when: "4 days ago",
    progress: null,
    passed: null,
    passing_score: PASSING_SCORE,
  },
];

export function handleMe(req: MockRequest): MockResponse<unknown> | null {
  const { pathname } = pathParts(req.url);
  if (!pathname.startsWith("/me")) return null;

  const user = getCurrentUser(req.token);
  if (!user) return err(401, "unauthenticated", "Sign in required");

  const state = getState();

  if (pathname === "/me" && req.method === "GET") {
    return ok(user);
  }

  if (pathname === "/me" && req.method === "PATCH") {
    const body = (req.body || {}) as UpdateUserRequest;
    Object.assign(user, body);
    commit();
    return ok(user);
  }

  if (pathname === "/me/interests" && req.method === "PUT") {
    const body = req.body as { interest_ids: InterestId[] };
    const ids = validateInterestIds(body?.interest_ids);
    if (!Array.isArray(ids)) return ids;
    removeTasksForDroppedInterests(user, ids);
    user.interests = ids;
    commit();
    return ok({ interests: ids });
  }

  if (pathname === "/me/onboarding" && req.method === "PUT") {
    const body = req.body as {
      year_of_birth?: number;
      grade_level?: number;
      interest_ids?: InterestId[];
    };
    if (!body?.year_of_birth || !body?.grade_level) {
      return err(422, "validation_error", "Onboarding fields are required");
    }
    const ids = validateInterestIds(body.interest_ids);
    if (!Array.isArray(ids)) return ids;
    removeTasksForDroppedInterests(user, ids);
    user.year_of_birth = body.year_of_birth;
    user.grade_level = body.grade_level;
    user.interests = ids;
    user.onboarding_completed = true;
    commit();
    return ok(user);
  }

  if (pathname === "/me/dashboard" && req.method === "GET") {
    const m = metrics(user.id);
    const own = recentTasks(user.id);
    const recent = own.length ? own : DEMO_RECENT;
    const inProgress = recent.filter(
      (t) =>
        t.status === "not_started" ||
        t.status === "in_progress" ||
        t.status === "submitted" ||
        t.status === "processing" ||
        t.status === "needs_retry" ||
        t.status === "failed"
    );
    const ach = ensureAchievements(user.id);
    const resp: DashboardResponse = {
      greeting: `Hi ${user.first_name}! Ready for today's story practice?`,
      metrics: m,
      in_progress: inProgress,
      recent,
      recommended: COURSES,
      achievements_recent: ach.slice(0, 6),
    };
    return ok(resp);
  }

  if (pathname === "/me/metrics" && req.method === "GET") {
    return ok(metrics(user.id));
  }

  if (pathname === "/me/achievements" && req.method === "GET") {
    return ok(ensureAchievements(user.id));
  }

  if (pathname === "/me/notifications" && req.method === "GET") {
    return ok({
      items: state.notifications[user.id] ?? [],
      next_cursor: null,
    });
  }

  const notificationReadMatch = pathname.match(/^\/me\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && req.method === "POST") {
    const list = state.notifications[user.id] ?? [];
    state.notifications[user.id] = list.map<Notification>((n) =>
      n.id === notificationReadMatch[1]
        ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
        : n
    );
    commit();
    return ok(null);
  }

  if (pathname === "/me/notifications/read-all" && req.method === "POST") {
    const list = state.notifications[user.id] ?? [];
    state.notifications[user.id] = list.map<Notification>((n) => ({
      ...n,
      read_at: n.read_at ?? new Date().toISOString(),
    }));
    commit();
    return ok(null);
  }

  return null;
}
