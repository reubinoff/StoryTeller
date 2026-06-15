import type { Achievement, Interest } from "~/lib/api/types";
import { TOPIC_STICKERS } from "~/lib/topics";

interface TopicStickerProps {
  topic: Interest;
  selected?: boolean;
  size?: "sm" | "md" | "lg";
}

const ACHIEVEMENT_STICKERS: Record<string, { symbol: string; bg: string; fg: string }> = {
  first_quest: { symbol: "Quest", bg: "var(--teal-soft)", fg: "var(--teal)" },
  bookworm: { symbol: "Pages", bg: "var(--moss-soft)", fg: "var(--moss)" },
  bullseye: { symbol: "Aim", bg: "var(--rust-soft)", fg: "var(--rust)" },
  page_turner: { symbol: "Story", bg: "var(--sky-soft)", fg: "var(--sky)" },
  wordsmith: { symbol: "Words", bg: "var(--berry-soft)", fg: "var(--berry)" },
  marathoner: { symbol: "Path", bg: "var(--amber-soft)", fg: "var(--amber-ink)" },
};

export function TopicSticker({ topic, selected = false, size = "md" }: TopicStickerProps) {
  const sticker = TOPIC_STICKERS[topic.id];
  return (
    <span
      className={`topic-sticker topic-sticker-${size} ${selected ? "selected" : ""}`}
      style={{
        ["--sticker-bg" as never]: sticker.bg,
        ["--sticker-fg" as never]: sticker.fg,
      }}
      aria-hidden="true"
    >
      <span className="topic-sticker-shape">{sticker.symbol}</span>
      <span className="topic-sticker-emoji">{topic.emoji}</span>
    </span>
  );
}

export function AchievementSticker({
  achievement,
  size = "md",
}: {
  achievement: Achievement;
  size?: "sm" | "md" | "lg";
}) {
  const sticker = ACHIEVEMENT_STICKERS[achievement.slug];
  return (
    <span
      className={`achievement-sticker achievement-sticker-${size}`}
      style={{
        ["--sticker-bg" as never]: sticker?.bg ?? "var(--paper-2)",
        ["--sticker-fg" as never]: sticker?.fg ?? "var(--ink-2)",
      }}
      aria-hidden="true"
    >
      <span className="achievement-sticker-symbol">
        {sticker?.symbol ?? achievement.icon}
      </span>
      {sticker && <span className="achievement-sticker-emoji">{achievement.icon}</span>}
    </span>
  );
}
