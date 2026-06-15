import type { Interest, InterestId } from "./api/types";

export interface TopicSticker {
  symbol: string;
  bg: string;
  fg: string;
}

export const TOPIC_STICKERS: Record<InterestId, TopicSticker> = {
  animals: { symbol: "Paw", bg: "var(--moss-soft)", fg: "var(--moss)" },
  sports: { symbol: "Goal", bg: "var(--teal-soft)", fg: "var(--teal)" },
  music: { symbol: "Note", bg: "var(--berry-soft)", fg: "var(--berry)" },
  movies: { symbol: "Scene", bg: "var(--sky-soft)", fg: "var(--sky)" },
  science: { symbol: "Leaf", bg: "var(--moss-soft)", fg: "var(--moss)" },
  space: { symbol: "Moon", bg: "var(--sky-soft)", fg: "var(--sky)" },
  tech: { symbol: "Code", bg: "var(--teal-soft)", fg: "var(--teal)" },
  food: { symbol: "Cook", bg: "var(--amber-soft)", fg: "var(--amber-ink)" },
  travel: { symbol: "Map", bg: "var(--rust-soft)", fg: "var(--rust)" },
  art: { symbol: "Paint", bg: "var(--berry-soft)", fg: "var(--berry)" },
  books: { symbol: "Book", bg: "var(--teal-soft)", fg: "var(--teal)" },
  games: { symbol: "Quest", bg: "var(--sky-soft)", fg: "var(--sky)" },
  history: { symbol: "Time", bg: "var(--paper-3)", fg: "var(--sable)" },
  cars: { symbol: "Ride", bg: "var(--rust-soft)", fg: "var(--rust)" },
  health: { symbol: "Care", bg: "var(--good-soft)", fg: "var(--good)" },
};

export const TOPICS: Interest[] = [
  { id: "animals", display_name: "Animals & Pets", emoji: "🐾", display_order: 1 },
  { id: "sports", display_name: "Sports", emoji: "⚽", display_order: 2 },
  { id: "music", display_name: "Music", emoji: "🎵", display_order: 3 },
  { id: "movies", display_name: "Movies & TV", emoji: "🎬", display_order: 4 },
  { id: "science", display_name: "Science & Nature", emoji: "🌿", display_order: 5 },
  { id: "space", display_name: "Space & Astronomy", emoji: "🚀", display_order: 6 },
  { id: "tech", display_name: "Tech & Gadgets", emoji: "💻", display_order: 7 },
  { id: "food", display_name: "Food & Cooking", emoji: "🍳", display_order: 8 },
  { id: "travel", display_name: "Travel & Cultures", emoji: "🌍", display_order: 9 },
  { id: "art", display_name: "Art & Drawing", emoji: "🎨", display_order: 10 },
  { id: "books", display_name: "Books & Stories", emoji: "📖", display_order: 11 },
  { id: "games", display_name: "Video Games", emoji: "🎮", display_order: 12 },
  { id: "history", display_name: "History", emoji: "⏳", display_order: 13 },
  { id: "cars", display_name: "Cars & Vehicles", emoji: "🚗", display_order: 14 },
  { id: "health", display_name: "Health & Wellness", emoji: "💚", display_order: 15 },
];

export const TOPIC_BY_ID: Record<InterestId, Interest> = TOPICS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<InterestId, Interest>
);
