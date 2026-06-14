import { Link } from "react-router";
import { BrandLogo } from "~/components/Mascot";
import { HELP_DESCRIPTION, HELP_TITLE, faqJsonLd, pageMeta } from "~/lib/seo";

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

export function meta() {
  return pageMeta({
    title: HELP_TITLE,
    description: HELP_DESCRIPTION,
    path: "/help",
    jsonLd: faqJsonLd(FAQS),
  });
}

export default function HelpRoute() {
  return (
    <div className="fullbleed-shell" style={{ padding: "32px 48px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          to="/"
          className="brand-logo-link"
          style={{ color: "inherit", marginBottom: 32 }}
        >
          <BrandLogo width={160} />
        </Link>
        <h1 style={{ fontSize: 42, marginBottom: 8 }}>Help & FAQ</h1>
        <p style={{ color: "var(--ink-3)", marginBottom: 24 }}>
          Common questions about Storyteller.
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
