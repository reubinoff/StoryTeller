import { IconReadingTask, IconWritingTask } from "./Icons";
import type { CourseId } from "~/lib/api/types";

const COPY: Record<
  CourseId,
  {
    title: string;
    body: string;
    Icon: typeof IconReadingTask;
  }
> = {
  reading: {
    title: "Generating your reading task",
    body: "Building a fresh passage and questions. This can take a moment.",
    Icon: IconReadingTask,
  },
  writing: {
    title: "Generating your writing task",
    body: "Choosing a fresh prompt for your level. This can take a moment.",
    Icon: IconWritingTask,
  },
};

export function RollTaskProgress({
  courseId,
  tone = "light",
  className = "",
}: {
  courseId: CourseId;
  tone?: "light" | "dark";
  className?: string;
}) {
  const copy = COPY[courseId];
  const Icon = copy.Icon;

  return (
    <div
      className={`roll-task-progress roll-task-progress-${tone} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={`${copy.title}. ${copy.body}`}
    >
      <div className="roll-task-progress-head">
        <span className="roll-task-progress-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="roll-task-progress-text">
          <strong>{copy.title}</strong>
          <span>{copy.body}</span>
        </span>
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-label="Task generation in progress"
      >
        <div className="progress-fill roll-task-progress-fill" />
      </div>
    </div>
  );
}
