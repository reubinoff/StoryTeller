import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  IconArrowRight,
  IconClock,
  IconDoc,
  IconPlus,
  IconReadingTask,
  IconRefresh,
  IconSparkle,
  IconWritingTask,
} from "~/components/Icons";
import { SectionHeader } from "~/components/SectionHeader";
import { Skeleton } from "~/components/Skeleton";
import { StatusPill } from "~/components/StatusPill";
import { useTaskList } from "~/lib/api/queries";
import type { CourseType, Task, TaskStatus } from "~/lib/api/types";
import { taskActionLabel, taskTarget } from "~/lib/task-routing";

export function meta() {
  return [{ title: "My Tasks · Storyteller" }];
}

type TaskFilter = "all" | "active" | "completed" | "failed";

const FILTERS: Array<{ id: TaskFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

const ACTIVE_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "processing",
  "needs_retry",
];

export default function TasksRoute() {
  const navigate = useNavigate();
  const taskList = useTaskList();
  const [filter, setFilter] = useState<TaskFilter>("all");

  const tasks = useMemo(() => {
    return [...(taskList.data?.items ?? [])].sort((a, b) => {
      return newestTimestamp(b) - newestTimestamp(a);
    });
  }, [taskList.data?.items]);

  const visibleTasks = tasks.filter((task) => matchesFilter(task, filter));
  const activeCount = tasks.filter((task) => matchesFilter(task, "active")).length;
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const scoredTasks = tasks.filter((task) => task.status === "completed");
  const averageScore = scoredTasks.length
    ? Math.round(
        scoredTasks.reduce((sum, task) => sum + (task.score ?? 0), 0) /
          scoredTasks.length
      )
    : 0;

  return (
    <div className="tasks-page">
      <div className="tasks-page-head">
        <div>
          <h1>My Tasks</h1>
          <p>Reading and writing work in one place.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/courses")}>
          <IconPlus size={16} /> New task
        </button>
      </div>

      <div className="tasks-stats">
        <TaskStat
          icon={<IconClock size={18} />}
          label="Active"
          value={activeCount.toString()}
          tone="amber"
        />
        <TaskStat
          icon={<IconDoc size={18} />}
          label="Completed"
          value={completedTasks.length.toString()}
          tone="teal"
        />
        <TaskStat
          icon={<IconSparkle size={18} />}
          label="Average score"
          value={scoredTasks.length ? `${averageScore}%` : "-"}
          tone="rust"
        />
      </div>

      <SectionHeader
        title="Task history"
        action={
          <div className="segmented" role="group" aria-label="Task filters">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? "active" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      {taskList.isLoading && <TasksLoading />}

      {taskList.isError && (
        <div className="card tasks-empty">
          <div className="tasks-empty-icon">
            <IconRefresh size={22} />
          </div>
          <h3>Tasks could not load</h3>
          <p>Try refreshing the list.</p>
          <button className="btn btn-soft" onClick={() => void taskList.refetch()}>
            <IconRefresh size={14} /> Refresh
          </button>
        </div>
      )}

      {!taskList.isLoading && !taskList.isError && visibleTasks.length === 0 && (
        <div className="card tasks-empty">
          <div className="tasks-empty-icon">
            <IconDoc size={22} />
          </div>
          <h3>{filter === "all" ? "No tasks yet" : `No ${filter} tasks`}</h3>
          <p>
            {filter === "all"
              ? "Roll a reading or writing task to start practicing."
              : "Try a different filter or roll something new."}
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/courses")}>
            <IconPlus size={14} /> New task
          </button>
        </div>
      )}

      {!taskList.isLoading && !taskList.isError && visibleTasks.length > 0 && (
        <div className="tasks-list">
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onOpen={() => navigate(taskTarget(task))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "amber" | "teal" | "rust";
}) {
  return (
    <div className={`card task-stat task-stat-${tone}`}>
      <div className="task-stat-icon">{icon}</div>
      <div>
        <div className="task-stat-label">{label}</div>
        <div className="task-stat-value">{value}</div>
      </div>
    </div>
  );
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const isReading = task.course_type === "unseen_text";
  return (
    <article className="card task-row">
      <div className={`task-row-icon ${isReading ? "reading" : "writing"}`}>
        {isReading ? (
          <IconReadingTask size={22} />
        ) : (
          <IconWritingTask size={22} />
        )}
      </div>
      <div className="task-row-main">
        <div className="task-row-kicker">
          <span>{courseLabel(task.course_type)}</span>
          <StatusPill status={task.status} />
        </div>
        <h3>{task.title}</h3>
        <div className="task-row-meta">
          <span>{task.topic_label}</span>
          <span>{formatTaskDate(task)}</span>
          <span>{scoreLabel(task)}</span>
        </div>
      </div>
      <button className="btn btn-primary task-row-action" onClick={onOpen}>
        {taskActionLabel(task.status)} <IconArrowRight size={14} />
      </button>
    </article>
  );
}

function TasksLoading() {
  return (
    <div className="tasks-list" aria-label="Loading tasks">
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} height={116} radius={22} />
      ))}
    </div>
  );
}

function matchesFilter(task: Task, filter: TaskFilter): boolean {
  switch (filter) {
    case "active":
      return ACTIVE_STATUSES.includes(task.status);
    case "completed":
      return task.status === "completed";
    case "failed":
      return task.status === "failed";
    default:
      return true;
  }
}

function courseLabel(courseType: CourseType): string {
  return courseType === "unseen_text" ? "Story Reading" : "Writing Practice";
}

function scoreLabel(task: Task): string {
  if (task.score === null) return "Not scored";
  return `${task.score}% score`;
}

function formatTaskDate(task: Task): string {
  const value =
    task.completed_at ??
    task.submitted_at ??
    task.started_at ??
    task.updated_at ??
    task.created_at;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function newestTimestamp(task: Task): number {
  return new Date(task.updated_at ?? task.created_at).getTime();
}
