import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  IconArrowRight,
  IconCheck,
  IconSparkle,
} from "~/components/Icons";
import { BrandLogo, FeatureIcon, Mascot } from "~/components/Mascot";
import { useAuth } from "~/lib/auth";
import { postAuthDestination } from "~/lib/auth-routing";

export function meta() {
  return [
    { title: "Storyteller — English learning through stories" },
    {
      name: "description",
      content:
        "Bite-sized reading and writing practice tuned to your age and interests. Read fresh stories, get feedback, and watch your streak climb.",
    },
  ];
}

export default function Landing() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (ready && user) {
      navigate(postAuthDestination(user), { replace: true });
    }
  }, [ready, user, navigate]);

  return (
    <div
      className="fullbleed-shell"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "22px 48px",
          maxWidth: 1400,
          margin: "0 auto",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/"
          className="brand-logo-link"
          style={{ color: "inherit", flex: "0 0 auto" }}
        >
          <BrandLogo width={168} />
        </Link>
        <div
          className="row gap-24"
          style={{
            marginLeft: "auto",
            fontSize: 14,
            color: "var(--ink-2)",
            flexWrap: "wrap",
          }}
        >
          <Link to="/login" style={{ cursor: "pointer" }}>
            Log in
          </Link>
          <Link to="/signup" className="btn btn-primary btn-sm">
            Sign up free
          </Link>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "40px 48px 60px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)",
          gap: 56,
          alignItems: "center",
        }}
        className="landing-hero"
      >
        <div>
          <span className="chip chip-rust" style={{ marginBottom: 18 }}>
            <IconSparkle size={12} /> English learning through stories
          </span>
          <h1
            style={{
              fontSize: 68,
              lineHeight: 1.02,
              marginBottom: 18,
              letterSpacing: 0,
            }}
          >
            Learn English through{" "}
            <em
              style={{
                color: "var(--rust)",
                fontStyle: "normal",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
              }}
            >
              stories
            </em>
            .
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "var(--ink-2)",
              lineHeight: 1.55,
              maxWidth: 520,
              marginBottom: 28,
            }}
          >
            Bite-sized reading and writing tasks tuned to your age and
            interests. Roll a fresh story whenever you want, get practical
            feedback, and watch your streak grow. Built for ages 6 to 40.
          </p>
          <div className="row gap-12" style={{ flexWrap: "wrap" }}>
            <Link to="/signup" className="btn btn-accent btn-lg">
              Start free <IconArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              I have an account
            </Link>
          </div>
          <div
            className="row gap-24"
            style={{ marginTop: 36, color: "var(--ink-3)", fontSize: 13, flexWrap: "wrap" }}
          >
            <div className="row gap-6">
              <IconCheck size={14} /> No credit card
            </div>
            <div className="row gap-6">
              <IconCheck size={14} /> Adapts to your grade
            </div>
            <div className="row gap-6">
              <IconCheck size={14} /> Works on any device
            </div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <div
            className="card"
            style={{
              background: "var(--paper-2)",
              padding: 24,
              transform: "rotate(-2deg)",
              boxShadow: "var(--shadow-lg)",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div className="row gap-12" style={{ marginBottom: 14 }}>
              <span className="chip chip-teal">Reading · Grade 4</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "var(--ink-3)",
                }}
              >
                Question 3 of 6
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                lineHeight: 1.5,
                color: "var(--ink-2)",
                marginBottom: 18,
              }}
            >
              According to the passage, why are Saturn's rings not going to last
              forever?
            </div>
            <div className="col gap-8">
              {[
                "They are made of metal that rusts.",
                "Saturn's gravity is slowly pulling them in.",
                "The Sun heats them up.",
                "Comets crash into them.",
              ].map((t, i) => (
                <div
                  key={i}
                  className="row gap-12"
                  style={{
                    padding: "12px 14px",
                    background: i === 1 ? "var(--teal-soft)" : "var(--paper)",
                    border:
                      "1.5px solid " +
                      (i === 1 ? "var(--teal)" : "var(--line)"),
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: i === 1 ? 600 : 500,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border:
                        "1.5px solid " +
                        (i === 1 ? "var(--teal)" : "var(--line-strong)"),
                      background: i === 1 ? "var(--teal)" : "transparent",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div
            className="card"
            style={{
              position: "absolute",
              right: -30,
              top: -40,
              padding: 18,
              transform: "rotate(6deg)",
              width: 240,
              background: "var(--ink)",
              color: "var(--paper)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 1,
              borderColor: "transparent",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              Streak
            </div>
            <div
              className="row gap-6"
              style={{ alignItems: "baseline" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 48,
                  fontWeight: 700,
                }}
              >
                7
              </span>
              <span style={{ fontSize: 13, opacity: 0.7 }}>days in a row</span>
            </div>
            <div className="row gap-4" style={{ marginTop: 10 }}>
              {[1, 1, 1, 1, 1, 1, 1].map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: "var(--rust)",
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ position: "absolute", right: -10, bottom: -30, zIndex: 3 }}>
            <Mascot size={140} pose="cheer" kind="ferret" />
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--line)",
          background: "var(--paper-2)",
          padding: "56px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 24,
          }}
          className="landing-features"
        >
          {[
            {
              t: "Fresh stories",
              d: "Every reading task is generated for your level and chosen interests.",
              i: <FeatureIcon name="stories" size={50} alt="" />,
              c: "var(--rust)",
            },
            {
              t: "Practice words",
              d: "Answer focused questions and build vocabulary one short session at a time.",
              i: <FeatureIcon name="words" size={50} alt="" />,
              c: "var(--teal)",
            },
            {
              t: "Useful feedback",
              d: "Submit a short answer and get notes on grammar, vocabulary, structure, and topic.",
              i: <FeatureIcon name="practice" size={50} alt="" />,
              c: "var(--berry)",
            },
          ].map((f) => (
            <div key={f.t} className="card" style={{ background: "var(--paper)" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  color: f.c,
                  marginBottom: 14,
                }}
              >
                {f.i}
              </div>
              <h3 style={{ marginBottom: 6 }}>{f.t}</h3>
              <p style={{ color: "var(--ink-3)", fontSize: 14 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "24px 48px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--ink-3)",
        }}
      >
        Made with <span aria-label="love">❤️</span> by Moshe Reubinoff
      </footer>
    </div>
  );
}
