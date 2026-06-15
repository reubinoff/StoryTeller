import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { BackBar } from "~/components/BackBar";
import {
  IconArrowRight,
  IconBook,
  IconCheck,
  IconClock,
  IconLock,
  IconType,
  IconVolume,
  IconX,
} from "~/components/Icons";
import { Mascot } from "~/components/Mascot";
import { Modal } from "~/components/Modal";
import { Skeleton } from "~/components/Skeleton";
import {
  useAnswerQuestion,
  useSaveDraft,
  useStartTask,
  useSubmitTask,
  useTask,
} from "~/lib/api/queries";
import type { Task, TaskQuestion } from "~/lib/api/types";

export function meta() {
  return [{ title: "Task · Storyteller" }];
}

export default function TaskRoute() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const taskQ = useTask(taskId);
  const startTask = useStartTask();

  // Auto-transition not_started → in_progress on first view.
  useEffect(() => {
    if (taskQ.data?.status === "not_started" && taskId) {
      void startTask.mutateAsync(taskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskQ.data?.status, taskId]);

  if (taskQ.isLoading || !taskQ.data) {
    return (
      <div className="col gap-16">
        <Skeleton height={28} width={140} />
        <Skeleton height={420} radius={22} />
      </div>
    );
  }

  const task = taskQ.data;
  if (
    task.status === "completed" ||
    task.status === "needs_retry" ||
    task.status === "failed"
  ) {
    return <Navigate to={`/tasks/${task.id}/result`} replace />;
  }
  if (task.status === "processing") {
    return <WritingProcessing task={task} />;
  }
  if (task.course_type === "unseen_text") {
    return <ReadingTask task={task} onCompleted={() => navigate(`/tasks/${task.id}/result`)} />;
  }
  return <WritingTask task={task} />;
}

// ---------------- Reading ----------------

interface ReadingTaskProps {
  task: Task;
  onCompleted: () => void;
}

const ReadingTask = ({ task, onCompleted }: ReadingTaskProps) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"passage" | "questions">("passage");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [fontStep, setFontStep] = useState(1);
  const [showPassage, setShowPassage] = useState(true);
  const submitTask = useSubmitTask();
  const answerQ = useAnswerQuestion(task.id);
  const ttsRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!task.reading) return null;
  const reading = task.reading;
  const fontSize = [16, 19, 22][fontStep];
  const total = reading.questions.length;
  const q: TaskQuestion = reading.questions[qIndex];
  const hasAnswer =
    answers[q?.id] !== undefined && String(answers[q?.id] ?? "") !== "";

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const setAnswer = (val: string | number) =>
    setAnswers((prev) => ({ ...prev, [q.id]: val }));

  const speakPassage = () => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }
    const utt = new SpeechSynthesisUtterance(reading.passage_text);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    ttsRef.current = utt;
    setIsSpeaking(true);
    synth.speak(utt);
  };

  const handleNext = async () => {
    void answerQ.mutateAsync({ question_id: q.id, answer: answers[q.id] });
    if (qIndex + 1 < total) {
      setQIndex((i) => i + 1);
      return;
    }
    const payload = Object.entries(answers).map(([question_id, answer]) => ({
      question_id,
      answer,
    }));
    await submitTask.mutateAsync({
      taskId: task.id,
      body: { answers: payload },
    });
    onCompleted();
  };

  if (phase === "passage") {
    return (
      <div>
        <BackBar
          onBack={() => navigate("/courses/reading")}
          label="Story Reading"
          exitGuard
        />
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="row gap-12" style={{ marginBottom: 18, flexWrap: "wrap" }}>
            <span className="chip chip-teal">
              Reading · Grade {task.grade_level_at_roll}
            </span>
            <span className="chip">Topic: {task.topic_label}</span>
            <span className="chip">
              <IconClock size={11} /> ~5 min
            </span>
          </div>
          <h1 style={{ fontSize: 42, marginBottom: 14 }}>{reading.title}</h1>
          <div className="row gap-12" style={{ marginBottom: 24, flexWrap: "wrap" }}>
            <button
              className="btn btn-soft btn-sm"
              onClick={speakPassage}
              aria-pressed={isSpeaking}
            >
              <IconVolume size={14} /> {isSpeaking ? "Stop" : "Read aloud"}
            </button>
            <div
              className="row gap-4"
              style={{ background: "var(--paper-2)", borderRadius: 999, padding: 4 }}
            >
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFontStep((s) => Math.max(0, s - 1))}
                disabled={fontStep === 0}
                aria-label="Smaller text"
              >
                <IconType size={14} />
              </button>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  padding: "0 8px",
                  alignSelf: "center",
                }}
              >
                {["Small", "Medium", "Large"][fontStep]}
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFontStep((s) => Math.min(2, s + 1))}
                disabled={fontStep === 2}
                aria-label="Larger text"
              >
                <IconType size={18} />
              </button>
            </div>
          </div>
          <div className="card" style={{ padding: "32px 36px" }}>
            <div className="passage" style={{ fontSize, lineHeight: 1.75 }}>
              {reading.passage_paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              marginTop: 24,
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div className="row gap-12">
              <Mascot size={64} pose="read" kind="ferret" />
              <div
                style={{
                  fontSize: 14,
                  color: "var(--ink-2)",
                  maxWidth: 300,
                }}
              >
                Take your time. You can re-open the passage at any point during
                the questions.
              </div>
            </div>
            <button
              className="btn btn-accent btn-lg"
              onClick={() => setPhase("questions")}
            >
              Start questions <IconArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackBar
        onBack={() => navigate("/courses/reading")}
        label="Story Reading"
        exitGuard
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showPassage ? "1fr 1.2fr" : "1fr",
          gap: 24,
          maxWidth: showPassage ? 1180 : 760,
          margin: "0 auto",
        }}
        className="reading-questions-grid"
      >
        {showPassage && (
          <div>
            <div className="row gap-8" style={{ marginBottom: 14 }}>
              <span className="chip chip-teal">Passage</span>
              <button
                className="btn btn-soft btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => setShowPassage(false)}
              >
                <IconX size={12} /> Hide
              </button>
            </div>
            <div
              className="card reading-passage-panel"
              style={{
                padding: "24px 28px",
                maxHeight: "calc(100vh - 220px)",
                overflowY: "auto",
                position: "sticky",
                top: 80,
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12 }}>{reading.title}</h3>
              <div className="passage" style={{ fontSize: 15.5 }}>
                {reading.passage_paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="row gap-12" style={{ marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
              Question {qIndex + 1} of {total}
            </span>
            <div className="progress-bar" style={{ flex: 1, maxWidth: 240, minWidth: 120 }}>
              <div
                className="progress-fill"
                style={{ width: `${(qIndex / total) * 100}%` }}
              />
            </div>
            {!showPassage && (
              <button
                className="btn btn-soft btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => setShowPassage(true)}
              >
                <IconBook size={12} /> Show passage
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 32 }}>
            <div className="row gap-8" style={{ marginBottom: 14 }}>
              <span className="chip">
                {q.question_type === "multiple_choice"
                  ? "Multiple choice"
                  : q.question_type === "true_false"
                  ? "True or false"
                  : "Fill in the blank"}
              </span>
            </div>
            <h2
              style={{
                fontSize: 24,
                fontFamily: "var(--font-display)",
                marginBottom: 24,
                lineHeight: 1.35,
              }}
            >
              {q.prompt}
            </h2>

            {q.question_type === "multiple_choice" && q.options && (
              <div className="col gap-10">
                {q.options.map((opt, i) => {
                  const sel = answers[q.id] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAnswer(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 18px",
                        borderRadius: 14,
                        textAlign: "left",
                        background: sel ? "var(--teal-soft)" : "var(--paper-2)",
                        border:
                          "1.5px solid " +
                          (sel ? "var(--teal)" : "var(--line)"),
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          flex: "0 0 28px",
                          background: sel ? "var(--teal)" : "var(--paper)",
                          color: sel ? "#fff" : "var(--ink-2)",
                          border: sel
                            ? "none"
                            : "1.5px solid var(--line-strong)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span
                        style={{ fontSize: 15, fontWeight: sel ? 600 : 500 }}
                      >
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {q.question_type === "true_false" && q.options && (
              <div className="row gap-12 true-false-options">
                {q.options.map((opt, i) => {
                  const sel = answers[q.id] === i;
                  const isTrue = i === 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAnswer(i)}
                      style={{
                        flex: 1,
                        padding: 24,
                        borderRadius: 18,
                        textAlign: "center",
                        background: sel
                          ? isTrue
                            ? "var(--good-soft)"
                            : "var(--bad-soft)"
                          : "var(--paper-2)",
                        border:
                          "2px solid " +
                          (sel
                            ? isTrue
                              ? "var(--good)"
                              : "var(--bad)"
                            : "var(--line)"),
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 6 }}>
                        {isTrue ? "✓" : "✕"}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{opt}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {q.question_type === "fill_blank" && (
              <div>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Type your answer…"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) => setAnswer(e.target.value)}
                  style={{
                    fontSize: 18,
                    fontFamily: "var(--font-display)",
                    padding: "16px 18px",
                  }}
                  autoFocus
                />
                <div className="field-help">One word or short phrase.</div>
              </div>
            )}
          </div>

          <div
            className="row"
            style={{
              marginTop: 20,
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              className="row gap-6"
              style={{ fontSize: 12.5, color: "var(--ink-3)" }}
            >
              <IconLock size={12} /> You can't go back to previous questions.
            </div>
            <button
              className="btn btn-accent btn-lg"
              disabled={!hasAnswer || submitTask.isPending}
              onClick={handleNext}
            >
              {qIndex + 1 < total ? (
                <>
                  Next <IconArrowRight size={16} />
                </>
              ) : (
                <>
                  Finish <IconCheck size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------- Writing ----------------

interface WritingTaskProps {
  task: Task;
}

const SAMPLE_WRITING_TEXT =
  "I would love to visit Kyoto, the old capital of Japan. I would walk through the bamboo forest in Arashiyama early in the morning, when it's quiet and a little misty. After that, I would stop at a small tea shop to try matcha and sweet mochi. In the afternoon, I would visit the Fushimi Inari shrine and slowly climb the path under thousands of red gates. Kyoto matters to me because my grandmother always told me stories about Japanese gardens, and I want to see them with my own eyes one day.";

const WritingTask = ({ task }: WritingTaskProps) => {
  const navigate = useNavigate();
  const writing = task.writing;
  const [text, setText] = useState(writing?.draft ?? "");
  const lastSavedTextRef = useRef(writing?.draft ?? "");
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submitTask = useSubmitTask({
    onSuccess: () => navigate(`/tasks/${task.id}`),
  });
  const saveDraft = useSaveDraft(task.id);

  const minWords = writing?.min_words ?? 60;
  const maxWords = writing?.max_words ?? 120;
  const words = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text]
  );
  const okLen = words >= minWords && words <= maxWords;
  const isDirty = text !== lastSavedTextRef.current;
  const submitGuidance =
    words < minWords
      ? `Need ${minWords - words} more ${minWords - words === 1 ? "word" : "words"}`
      : words > maxWords
      ? `${words - maxWords} ${words - maxWords === 1 ? "word" : "words"} over limit`
      : "Ready to submit";

  const saveCurrentDraft = useCallback(
    async (nextText: string) => {
      setDraftStatus("saving");
      setDraftError(null);
      try {
        await saveDraft.mutateAsync(nextText);
        lastSavedTextRef.current = nextText;
        setDraftStatus("saved");
        return true;
      } catch {
        setDraftStatus("error");
        setDraftError("Draft could not be saved. Please try again.");
        return false;
      }
    },
    [saveDraft.mutateAsync]
  );

  // Auto-save every 10s when text changes (PRD §7.2).
  useEffect(() => {
    if (!isDirty) return;
    setDraftStatus("dirty");
    setDraftError(null);
    const t = setTimeout(async () => {
      void saveCurrentDraft(text);
    }, 10_000);
    return () => clearTimeout(t);
  }, [isDirty, saveCurrentDraft, text]);

  const handleLeave = async () => {
    if (isDirty) {
      const saved = await saveCurrentDraft(text);
      if (!saved) throw new Error("draft_save_failed");
    }
    navigate("/courses/writing");
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await submitTask.mutateAsync({
        taskId: task.id,
        body: { full_text: text },
      });
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
      setSubmitError("We couldn't submit your answer. Please try again.");
    }
  };

  if (!writing) return null;

  return (
    <div>
      <BackBar
        onBack={handleLeave}
        label="Writing Practice"
        exitGuard
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 28,
          maxWidth: 1180,
          margin: "0 auto",
        }}
        className="writing-grid"
      >
        <div>
          <div
            className="card"
            style={{
              background: "var(--rust-soft)",
              borderColor: "transparent",
              padding: 24,
              marginBottom: 20,
            }}
          >
            <div className="row gap-8" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              <span className="chip" style={{ background: "var(--paper)" }}>
                Topic
              </span>
              <span className="chip" style={{ background: "var(--paper)" }}>
                {task.topic_label}
              </span>
              <span className="chip" style={{ background: "var(--paper)" }}>
                <IconClock size={11} /> ~10 min
              </span>
            </div>
            <h2 style={{ fontSize: 26, marginBottom: 8 }}>{writing.title}</h2>
            <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55 }}>
              {writing.prompt}
            </p>
          </div>

          <div
            className="row gap-12"
            style={{ marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}
          >
            <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
              Your answer
            </span>
            <span
              className="chip"
              style={{
                marginLeft: "auto",
                color: okLen
                  ? "var(--good)"
                  : words > maxWords
                  ? "var(--bad)"
                  : "var(--ink-3)",
              }}
            >
              <span className="tabnum" style={{ fontWeight: 700 }}>
                {words}
              </span>{" "}
              / {minWords}–{maxWords} words
            </span>
            <span className={`writing-save-status ${draftStatus}`}>
              {draftStatus === "saving"
                ? "Saving..."
                : draftStatus === "saved"
                ? "Saved"
                : draftStatus === "error"
                ? "Could not save"
                : isDirty
                ? "Unsaved changes"
                : "Draft ready"}
            </span>
          </div>
          <textarea
            className="field-textarea"
            placeholder="Start writing here…"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSubmitError(null);
            }}
            style={{
              minHeight: 340,
              fontFamily: "var(--font-display)",
              fontSize: 17,
              lineHeight: 1.7,
              padding: "20px 22px",
              borderRadius: 18,
            }}
          />
          <div className="writing-action-bar">
            <button
              className="btn btn-soft btn-sm"
              onClick={() => setShowExample((s) => !s)}
              aria-expanded={showExample}
            >
              {showExample ? "Hide example" : "Show example"}
            </button>
            <span
              className={`writing-submit-guidance ${
                okLen ? "ready" : words > maxWords ? "error" : ""
              }`}
            >
              {submitGuidance}
            </span>
            <div className="row gap-12 writing-task-actions">
              <button
                className="btn btn-ghost"
                onClick={() => void saveCurrentDraft(text)}
                disabled={draftStatus === "saving" || !isDirty}
                aria-busy={draftStatus === "saving"}
              >
                {draftStatus === "saving" ? "Saving..." : "Save draft"}
              </button>
              <button
                className="btn btn-accent"
                disabled={!okLen || submitTask.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                Submit <IconArrowRight size={14} />
              </button>
            </div>
          </div>
          {(draftError || submitError) && (
            <div className="field-error" style={{ marginTop: 10 }}>
              {draftError || submitError}
            </div>
          )}
          {showExample && (
            <div className="card writing-example">
              <h4>Example answer</h4>
              <p>{SAMPLE_WRITING_TEXT}</p>
            </div>
          )}
        </div>

        <div className="writing-side">
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 10 }}>Hints from hafuyfay</h4>
            <div className="col gap-10">
              {writing.hints.map((h, i) => (
                <div
                  key={i}
                  className="row gap-8"
                  style={{ alignItems: "flex-start" }}
                >
                  <span style={{ marginTop: 2, color: "var(--rust)" }}>
                    <IconCheck size={14} />
                  </span>
                  <span style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                    {h}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="card"
            style={{ background: "var(--paper-2)", textAlign: "center" }}
          >
            <Mascot size={100} pose="write" kind="ferret" />
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-2)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Take your time. Drafts auto-save every few seconds — close the
              tab and come back later if you need.
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        ariaLabel="Confirm submit"
      >
        <div style={{ textAlign: "center" }}>
          <Mascot size={84} pose="wave" kind="ferret" />
          <h3 style={{ marginTop: 8, marginBottom: 6 }}>Send it to hafuyfay?</h3>
          <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 20 }}>
            Once submitted, you can't change your answer. We'll send a
            notification when feedback is ready (usually under a minute).
          </p>
          <div className="modal-actions modal-actions-center">
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Keep editing
            </button>
            <button
              className="btn btn-accent"
              onClick={handleSubmit}
              disabled={submitTask.isPending}
            >
              Submit answer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ---------------- Writing Processing ----------------

const WritingProcessing = ({ task }: { task: Task }) => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const total = 8000;
    const id = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / total) * 100);
      setProgress(p);
      if (p >= 100) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, []);

  // When the task transitions to completed (via mock event or polling), navigate to result.
  useEffect(() => {
    if (task.status === "completed") {
      navigate(`/tasks/${task.id}/result`);
    }
  }, [task.status, task.id, navigate]);

  return (
    <div style={{ maxWidth: 560, margin: "40px auto 0", textAlign: "center" }}>
      <BackBar onBack={() => navigate("/dashboard")} label="Writing Practice" />
      <div className="card" style={{ padding: 48 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <Mascot size={120} pose="thinking" mood="thinking" kind="ferret" />
        </div>
        <span className="chip chip-sky">
          <span
            className="status-dot processing"
            style={{ display: "inline-block", marginRight: 4 }}
          />{" "}
          Processing
        </span>
        <h2 style={{ fontSize: 30, margin: "14px 0 8px" }}>
          hafuyfay is reading your answer…
        </h2>
        <p style={{ color: "var(--ink-3)", fontSize: 15, marginBottom: 24 }}>
          We're looking at grammar, vocabulary, structure, and topic relevance.
          Usually under a minute.
        </p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%`, background: "var(--sky)" }}
          />
        </div>
        <div
          className="tabnum"
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--ink-3)",
          }}
        >
          {Math.round(progress)}% · checking your work
        </div>
        <div
          style={{
            marginTop: 28,
            padding: "14px 18px",
            background: "var(--paper-2)",
            borderRadius: 14,
            fontSize: 13,
            color: "var(--ink-2)",
            textAlign: "left",
            display: "flex",
            gap: 12,
          }}
        >
          <span style={{ color: "var(--rust)" }}>💡</span>
          <span>
            <strong>You can leave this page.</strong> We'll notify you when it's
            done — your task will appear on the dashboard.
          </span>
        </div>
        <div
          className="row gap-12"
          style={{ marginTop: 24, justifyContent: "center" }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
