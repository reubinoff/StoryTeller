import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconSparkle,
} from "~/components/Icons";
import { BrandLogo, Mascot } from "~/components/Mascot";
import { TopicSticker } from "~/components/Stickers";
import { useToast } from "~/components/Toast";
import { useAuth } from "~/lib/auth";
import type { InterestId } from "~/lib/api/types";
import { englishLevelLabel } from "~/lib/english-level";
import { TOPICS } from "~/lib/topics";

export function meta() {
  return [{ title: "Welcome · Storyteller" }];
}

type AgeBand = "6-8" | "9-12" | "13+";

const AGE_BAND_COPY: Record<AgeBand, { welcome: string; level: string; topics: string }> = {
  "6-8": {
    welcome: "We'll use big choices, friendly stories, and one step at a time.",
    level: "We'll start gently. You can change this with a grown-up later.",
    topics: "Pick pictures you like. We'll turn them into stories.",
  },
  "9-12": {
    welcome: "We'll set up stories that feel playful, clear, and just right for your level.",
    level: "You can tune this in Settings later.",
    topics: "Pick topics you like. We'll mix them into reading and writing tasks.",
  },
  "13+": {
    welcome: "We'll tune your practice around your age, English level, interests, and pace.",
    level: "You can tune this in Settings later.",
    topics: "Choose up to 6 interests so your tasks feel relevant.",
  },
};

function ageBandForYear(yearOfBirth: number): AgeBand {
  const age = new Date().getFullYear() - yearOfBirth;
  if (age <= 8) return "6-8";
  if (age <= 12) return "9-12";
  return "13+";
}

export default function OnboardingRoute() {
  const navigate = useNavigate();
  const { user, ready, completeOnboarding } = useAuth();
  const { push } = useToast();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (ready && !user) navigate("/login");
    if (ready && user?.onboarding_completed) navigate("/dashboard", { replace: true });
  }, [ready, user, navigate]);

  const yob = user?.year_of_birth ?? new Date().getFullYear() - 12;
  const [interests, setLocalInterests] = useState<InterestId[]>(
    user?.interests ?? []
  );

  const grade = useMemo(
    () => Math.max(1, Math.min(12, new Date().getFullYear() - yob - 5)),
    [yob]
  );
  const ageBand = useMemo(() => ageBandForYear(yob), [yob]);
  const ageCopy = AGE_BAND_COPY[ageBand];
  const startingLevel = user?.english_level ?? 0;
  const startingLevelLabel = englishLevelLabel(startingLevel);

  if (!user) return null;

  const toggle = (id: InterestId) => {
    setLocalInterests((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  };

  const finish = async () => {
    await completeOnboarding({
      interest_ids: interests,
    });
    push({
      icon: "🎉",
      title: `Welcome, ${user.first_name}!`,
      body: "Roll your first task whenever you're ready.",
    });
    navigate("/dashboard");
  };

  return (
    <div
      className="fullbleed-shell"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <div
        className="onboarding-header"
        style={{
          padding: "20px 32px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <BrandLogo width={150} />
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: step === i ? 36 : 20,
                height: 6,
                borderRadius: 3,
                background: i <= step ? "var(--rust)" : "var(--line)",
                transition: "all .3s",
              }}
            />
          ))}
          <span
            className="tabnum"
            style={{
              marginLeft: 8,
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            Step {step + 1} of 3
          </span>
        </div>
      </div>

      <div
        className="onboarding-body"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: step === 2 ? 920 : 580 }}>
          {step === 0 && (
            <div style={{ textAlign: "center" }} className="page-fadein">
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                <Mascot size={140} pose="wave" kind="ferret" />
              </div>
              <span className="chip chip-rust">Welcome aboard</span>
              <h1
                className="onboarding-title"
                style={{
                  fontSize: 52,
                  margin: "14px 0 10px",
                  letterSpacing: 0,
                }}
              >
                Hi {user.first_name}! I'm hafuyfay.
              </h1>
              <p
                style={{
                  fontSize: 17,
                  color: "var(--ink-2)",
                  maxWidth: 480,
                  margin: "0 auto 28px",
                }}
              >
                I'll be your guide here. Let's set up your story practice in
                three quick steps so every task fits you just right. {ageCopy.welcome}
              </p>
              <button
                className="btn btn-accent btn-lg"
                onClick={() => setStep(1)}
              >
                Let's go <IconArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="page-fadein">
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <h1 className="onboarding-title-sm" style={{ fontSize: 44, marginBottom: 10 }}>
                  Your starting level
                </h1>
                <p
                  style={{
                    color: "var(--ink-3)",
                    fontSize: 16,
                    maxWidth: 480,
                    margin: "0 auto",
                  }}
                >
                  Based on your year of birth ({yob}), we suggest{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    Level {startingLevel}
                  </strong>
                  . {ageCopy.level}
                </p>
              </div>

              <div
                className="card"
                style={{
                  background: "var(--paper-2)",
                  maxWidth: 560,
                  margin: "0 auto",
                  padding: 28,
                }}
              >
                <div className="field-label">English level</div>
                <div className="onboarding-level-meter" aria-label="Starting English level">
                  <div className="onboarding-level-number">{startingLevel}</div>
                  <div>
                    <div className="onboarding-level-label">{startingLevelLabel}</div>
                    <div className="field-help">
                      This controls English difficulty. Your birth year still helps
                      keep topics age-appropriate.
                    </div>
                  </div>
                </div>
                <div className="onboarding-level-track" aria-hidden="true">
                  <span style={{ width: `${startingLevel}%` }} />
                </div>
                <div className="field-help" style={{ textAlign: "center" }}>
                  You're in school grade {grade}. Change English level anytime in
                  Settings.
                </div>
              </div>

              <div
                className="row gap-12"
                style={{ justifyContent: "center", marginTop: 28 }}
              >
                <button className="btn btn-ghost" onClick={() => setStep(0)}>
                  <IconArrowLeft size={14} /> Back
                </button>
                <button
                  className="btn btn-accent btn-lg"
                  onClick={() => setStep(2)}
                >
                  Continue <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="page-fadein">
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <h1 className="onboarding-title-sm" style={{ fontSize: 42, marginBottom: 8 }}>
                  What do you love?
                </h1>
                <p style={{ color: "var(--ink-3)", fontSize: 16 }}>
                  {ageCopy.topics}
                </p>
                <div className="chip chip-teal" style={{ marginTop: 14 }}>
                  {interests.length} of 6 selected
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: 12,
                }}
                className={`onboarding-topics onboarding-topics-${ageBand.replace("+", "plus")}`}
              >
                {TOPICS.map((t) => {
                  const sel = interests.includes(t.id);
                  const dim = !sel && interests.length >= 6;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      disabled={dim}
                      style={{
                        padding: ageBand === "6-8" ? "20px 12px" : "18px 12px",
                        borderRadius: 18,
                        border:
                          "2px solid " +
                          (sel ? "var(--teal)" : "var(--line)"),
                        background: sel ? "var(--teal-soft)" : "var(--paper)",
                        textAlign: "center",
                        cursor: dim ? "not-allowed" : "pointer",
                        opacity: dim ? 0.45 : 1,
                        transition: "all .15s",
                        position: "relative",
                      }}
                    >
                      <TopicSticker topic={t} selected={sel} size={ageBand === "6-8" ? "lg" : "md"} />
                      <div
                        style={{
                          fontSize: ageBand === "6-8" ? 14 : 13,
                          fontWeight: 600,
                          color: sel ? "var(--teal)" : "var(--ink-2)",
                        }}
                      >
                        {t.display_name}
                      </div>
                      {sel && (
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "var(--teal)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconCheck size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div
                className="row gap-12"
                style={{ justifyContent: "center", marginTop: 28 }}
              >
                <button className="btn btn-ghost" onClick={() => setStep(1)}>
                  <IconArrowLeft size={14} /> Back
                </button>
                <button
                  className="btn btn-accent btn-lg"
                  disabled={interests.length === 0}
                  onClick={finish}
                >
                  Roll my first task <IconSparkle size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
