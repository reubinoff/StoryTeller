import { useNavigate } from "react-router";
import {
  BigCourseCard,
  ReadingIllustration,
  WritingIllustration,
} from "~/components/CourseCards";
import { FeatureIcon } from "~/components/Mascot";
import { SectionHeader } from "~/components/SectionHeader";

export function meta() {
  return [{ title: "Courses · Storyteller" }];
}

export default function CoursesRoute() {
  const navigate = useNavigate();
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title" style={{ fontSize: 44, marginBottom: 8 }}>
          Courses
        </h1>
        <p
          style={{
            color: "var(--ink-3)",
            fontSize: 16,
            maxWidth: 560,
          }}
        >
          Two ways to practice with stories. Pick one and roll a fresh task;
          every one is generated for your level and interests.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: 20,
        }}
        className="courses-grid"
      >
        <BigCourseCard
          title="Story Reading"
          subtitle="Unseen Text"
          description="Read a short passage about something you love, then answer 5–10 questions. Get an instant score and a question-by-question breakdown."
          accent="var(--teal)"
          accentSoft="var(--teal-soft)"
          illustration={<ReadingIllustration />}
          meta="5 min average · Adapts to your grade"
          onClick={() => navigate("/courses/reading")}
        />
        <BigCourseCard
          title="Writing Practice"
          subtitle="Short-Answer Writing"
          description="Get a topic prompt and write 60–120 words. We'll send it back with grammar, vocabulary, structure, and topic feedback."
          accent="var(--rust)"
          accentSoft="var(--rust-soft)"
          illustration={<WritingIllustration />}
          meta="10 min average · Async feedback"
          onClick={() => navigate("/courses/writing")}
        />
      </div>
      <div style={{ marginTop: 48 }}>
        <SectionHeader
          title="More courses coming soon"
          subtitle="We're working on speaking practice, vocabulary builders, and group challenges."
        />
        <div
          className="courses-coming-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 16,
          }}
        >
          {[
            {
              name: "Speaking Lab",
              desc: "Practice pronunciation with AI feedback",
              icon: <FeatureIcon name="speak" size={48} alt="" />,
            },
            {
              name: "Word Builder",
              desc: "Daily vocabulary, spaced repetition",
              icon: <FeatureIcon name="words" size={48} alt="" />,
            },
            {
              name: "Story Maker",
              desc: "Co-write a story with hafuyfay",
              icon: <FeatureIcon name="stories" size={48} alt="" />,
            },
          ].map((c) => (
            <div
              key={c.name}
              className="card"
              style={{ background: "var(--paper-2)", opacity: 0.85 }}
            >
              <div className="row gap-12" style={{ marginBottom: 10 }}>
                {c.icon}
                <span className="chip">Coming soon</span>
              </div>
              <h4 style={{ marginBottom: 4 }}>{c.name}</h4>
              <p style={{ color: "var(--ink-3)", fontSize: 13 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
