import { Link, useNavigate, useParams } from "react-router";
import {
  IconArrowLeft,
  IconArrowRight,
  IconReadingTask,
  IconWritingTask,
} from "~/components/Icons";
import { Mascot } from "~/components/Mascot";
import { RollTaskProgress } from "~/components/RollTaskProgress";
import { SectionHeader } from "~/components/SectionHeader";
import { Skeleton } from "~/components/Skeleton";
import { StatusPill } from "~/components/StatusPill";
import { useToast } from "~/components/Toast";
import { useCourse, useDashboard, useRollTask } from "~/lib/api/queries";
import type { CourseId } from "~/lib/api/types";
import { taskActionLabel, taskTarget } from "~/lib/task-routing";

export function meta() {
  return [{ title: "Course · Storyteller" }];
}

export default function CourseDetailRoute() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { push } = useToast();
  const id = (courseId as CourseId) ?? "reading";
  const isReading = id === "reading";
  const TaskIcon = isReading ? IconReadingTask : IconWritingTask;
  const accent = isReading ? "var(--teal)" : "var(--rust)";
  const accentSoft = isReading ? "var(--teal-soft)" : "var(--rust-soft)";
  const courseQ = useCourse(id);
  const dashboardQ = useDashboard();
  const rollTask = useRollTask();

  const myTasks = (dashboardQ.data?.recent ?? []).filter((t) =>
    isReading ? t.course_type === "unseen_text" : t.course_type === "short_writing"
  );
  const completed = myTasks.filter((t) => t.status === "completed");
  const avg =
    completed.length > 0
      ? Math.round(
          completed.reduce((a, b) => a + (b.score ?? 0), 0) / completed.length
        )
      : 0;

  const onRoll = async () => {
    try {
      const task = await rollTask.mutateAsync({ courseId: id });
      navigate(taskTarget(task));
    } catch {
      push({ icon: "⚠️", title: "Couldn't roll a task. Try again." });
    }
  };

  if (courseQ.isLoading || !courseQ.data) {
    return (
      <div className="col gap-24">
        <Skeleton height={28} width={140} />
        <Skeleton height={200} />
      </div>
    );
  }

  const course = courseQ.data;
  const rollingCourse = rollTask.isPending ? rollTask.variables?.courseId ?? id : undefined;

  return (
    <div className="col gap-32">
      <div>
        <Link
          to="/courses"
          className="row gap-8"
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            marginBottom: 14,
          }}
        >
          <IconArrowLeft size={14} /> All courses
        </Link>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)",
            gap: 32,
            alignItems: "stretch",
          }}
          className="course-hero"
        >
          <div>
            <span
              className="chip"
              style={{
                background: accentSoft,
                color: accent,
                borderColor: "transparent",
              }}
            >
              {course.subtitle}
            </span>
            <h1 className="course-title" style={{ fontSize: 48, margin: "14px 0 12px" }}>
              {course.title}
            </h1>
            <p
              style={{
                fontSize: 17,
                color: "var(--ink-2)",
                maxWidth: 520,
                lineHeight: 1.55,
                marginBottom: 24,
              }}
            >
              {course.description}
            </p>
            <div className="col gap-12" style={{ marginBottom: 28, alignItems: "flex-start" }}>
              <div className="row gap-12 roll-action-buttons" style={{ flexWrap: "wrap" }}>
                <button
                  className={`btn btn-accent btn-lg ${
                    rollTask.isPending ? "btn-loading" : ""
                  }`}
                  onClick={onRoll}
                  disabled={rollTask.isPending}
                  aria-busy={rollTask.isPending}
                >
                  {rollTask.isPending ? (
                    <>
                      <span className="spinner" /> Generating task...
                    </>
                  ) : (
                    <>
                      <TaskIcon size={16} /> Roll a new task
                    </>
                  )}
                </button>
                <a className="btn btn-ghost btn-lg" href="#course-example">
                  See an example
                </a>
              </div>
              {rollingCourse && <RollTaskProgress courseId={rollingCourse} />}
            </div>
            <div className="row gap-32" style={{ flexWrap: "wrap" }}>
              {[
                { l: "Tasks completed", v: completed.length },
                { l: "Average score", v: `${avg}%` },
                {
                  l: "Time average",
                  v: `${course.estimated_minutes} min`,
                },
              ].map((s) => (
                <div key={s.l}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 30,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {s.v}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-3)",
                      marginTop: 4,
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            id="course-example"
            className="card"
            style={{
              background: accentSoft,
              padding: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div style={{ padding: 24 }}>
              <span className="chip" style={{ background: "var(--paper)" }}>
                Example task
              </span>
              <div
                style={{
                  marginTop: 14,
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  color: "var(--ink)",
                  lineHeight: 1.5,
                }}
              >
                {isReading
                  ? "\"Saturn is famous for its bright, beautiful rings. From far away, the rings look solid, like a thin, flat dinner plate…\""
                  : "\"Write a short answer (60–120 words) describing a place you would love to visit one day. Include where it is, what you would do there, and why it matters to you.\""}
              </div>
            </div>
            <div style={{ position: "absolute", right: -20, bottom: -20 }}>
              <Mascot
                size={130}
                pose={isReading ? "read" : "write"}
                kind="ferret"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader
          title="Your recent tasks"
          subtitle="Pick up an unfinished task or review a completed one"
        />
        <div className="col gap-8">
          {myTasks.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <p style={{ color: "var(--ink-3)" }}>
                No tasks yet. Roll your first one!
              </p>
            </div>
          )}
          {myTasks.map((t) => (
            <div
              key={t.id}
              className="card course-task-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 24,
                padding: "14px 20px",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{t.topic}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {t.when}
                </div>
              </div>
              <StatusPill status={t.status} />
              <div
                className="tabnum"
                style={{ fontWeight: 600, minWidth: 50, textAlign: "right" }}
              >
                {t.score != null ? (
                  `${t.score}%`
                ) : (
                  <span style={{ color: "var(--ink-4)" }}>—</span>
                )}
              </div>
              <button
                className="btn btn-soft btn-sm"
                onClick={() =>
                  navigate(taskTarget(t))
                }
              >
                {taskActionLabel(t.status)}{" "}
                <IconArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
