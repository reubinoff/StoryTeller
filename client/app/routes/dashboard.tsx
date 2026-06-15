import { useNavigate } from "react-router";
import { CardSkeleton, Skeleton } from "~/components/Skeleton";
import { CourseCard } from "~/components/CourseCards";
import {
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconFlame,
  IconReadingTask,
  IconSparkle,
  IconTarget,
  IconWritingTask,
} from "~/components/Icons";
import { BrandMark, Mascot } from "~/components/Mascot";
import { RollTaskProgress } from "~/components/RollTaskProgress";
import { SectionHeader } from "~/components/SectionHeader";
import { StatusPill } from "~/components/StatusPill";
import { useToast } from "~/components/Toast";
import { useDashboard, useRollTask } from "~/lib/api/queries";
import type { CourseId, RecentTask } from "~/lib/api/types";
import { useAuth } from "~/lib/auth";
import { taskActionLabel, taskTarget } from "~/lib/task-routing";

export function meta() {
  return [{ title: "Dashboard · Storyteller" }];
}

const formatDate = () => {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  return new Intl.DateTimeFormat("en-US", opts).format(new Date());
};

export default function DashboardRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboard = useDashboard();
  const rollTask = useRollTask();
  const { push } = useToast();

  const onRoll = async (courseId: CourseId) => {
    const readyTask = dashboard.data?.ready_tasks[courseId];
    if (readyTask) {
      navigate(taskTarget(readyTask));
      return;
    }
    try {
      const task = await rollTask.mutateAsync({ courseId });
      navigate(taskTarget(task));
    } catch {
      push({ icon: "⚠️", title: "Couldn't roll a task. Try again." });
    }
  };

  if (!user) return null;
  if (dashboard.isLoading || !dashboard.data) {
    return <DashboardLoading />;
  }

  const { metrics, in_progress: inProgress, recent, achievements_recent } =
    dashboard.data;
  const rollingCourse = rollTask.isPending ? rollTask.variables?.courseId : undefined;

  return (
    <div className="col gap-32">
      <div
        className="card"
        style={{
          background: "var(--dashboard-hero-bg)",
          color: "var(--dashboard-hero-fg)",
          padding: 32,
          position: "relative",
          overflow: "hidden",
          borderColor: "transparent",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -30,
            top: -40,
            opacity: 0.08,
          }}
        >
          <BrandMark size={300} color="var(--paper)" />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
            gap: 32,
            alignItems: "center",
            position: "relative",
            zIndex: 2,
          }}
          className="dashboard-hero-grid"
        >
          <div>
            <span
              className="chip chip-rust"
              style={{
                background: "rgba(242,116,87,0.2)",
                color: "var(--rust-2)",
              }}
            >
              <IconCalendar size={12} /> {formatDate()}
            </span>
            <h1
              style={{
                color: "var(--dashboard-hero-fg)",
                fontSize: 42,
                margin: "14px 0 10px",
              }}
            >
              Hi {user.first_name}! Ready for today's story practice?
            </h1>
            <p
              style={{
                color: "var(--dashboard-hero-muted)",
                fontSize: 16,
                maxWidth: 520,
                marginBottom: 22,
              }}
            >
              You're on a {metrics.current_streak}-day streak. Keep it going
              with a fresh reading or writing task. It should take about 5
              minutes.
            </p>
            <div className="row gap-12 roll-action-buttons" style={{ flexWrap: "wrap" }}>
              <button
                className={`btn btn-teal btn-lg ${
                  rollingCourse === "reading" ? "btn-loading" : ""
                }`}
                onClick={() => onRoll("reading")}
                disabled={rollTask.isPending}
                aria-busy={rollingCourse === "reading"}
              >
                {rollingCourse === "reading" ? (
                  <>
                    <span className="spinner" /> Generating reading...
                  </>
                ) : (
                  <>
                    <IconReadingTask size={16} /> Roll a Reading task
                  </>
                )}
              </button>
              <button
                className={`btn btn-accent btn-lg ${
                  rollingCourse === "writing" ? "btn-loading" : ""
                }`}
                onClick={() => onRoll("writing")}
                disabled={rollTask.isPending}
                aria-busy={rollingCourse === "writing"}
              >
                {rollingCourse === "writing" ? (
                  <>
                    <span className="spinner" /> Generating writing...
                  </>
                ) : (
                  <>
                    <IconWritingTask size={16} /> Roll a Writing task
                  </>
                )}
              </button>
            </div>
            {rollingCourse && (
              <RollTaskProgress
                courseId={rollingCourse}
                tone="dark"
                className="roll-task-progress-dashboard"
              />
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Mascot size={180} pose="cheer" kind="ferret" />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
        }}
        className="metrics-row"
      >
        <Metric
          label="Tasks completed"
          value={metrics.tasks_completed}
          sub="+3 this week"
          color="var(--good)"
          icon={<IconCheck size={16} />}
        />
        <Metric
          label="Current streak"
          value={`${metrics.current_streak} days`}
          sub={`Best: ${metrics.longest_streak} days`}
          color="var(--rust)"
          icon={<IconFlame size={16} />}
        />
        <Metric
          label="Average score"
          value={`${metrics.avg_score}%`}
          sub="+4% vs last week"
          color="var(--teal)"
          icon={<IconTarget size={16} />}
        />
        <Metric
          label="Total XP"
          value={metrics.xp_total.toLocaleString()}
          sub={`Level ${metrics.level} · ${metrics.level_label}`}
          color="var(--berry)"
          icon={<IconSparkle size={16} />}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: 24,
        }}
        className="dashboard-body"
      >
        <div>
          <SectionHeader
            title="Continue where you left off"
            subtitle={
              inProgress.length
                ? `${inProgress.length} tasks waiting for you`
                : "You're all caught up — roll a new one!"
            }
          />
          <div className="col gap-12">
            {inProgress.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <Mascot size={80} pose="sleep" kind="ferret" />
                <p style={{ color: "var(--ink-3)", marginTop: 12 }}>
                  No tasks in progress.
                </p>
              </div>
            )}
            {inProgress.map((t) => (
              <ResumeRow
                key={t.id}
                task={t}
                onResume={() => {
                  navigate(taskTarget(t));
                }}
              />
            ))}
          </div>

          <SectionHeader
            title="Recent tasks"
            subtitle="Everything you've rolled"
            action={
              <button className="btn btn-ghost btn-sm">
                View all <IconArrowRight size={12} />
              </button>
            }
          />
          <div
            className="card recent-table-card"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--paper-2)",
                    textAlign: "left",
                    fontSize: 12,
                    color: "var(--ink-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <th style={{ padding: "14px 20px", fontWeight: 600 }}>Task</th>
                  <th style={{ padding: "14px 14px", fontWeight: 600 }}>
                    Status
                  </th>
                  <th style={{ padding: "14px 14px", fontWeight: 600 }}>
                    Score
                  </th>
                  <th style={{ padding: "14px 20px", fontWeight: 600 }}>When</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 7).map((t, i) => {
                  const target = taskTarget(t);
                  return (
                    <tr
                      key={t.id}
                      role={target ? "link" : undefined}
                      tabIndex={target ? 0 : -1}
                      style={{
                        borderTop: i === 0 ? "none" : "1px solid var(--line)",
                        cursor: target ? "pointer" : "default",
                      }}
                      onClick={() => target && navigate(target)}
                      onKeyDown={(e) => {
                        if (target && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          navigate(target);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (target)
                          e.currentTarget.style.background = "var(--paper-2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "";
                      }}
                    >
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontWeight: 600 }}>{t.topic}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                          {t.course}
                        </div>
                        {t.progress && (
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              maxWidth: 280,
                            }}
                          >
                            <div
                              className="progress-bar"
                              style={{ flex: 1, height: 6 }}
                            >
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${t.progress.percentage}%`,
                                  background:
                                    t.course_type === "unseen_text"
                                      ? "var(--teal)"
                                      : "var(--rust)",
                                }}
                              />
                            </div>
                            <span
                              className="tabnum"
                              style={{
                                fontSize: 11.5,
                                color: "var(--ink-3)",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.progress.label}
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 14px" }}>
                        <StatusPill status={t.status} />
                      </td>
                      <td
                        className="tabnum"
                        style={{ padding: "14px 14px", fontWeight: 600 }}
                      >
                        {t.score != null ? (
                          `${t.score}%`
                        ) : (
                          <span style={{ color: "var(--ink-4)" }}>—</span>
                        )}
                      </td>
                      <td
                        style={{ padding: "14px 20px", color: "var(--ink-3)" }}
                      >
                        {t.when}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader title="Recommended" />
          <div className="col gap-12">
            <CourseCard
              title="Story Reading"
              description="A short story and a few questions. Great for warm-ups."
              accent="var(--teal)"
              accentSoft="var(--teal-soft)"
              icon={<IconReadingTask size={20} />}
              meta="5 min · Grade 1–12"
              onClick={() => navigate("/courses/reading")}
            />
            <CourseCard
              title="Writing Practice"
              description="Get a topic, write 60–120 words, and we'll give you feedback."
              accent="var(--rust)"
              accentSoft="var(--rust-soft)"
              icon={<IconWritingTask size={20} />}
              meta="10 min · Grade 1–12"
              onClick={() => navigate("/courses/writing")}
            />
          </div>

          <SectionHeader title="Achievements" />
          <div className="card">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {achievements_recent.map((a) => (
                <div
                  key={a.id}
                  title={a.description}
                  style={{
                    textAlign: "center",
                    padding: "14px 6px",
                    borderRadius: 14,
                    background: "var(--paper-2)",
                    opacity: a.earned ? 1 : 0.35,
                    border:
                      "1px solid " + (a.earned ? "var(--line)" : "transparent"),
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{a.icon}</div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--ink-2)",
                    }}
                  >
                    {a.name}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                textAlign: "center",
                marginTop: 14,
                fontSize: 12,
                color: "var(--ink-3)",
              }}
            >
              <strong style={{ color: "var(--ink-2)" }}>
                {achievements_recent.filter((a) => a.earned).length} of{" "}
                {achievements_recent.length}
              </strong>{" "}
              badges earned
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Metric = ({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: string;
}) => (
  <div className="card metric-card">
    <div className="row gap-8 metric-heading" style={{ marginBottom: 10, color }}>
      <div
        className="metric-icon"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "currentColor",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "#fff" }}>{icon}</span>
      </div>
      <span
        className="metric-label"
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
    </div>
    <div
      className="metric-value"
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 34,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>{sub}</div>
  </div>
);

const ResumeRow = ({
  task,
  onResume,
}: {
  task: RecentTask;
  onResume: () => void;
}) => {
  const isReading = task.course_type === "unseen_text";
  return (
    <div
      className="card resume-row"
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 18,
        alignItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: isReading ? "var(--teal-soft)" : "var(--rust-soft)",
          color: isReading ? "var(--teal)" : "var(--rust)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isReading ? (
          <IconReadingTask size={20} />
        ) : (
          <IconWritingTask size={20} />
        )}
      </div>
      <div>
        <div className="row gap-8" style={{ marginBottom: 4 }}>
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-3)",
              fontWeight: 600,
            }}
          >
            {task.course}
          </span>
          <StatusPill status={task.status} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{task.topic}</div>
        {task.progress && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              maxWidth: 320,
            }}
          >
            <div className="progress-bar" style={{ flex: 1, height: 6 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${task.progress.percentage}%`,
                  background: isReading ? "var(--teal)" : "var(--rust)",
                }}
              />
            </div>
            <span
              className="tabnum"
              style={{
                fontSize: 11.5,
                color: "var(--ink-3)",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {task.progress.label}
            </span>
          </div>
        )}
      </div>
      <button className="btn btn-primary" onClick={onResume}>
        {taskActionLabel(task.status)} <IconArrowRight size={14} />
      </button>
    </div>
  );
};

const DashboardLoading = () => (
  <div className="col gap-32">
    <Skeleton height={220} radius={22} />
    <div
      className="dashboard-body"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <CardSkeleton key={i} rows={2} />
      ))}
    </div>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr",
        gap: 24,
      }}
    >
      <CardSkeleton rows={4} />
      <CardSkeleton rows={3} />
    </div>
  </div>
);
