import { Skeleton } from "~/components/Skeleton";
import { useAchievements } from "~/lib/api/queries";

export function meta() {
  return [{ title: "Achievements · LinguaQuest" }];
}

export default function AchievementsRoute() {
  const q = useAchievements();
  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <h1 style={{ fontSize: 42, marginBottom: 8 }}>Achievements</h1>
      <p style={{ color: "var(--ink-3)", marginBottom: 24 }}>
        Badges you've earned, and what's next.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {q.isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={140} radius={22} />
          ))}
        {q.data?.map((a) => (
          <div
            key={a.id}
            className="card"
            style={{ textAlign: "center", opacity: a.earned ? 1 : 0.5 }}
          >
            <div style={{ fontSize: 48, marginBottom: 8 }}>{a.icon}</div>
            <h4>{a.name}</h4>
            <p
              style={{
                color: "var(--ink-3)",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              {a.description}
            </p>
            <span
              className="chip"
              style={{
                marginTop: 10,
                background: a.earned ? "var(--good-soft)" : "var(--paper-2)",
                color: a.earned ? "var(--good)" : "var(--ink-3)",
                borderColor: "transparent",
              }}
            >
              {a.earned ? "Earned" : "Locked"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
