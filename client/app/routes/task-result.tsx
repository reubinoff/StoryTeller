import { useNavigate, useParams } from "react-router";
import { BackBar } from "~/components/BackBar";
import {
  IconArrowLeft,
  IconCheck,
  IconRefresh,
  IconX,
} from "~/components/Icons";
import { BrandMark, Mascot } from "~/components/Mascot";
import { SectionHeader } from "~/components/SectionHeader";
import { Skeleton } from "~/components/Skeleton";
import { useToast } from "~/components/Toast";
import { useRollTask, useTask, useTaskResult } from "~/lib/api/queries";
import type {
  HighlightKind,
  ReadingResult,
  WritingResult,
} from "~/lib/api/types";
import { useAuth } from "~/lib/auth";

export function meta() {
  return [{ title: "Result · LinguaQuest" }];
}

export default function TaskResultRoute() {
  const { taskId } = useParams<{ taskId: string }>();
  const taskQ = useTask(taskId);
  const resultQ = useTaskResult(taskId);

  if (taskQ.isLoading || resultQ.isLoading || !resultQ.data) {
    return (
      <div className="col gap-16">
        <Skeleton height={28} width={140} />
        <Skeleton height={260} radius={22} />
      </div>
    );
  }
  if (resultQ.data.mode === "reading") {
    return <ReadingResultView result={resultQ.data} />;
  }
  return <WritingResultView result={resultQ.data} />;
}

const ReadingResultView = ({ result }: { result: ReadingResult }) => {
  const navigate = useNavigate();
  const great = result.percentage >= 80;
  const rollTask = useRollTask();
  const { push } = useToast();
  const onAgain = async () => {
    try {
      const t = await rollTask.mutateAsync({ courseId: "reading" });
      navigate(`/tasks/${t.id}`);
    } catch {
      push({ icon: "⚠️", title: "Couldn't roll a task." });
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <BackBar onBack={() => navigate("/dashboard")} label="Result" />
      <div
        className="card"
        style={{
          padding: "40px 48px",
          background: great ? "var(--teal)" : "var(--paper)",
          color: great ? "#fff" : "var(--ink)",
          position: "relative",
          overflow: "hidden",
          borderColor: "transparent",
        }}
      >
        {great && (
          <div style={{ position: "absolute", right: -30, top: -30, opacity: 0.12 }}>
            <BrandMark size={260} color="#fff" />
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gap: 32,
            alignItems: "center",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div>
            <span
              className="chip"
              style={{
                background: great ? "rgba(255,255,255,0.2)" : "var(--paper-2)",
                color: great ? "#fff" : "var(--ink-2)",
                borderColor: "transparent",
              }}
            >
              {great ? "🎉 Nice work!" : "Good try"}
            </span>
            <h1
              style={{
                fontSize: 64,
                color: great ? "#fff" : "var(--ink)",
                margin: "14px 0 8px",
                letterSpacing: "-0.025em",
              }}
            >
              <span className="tabnum">{result.score}</span>
              <span style={{ opacity: 0.55 }}> / {result.total}</span>
            </h1>
            <div style={{ fontSize: 18, opacity: great ? 0.85 : 0.7 }}>
              {great
                ? `That's ${result.percentage}% — you're really getting this.`
                : `You scored ${result.percentage}%. Let's see where you can sharpen up.`}
            </div>
          </div>
          <Mascot size={140} pose={great ? "cheer" : "wave"} kind="ferret" />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        {[
          { l: "Correct", v: result.score, c: "var(--good)" },
          {
            l: "Time taken",
            v: formatDuration(result.duration_seconds),
            c: "var(--ink-2)",
          },
          { l: "XP earned", v: `+ ${result.xp_earned}`, c: "var(--rust)" },
        ].map((s) => (
          <div key={s.l} className="card" style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {s.l}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 30,
                fontWeight: 700,
                color: s.c,
              }}
            >
              {s.v}
            </div>
          </div>
        ))}
      </div>

      <SectionHeader
        title="Question by question"
        subtitle="The right answers and why"
      />
      <div className="col gap-12">
        {result.questions.map((q, i) => {
          const userText =
            q.question_type === "fill_blank"
              ? String(q.user_answer ?? "(no answer)")
              : q.options
              ? q.options[Number(q.user_answer ?? -1)] ?? "—"
              : "—";
          const correctText =
            q.question_type === "fill_blank"
              ? String(q.correct_answer ?? "")
              : q.options
              ? q.options[Number(q.correct_answer ?? 0)] ?? ""
              : "";
          return (
            <div
              key={q.id}
              className="card"
              style={{
                padding: 24,
                borderLeft:
                  "4px solid " + (q.is_correct ? "var(--good)" : "var(--bad)"),
              }}
            >
              <div className="row gap-8" style={{ marginBottom: 8 }}>
                <span className="chip">Q{i + 1}</span>
                {q.is_correct ? (
                  <span className="chip chip-good">
                    <IconCheck size={11} /> Correct
                  </span>
                ) : (
                  <span className="chip chip-bad">
                    <IconX size={11} /> Incorrect
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}
              >
                {q.prompt}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    background: "var(--paper-2)",
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-3)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 4,
                    }}
                  >
                    Your answer
                  </div>
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: q.is_correct ? "var(--good)" : "var(--bad)",
                    }}
                  >
                    {userText}
                  </div>
                </div>
                <div
                  style={{
                    background: "var(--good-soft)",
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--good)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 4,
                    }}
                  >
                    Correct answer
                  </div>
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: "var(--good)",
                    }}
                  >
                    {correctText}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: "var(--ink-2)",
                  background: "var(--paper-2)",
                  padding: "12px 14px",
                  borderRadius: 12,
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: "var(--ink)" }}>Why:</strong>{" "}
                {q.explanation}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="row gap-12"
        style={{ marginTop: 32, justifyContent: "center", flexWrap: "wrap" }}
      >
        <button
          className="btn btn-ghost btn-lg"
          onClick={() => navigate("/dashboard")}
        >
          <IconArrowLeft size={14} /> Dashboard
        </button>
        <button
          className="btn btn-accent btn-lg"
          onClick={onAgain}
          disabled={rollTask.isPending}
        >
          <IconRefresh size={14} /> Roll another task
        </button>
      </div>
    </div>
  );
};

const HIGHLIGHT_COLORS: Record<HighlightKind, { bg: string; line: string }> = {
  grammar: { bg: "var(--bad-soft)", line: "var(--bad)" },
  word_choice: { bg: "var(--warn-soft)", line: "var(--warn)" },
  suggestion: { bg: "var(--sky-soft)", line: "var(--sky)" },
};

const renderAnnotatedAnswer = (
  text: string,
  highlights: WritingResult["evaluation"] extends infer T
    ? T extends { highlights: infer H }
      ? H
      : never
    : never
) => {
  if (!highlights || highlights.length === 0) return <span>{text}</span>;
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((h, i) => {
    if (h.start > cursor) parts.push(<span key={`p${i}`}>{text.slice(cursor, h.start)}</span>);
    const colors = HIGHLIGHT_COLORS[h.kind];
    parts.push(
      <span
        key={`h${i}`}
        className="anno"
        title={h.message}
        style={{
          ["--c" as never]: colors.bg,
          ["--c-strong" as never]: colors.line,
        }}
      >
        {text.slice(h.start, h.end)}
      </span>
    );
    cursor = h.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return parts;
};

const WritingResultView = ({ result }: { result: WritingResult }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const rollTask = useRollTask();
  const { push } = useToast();

  const evalData = result.evaluation;

  const onAgain = async () => {
    try {
      const t = await rollTask.mutateAsync({ courseId: "writing" });
      navigate(`/tasks/${t.id}`);
    } catch {
      push({ icon: "⚠️", title: "Couldn't roll a task." });
    }
  };

  if (!evalData) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", textAlign: "center" }}>
        <BackBar onBack={() => navigate("/dashboard")} label="Writing Studio" />
        <div className="card" style={{ padding: 40 }}>
          <Mascot size={120} pose="thinking" kind="ferret" />
          <h2 style={{ marginTop: 12 }}>Still cooking…</h2>
          <p style={{ color: "var(--ink-3)", marginTop: 8 }}>
            We'll notify you when the feedback is ready.
          </p>
        </div>
      </div>
    );
  }

  const overall = evalData.score_overall;
  const subscores: Array<{
    label: string;
    value: number;
    color: string;
  }> = [
    { label: "Grammar", value: evalData.score_grammar, color: "var(--bad)" },
    {
      label: "Vocabulary",
      value: evalData.score_vocabulary,
      color: "var(--amber)",
    },
    {
      label: "Structure",
      value: evalData.score_structure,
      color: "var(--good)",
    },
    {
      label: "Topic",
      value: evalData.score_relevance,
      color: "var(--sky)",
    },
  ];

  const circumference = 2 * Math.PI * 68;
  const dash = (overall / 100) * circumference;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <BackBar onBack={() => navigate("/dashboard")} label="Writing result" />

      <div className="card" style={{ padding: "36px 40px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr)",
            gap: 36,
            alignItems: "center",
          }}
          className="writing-result-hero"
        >
          <div style={{ position: "relative", width: 160, height: 160 }}>
            <svg width={160} height={160} viewBox="0 0 160 160">
              <circle
                cx={80}
                cy={80}
                r={68}
                fill="none"
                stroke="var(--line)"
                strokeWidth={14}
              />
              <circle
                cx={80}
                cy={80}
                r={68}
                fill="none"
                stroke="var(--rust)"
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                transform="rotate(-90 80 80)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 44,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {overall}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Overall
              </div>
            </div>
          </div>
          <div>
            <span className="chip chip-rust">🎉 Strong submission</span>
            <h1 style={{ fontSize: 36, margin: "12px 0 8px" }}>
              Nicely done{user ? `, ${user.first_name}` : ""}!
            </h1>
            <p
              style={{
                color: "var(--ink-2)",
                fontSize: 15.5,
                lineHeight: 1.55,
                maxWidth: 520,
              }}
            >
              {evalData.feedback_summary}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0,1fr))",
            gap: 12,
            marginTop: 28,
          }}
          className="writing-subscores"
        >
          {subscores.map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--paper-2)",
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <div
                className="row"
                style={{ justifyContent: "space-between", marginBottom: 8 }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-3)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {s.value}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--line)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${s.value}%`,
                    height: "100%",
                    background: s.color,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionHeader
        title="Your answer, with notes"
        subtitle="Hover any underlined phrase for the suggestion"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)",
          gap: 20,
        }}
        className="writing-result-body"
      >
        <div className="card" style={{ padding: "30px 36px" }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17.5,
              lineHeight: 1.85,
              color: "var(--ink-2)",
            }}
          >
            {renderAnnotatedAnswer(result.answer_text, evalData.highlights)}
          </p>
          <div
            className="row gap-12"
            style={{
              marginTop: 20,
              fontSize: 12,
              color: "var(--ink-3)",
              borderTop: "1px solid var(--line)",
              paddingTop: 14,
              flexWrap: "wrap",
            }}
          >
            <span className="row gap-6">
              <span
                style={{
                  width: 14,
                  height: 8,
                  background: "var(--bad-soft)",
                  borderBottom: "2px dotted var(--bad)",
                }}
              />{" "}
              Grammar
            </span>
            <span className="row gap-6">
              <span
                style={{
                  width: 14,
                  height: 8,
                  background: "var(--warn-soft)",
                  borderBottom: "2px dotted var(--warn)",
                }}
              />{" "}
              Word choice
            </span>
            <span className="row gap-6">
              <span
                style={{
                  width: 14,
                  height: 8,
                  background: "var(--sky-soft)",
                  borderBottom: "2px dotted var(--sky)",
                }}
              />{" "}
              Suggestion
            </span>
          </div>
        </div>

        <div className="col gap-12">
          <div className="card">
            <h4 style={{ marginBottom: 12 }}>Quill's summary</h4>
            {evalData.feedback_detail.map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 14,
                  color: "var(--ink-2)",
                  lineHeight: 1.6,
                  marginBottom: i < evalData.feedback_detail.length - 1 ? 14 : 0,
                }}
              >
                {para}
              </p>
            ))}
          </div>
          <div className="card" style={{ background: "var(--paper-2)" }}>
            <h4 style={{ marginBottom: 8, fontSize: 14 }}>
              What to focus on next
            </h4>
            <div className="col gap-8">
              {evalData.focus_next.map((t) => (
                <div key={t} className="row gap-8">
                  <span
                    className="chip"
                    style={{
                      background: "var(--paper)",
                      borderColor: "var(--line)",
                    }}
                  >
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="row gap-12"
        style={{ marginTop: 32, justifyContent: "center", flexWrap: "wrap" }}
      >
        <button
          className="btn btn-ghost btn-lg"
          onClick={() => navigate("/dashboard")}
        >
          <IconArrowLeft size={14} /> Dashboard
        </button>
        <button
          className="btn btn-accent btn-lg"
          onClick={onAgain}
          disabled={rollTask.isPending}
        >
          <IconRefresh size={14} /> Roll another task
        </button>
      </div>
    </div>
  );
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
};
