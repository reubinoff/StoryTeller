import type { Task, TaskStatus } from "~/lib/api/types";

export function taskTarget(task: Pick<Task, "id" | "status">): string {
  switch (task.status) {
    case "completed":
    case "needs_retry":
    case "failed":
      return `/tasks/${task.id}/result`;
    default:
      return `/tasks/${task.id}`;
  }
}

export function taskActionLabel(status: TaskStatus): string {
  switch (status) {
    case "not_started":
      return "Start";
    case "processing":
    case "submitted":
      return "Check status";
    case "needs_retry":
      return "Try again";
    case "completed":
      return "View result";
    case "failed":
      return "Review";
    default:
      return "Resume";
  }
}
