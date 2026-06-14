/**
 * In-browser mock database. Persists to localStorage so the demo survives
 * reloads and feels like a real backend. Seeded once on first read.
 */

import type {
  Achievement,
  Course,
  Notification,
  Task,
  User,
  WritingEvaluation,
} from "../types";

const STORAGE_KEY = "storyteller.mock.v1";

interface MockState {
  users: Record<string, User & { password_hash?: string }>;
  tasks: Record<string, Task>;
  user_tasks: Record<string, string[]>;
  notifications: Record<string, Notification[]>;
  achievements_by_user: Record<string, Achievement[]>;
  drafts: Record<string, string>; // taskId -> draft text
  current_user_id: string | null;
}

export const COURSES: Course[] = [
  {
    id: "reading",
    slug: "reading_adventure",
    type: "unseen_text",
    title: "Story Reading",
    subtitle: "Unseen Text",
    description:
      "Read a short story on a topic you love, then answer questions to lock in what you learned. Instant score, full breakdown.",
    min_grade: 1,
    max_grade: 12,
    estimated_minutes: 5,
    illustration: "reading",
  },
  {
    id: "writing",
    slug: "writing_studio",
    type: "short_writing",
    title: "Writing Practice",
    subtitle: "Short-Answer Writing",
    description:
      "Get a thoughtful prompt, write 60–120 words, and we'll send back a detailed breakdown of grammar, vocabulary, structure, and topic relevance.",
    min_grade: 1,
    max_grade: 12,
    estimated_minutes: 10,
    illustration: "writing",
  },
];

export const ACHIEVEMENTS_TEMPLATE: Achievement[] = [
  {
    id: "first",
    slug: "first_quest",
    name: "First Story",
    description: "Completed your first task",
    icon: "🎯",
    earned: true,
    earned_at: new Date(Date.now() - 86400_000 * 5).toISOString(),
  },
  {
    id: "streak7",
    slug: "bookworm",
    name: "Bookworm",
    description: "7-day streak",
    icon: "🔥",
    earned: true,
    earned_at: new Date(Date.now() - 86400_000 * 1).toISOString(),
  },
  {
    id: "perfect",
    slug: "bullseye",
    name: "Bullseye",
    description: "A perfect 100% score",
    icon: "🎯",
    earned: true,
    earned_at: new Date(Date.now() - 86400_000 * 3).toISOString(),
  },
  {
    id: "reader10",
    slug: "page_turner",
    name: "Page-Turner",
    description: "Finished 10 reading tasks",
    icon: "📖",
    earned: true,
    earned_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
  },
  {
    id: "writer5",
    slug: "wordsmith",
    name: "Wordsmith",
    description: "Submitted 5 writing tasks",
    icon: "✍️",
    earned: false,
    earned_at: null,
  },
  {
    id: "streak30",
    slug: "marathoner",
    name: "Marathoner",
    description: "30-day streak",
    icon: "🏆",
    earned: false,
    earned_at: null,
  },
];

const initialState = (): MockState => ({
  users: {},
  tasks: {},
  user_tasks: {},
  notifications: {},
  achievements_by_user: {},
  drafts: {},
  current_user_id: null,
});

let state: MockState = initialState();
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw) as MockState;
      Object.values(state.users).forEach((user) => {
        if (typeof user.onboarding_completed !== "boolean") {
          user.onboarding_completed = user.interests.length > 0;
        }
      });
    }
  } catch {
    state = initialState();
  }
}

function save(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota? swallow */
  }
}

export function reset(): void {
  state = initialState();
  save();
}

export function getState(): MockState {
  load();
  return state;
}

export function commit(): void {
  save();
}

export function uuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---- Reading task content bank ----
//
// Verbatim Saturn passage from the design's data.jsx, plus a couple of
// alternates so different interest topics return different content.

export interface ReadingContent {
  topic: string;
  title: string;
  paragraphs: string[];
  questions: Array<{
    type: "multiple_choice" | "true_false" | "fill_blank";
    prompt: string;
    options?: string[];
    correct_index?: number;
    correct_strings?: string[];
    explanation: string;
  }>;
}

export const READING_BANK: Record<string, ReadingContent> = {
  space: {
    topic: "Space & Astronomy",
    title: "The Curious Case of Saturn's Rings",
    paragraphs: [
      "Saturn is famous for its bright, beautiful rings. From far away, the rings look solid, like a thin, flat dinner plate wrapped around the planet. But that's not what they really are.",
      "If you flew up close in a spaceship, you would see that Saturn's rings are made of billions of tiny pieces of ice and rock. Some are as small as grains of sand. Others are as big as houses, or even small mountains. They all spin around Saturn together, very fast.",
      "Scientists are still not sure how the rings got there. One idea is that a small moon got too close to Saturn and broke apart. Another idea is that the rings are leftover bits from when the planet first formed, billions of years ago.",
      "What is certain is that the rings are not going to last forever. Saturn's gravity is slowly pulling them in. In about 100 million years, they might disappear completely. Lucky for us, that's still a very long time to enjoy the view.",
    ],
    questions: [
      {
        type: "multiple_choice",
        prompt: "What are Saturn's rings actually made of?",
        options: [
          "A solid sheet of metal",
          "Billions of pieces of ice and rock",
          "Frozen clouds of gas",
          "A thin layer of dust",
        ],
        correct_index: 1,
        explanation:
          "The passage says the rings are made of billions of tiny pieces of ice and rock, some as small as sand and others as big as houses.",
      },
      {
        type: "true_false",
        prompt:
          "Some pieces in the rings are as big as houses or small mountains.",
        options: ["True", "False"],
        correct_index: 0,
        explanation:
          "The passage compares the largest pieces to houses, and even small mountains.",
      },
      {
        type: "multiple_choice",
        prompt:
          "According to the passage, which of these is one possible reason the rings exist?",
        options: [
          "A passing comet froze in orbit",
          "Aliens placed them there",
          "A small moon broke apart near Saturn",
          "The Sun shaped them with its heat",
        ],
        correct_index: 2,
        explanation:
          "One scientific idea mentioned is that a small moon got too close to Saturn and broke apart.",
      },
      {
        type: "fill_blank",
        prompt: "Saturn's gravity is slowly _______ the rings in.",
        correct_strings: ["pulling", "pulling in"],
        explanation:
          "The passage tells us Saturn's gravity is slowly pulling the rings in.",
      },
      {
        type: "multiple_choice",
        prompt: "About how long until the rings might disappear?",
        options: [
          "A few hundred years",
          "1 million years",
          "100 million years",
          "They will never disappear",
        ],
        correct_index: 2,
        explanation:
          "The passage says the rings might disappear completely in about 100 million years.",
      },
      {
        type: "true_false",
        prompt: "Scientists know exactly how Saturn's rings were formed.",
        options: ["True", "False"],
        correct_index: 1,
        explanation:
          "The passage clearly states scientists are still not sure how the rings got there.",
      },
    ],
  },
  animals: {
    topic: "Animals & Pets",
    title: "Octopus Minds",
    paragraphs: [
      "Octopuses are some of the smartest animals in the ocean. They have eight arms, three hearts, and a beak like a parrot. But the most amazing thing about an octopus is its brain — or rather, its many small brains.",
      "Most of an octopus's neurons are not in its head. They are spread out along its arms. That means each arm can think a little on its own. One arm might be opening a jar while another arm is reaching for a tasty crab.",
      "Octopuses can solve puzzles, remember faces, and even play. Scientists have watched them squirt water at lights they don't like and squeeze through holes barely bigger than their eyes.",
      "Sadly, octopuses do not live very long. Most kinds live only a year or two. But in that short time, they pack in a lot of curiosity — and a lot of trouble for the people who keep them in tanks.",
    ],
    questions: [
      {
        type: "multiple_choice",
        prompt: "Where are most of an octopus's neurons located?",
        options: [
          "In its head only",
          "In its arms",
          "In its three hearts",
          "Around its beak",
        ],
        correct_index: 1,
        explanation:
          "The passage says most neurons are spread out along the arms, so each arm can 'think a little on its own.'",
      },
      {
        type: "true_false",
        prompt: "An octopus has three hearts.",
        options: ["True", "False"],
        correct_index: 0,
        explanation: "Stated directly in the first paragraph.",
      },
      {
        type: "fill_blank",
        prompt: "Octopuses can squeeze through holes barely bigger than their _______.",
        correct_strings: ["eyes", "eye"],
        explanation: "The passage uses 'barely bigger than their eyes.'",
      },
      {
        type: "multiple_choice",
        prompt: "About how long do most octopuses live?",
        options: [
          "A few weeks",
          "A year or two",
          "Five to ten years",
          "Twenty years",
        ],
        correct_index: 1,
        explanation: "The passage says 'Most kinds live only a year or two.'",
      },
      {
        type: "true_false",
        prompt: "Octopuses cannot solve puzzles.",
        options: ["True", "False"],
        correct_index: 1,
        explanation:
          "The passage explicitly says octopuses CAN solve puzzles, remember faces, and play.",
      },
    ],
  },
  tech: {
    topic: "Tech & Gadgets",
    title: "A Brief History of the Keyboard",
    paragraphs: [
      "The keyboard you type on today started its life in the 1870s, on a noisy machine called the typewriter. Inventors needed a way to push metal arms onto an inked ribbon, one letter at a time, without the arms getting tangled up.",
      "Their fix was to spread out common letter pairs so the arms wouldn't crash into each other. That layout, called QWERTY, slowed typists down on purpose — and it has barely changed in 150 years.",
      "When computers arrived, designers tried newer layouts that put common letters under the strongest fingers. They were faster, but few people wanted to learn them. The familiar QWERTY won, even on phones and tablets that don't have any metal arms at all.",
      "Today, some keyboards have no keys at all. They project a glowing layout onto a desk and watch your fingers with a tiny camera. The shape of typing keeps changing — but the letters stay in the same place.",
    ],
    questions: [
      {
        type: "multiple_choice",
        prompt: "Why was the QWERTY layout designed?",
        options: [
          "To make typing as fast as possible",
          "To stop metal arms from tangling on typewriters",
          "To match the order of the alphabet",
          "To work better on phones",
        ],
        correct_index: 1,
        explanation:
          "The passage explains QWERTY spread out common letter pairs so the typewriter's metal arms wouldn't crash.",
      },
      {
        type: "true_false",
        prompt: "QWERTY was designed to make typists faster.",
        options: ["True", "False"],
        correct_index: 1,
        explanation:
          "The passage says QWERTY 'slowed typists down on purpose.'",
      },
      {
        type: "fill_blank",
        prompt: "QWERTY has barely changed in _______ years.",
        correct_strings: ["150"],
        explanation: "The passage states 'barely changed in 150 years.'",
      },
      {
        type: "multiple_choice",
        prompt: "What is one example of a modern keyboard from the passage?",
        options: [
          "A keyboard with extra-large keys",
          "A musical keyboard",
          "A keyboard that projects a glowing layout onto a desk",
          "A keyboard with no letters",
        ],
        correct_index: 2,
        explanation:
          "The last paragraph mentions keyboards that project a glowing layout onto a desk.",
      },
    ],
  },
};

// ---- Writing prompts ----

export interface WritingPromptContent {
  topic_id: string;
  topic_label: string;
  title: string;
  prompt: string;
  hints: string[];
  min_words: number;
  max_words: number;
}

export const WRITING_BANK: WritingPromptContent[] = [
  {
    topic_id: "travel",
    topic_label: "Travel & Cultures",
    title: "A Place You Would Love to Visit",
    prompt:
      "Write a short answer (60–120 words) describing a place you would love to visit one day. Include where it is, what you would do there, and why it matters to you.",
    hints: [
      "Mention the place by name",
      "Use at least two adjectives",
      "End with a personal reason",
    ],
    min_words: 60,
    max_words: 120,
  },
  {
    topic_id: "food",
    topic_label: "Food & Cooking",
    title: "My Favorite Meal",
    prompt:
      "In 60–120 words, describe your favorite meal. Tell us who makes it, what's in it, and a memory connected to it.",
    hints: [
      "Use sense words: smell, taste, sound",
      "Mention at least one ingredient",
      "End with a feeling or memory",
    ],
    min_words: 60,
    max_words: 120,
  },
  {
    topic_id: "books",
    topic_label: "Books & Stories",
    title: "A Story I Couldn't Put Down",
    prompt:
      "In 60–120 words, write about a story (book or movie) that you couldn't stop thinking about. Don't spoil the ending — focus on what hooked you.",
    hints: [
      "Name the title and the author or director",
      "Pick one specific scene to describe",
      "Say what feeling it left you with",
    ],
    min_words: 60,
    max_words: 120,
  },
];

// ---- Sample writing evaluation (for the demo's deterministic 'completed' state)

export const SAMPLE_WRITING_EVALUATION: WritingEvaluation = {
  score_overall: 84,
  score_grammar: 78,
  score_vocabulary: 88,
  score_structure: 90,
  score_relevance: 82,
  feedback_summary:
    "Your structure and topic relevance are great. Watch one verb tense (\"told\" → \"used to tell\") and a small word-order tweak — fix those, and you're at a 90+.",
  feedback_detail: [
    "You picked a vivid place and gave a clear personal reason at the end — that's the strongest part of your answer. Your verbs are mostly in the right tense, but watch \"my grandmother always told me\": when you mean a habit in the past, \"used to tell\" reads more naturally.",
    "Try replacing one or two general words (\"old\", \"small\") with more specific ones next time.",
  ],
  focus_next: [
    "Past tense for habits",
    "Adjective variety",
    "Sentence opener variety",
  ],
  highlights: [
    {
      start: 17,
      end: 47,
      kind: "suggestion",
      message: "Suggestion: try 'the ancient capital'",
    },
    {
      start: 96,
      end: 116,
      kind: "grammar",
      message: "Word order: consider 'in the early morning'",
    },
    {
      start: 195,
      end: 207,
      kind: "word_choice",
      message: "Vocabulary: consider 'a sweet mochi cake'",
    },
    {
      start: 276,
      end: 296,
      kind: "grammar",
      message: "Grammar: try 'used to tell me'",
    },
  ],
};
