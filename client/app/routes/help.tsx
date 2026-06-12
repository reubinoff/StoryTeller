import { Link } from "react-router";
import { BrandMark } from "~/components/Mascot";

export function meta() {
  return [{ title: "Help & FAQ · StoryTeller" }];
}

const FAQS: Array<[string, string]> = [
  [
    "How does the difficulty work?",
    "We use your year of birth to set a starting grade level (1–12). As you complete tasks, content gets a little harder or easier based on how you do.",
  ],
  [
    'What is a "task"?',
    "A task is a single short exercise — either a reading passage with questions, or a writing prompt. They take 5–10 minutes and you can roll a fresh one any time.",
  ],
  [
    "How long does writing feedback take?",
    "Usually under a minute. We'll send you a notification when it's ready, so feel free to leave the page.",
  ],
  [
    "Can I change my interests later?",
    "Yes — go to Settings → Interests and pick up to 6 new topics any time.",
  ],
];

export default function HelpRoute() {
  return (
    <div className="fullbleed-shell" style={{ padding: "32px 48px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          to="/"
          className="row gap-12"
          style={{ color: "inherit", marginBottom: 32 }}
        >
          <BrandMark size={28} color="var(--ink)" />
          <div className="brand-name" style={{ fontSize: 18 }}>
            StoryTeller
          </div>
        </Link>
        <h1 style={{ fontSize: 42, marginBottom: 8 }}>Help & FAQ</h1>
        <p style={{ color: "var(--ink-3)", marginBottom: 24 }}>
          Common questions about StoryTeller.
        </p>
        <div className="col gap-12">
          {FAQS.map(([q, a]) => (
            <div key={q} className="card">
              <h4 style={{ marginBottom: 6 }}>{q}</h4>
              <p style={{ color: "var(--ink-2)", fontSize: 14 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
