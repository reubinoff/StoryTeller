import type { TaskStatus } from "~/lib/api/types";

interface StatusPillProps {
  status: TaskStatus;
}

const MAP: Record<TaskStatus, { cls: string; label: string }> = {
  not_started: { cls: "chip", label: "Not started" },
  in_progress: { cls: "chip chip-amber", label: "In progress" },
  processing: { cls: "chip chip-sky", label: "Processing" },
  submitted: { cls: "chip chip-sky", label: "Submitted" },
  completed: { cls: "chip chip-good", label: "Completed" },
  failed: { cls: "chip chip-bad", label: "Failed" },
};

const DOT_CLASS: Record<TaskStatus, string> = {
  not_started: "notstarted",
  in_progress: "inprogress",
  processing: "processing",
  submitted: "processing",
  completed: "completed",
  failed: "failed",
};

export const StatusPill = ({ status }: StatusPillProps) => {
  const m = MAP[status];
  return (
    <span className={m.cls}>
      <span className={`status-dot ${DOT_CLASS[status]}`} />
      {m.label}
    </span>
  );
};
