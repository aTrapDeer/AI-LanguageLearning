/**
 * The one proficiency scale used everywhere: integer levels 1–10, each mapped to a CEFR band.
 * Pure module, safe for server and client.
 */

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;

export type CefrBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface LevelInfo {
  level: number;
  cefr: CefrBand;
  /** Learner-facing name, e.g. "Elementary". */
  label: string;
  /** What a learner at this level can do; written for use inside generation prompts. */
  promptDescription: string;
}

export const LEVELS: readonly LevelInfo[] = [
  {
    level: 1,
    cefr: "A1",
    label: "First Steps",
    promptDescription:
      "Absolute beginner (CEFR A1, early). Knows a handful of words. Can greet, say their name and use single words or memorised phrases. Use very short sentences (3–5 words), present tense only, the most frequent vocabulary, and always give English support.",
  },
  {
    level: 2,
    cefr: "A1",
    label: "Beginner",
    promptDescription:
      "Beginner (CEFR A1). Can introduce themselves, ask and answer simple personal questions, count and name everyday objects. Use short present-tense sentences (4–6 words), high-frequency vocabulary and familiar contexts.",
  },
  {
    level: 3,
    cefr: "A2",
    label: "Elementary",
    promptDescription:
      "Elementary (CEFR A2, early). Can handle routine exchanges about family, food, shopping and directions. Use simple sentences (5–8 words), present tense plus a first past or future form, and common connectors like 'and', 'but', 'because'.",
  },
  {
    level: 4,
    cefr: "A2",
    label: "Pre-Intermediate",
    promptDescription:
      "Pre-intermediate (CEFR A2). Can describe their day, past events and plans in simple terms and get by while travelling. Use sentences of 6–9 words, past and future forms, comparatives and everyday idioms sparingly.",
  },
  {
    level: 5,
    cefr: "B1",
    label: "Intermediate",
    promptDescription:
      "Intermediate (CEFR B1, early). Can talk about experiences, opinions and familiar topics with some fluency and connect ideas. Use 7–11 word sentences, multiple tenses, subordinate clauses and a broader vocabulary; minimise English support.",
  },
  {
    level: 6,
    cefr: "B1",
    label: "Intermediate Plus",
    promptDescription:
      "Intermediate (CEFR B1). Can deal with most situations while travelling, give reasons and explanations, and narrate stories. Use natural 8–12 word sentences, conditionals, relative clauses and common idiomatic expressions.",
  },
  {
    level: 7,
    cefr: "B2",
    label: "Upper Intermediate",
    promptDescription:
      "Upper intermediate (CEFR B2, early). Can discuss work, news and abstract topics, argue a viewpoint and understand the main ideas of complex text. Use varied sentence structures, passive voice, nuanced connectors and topic-specific vocabulary.",
  },
  {
    level: 8,
    cefr: "B2",
    label: "Confident",
    promptDescription:
      "Upper intermediate (CEFR B2). Interacts fluently and spontaneously with native speakers on a wide range of subjects. Use natural, native-like phrasing, register shifts (formal vs. informal), idioms and precise vocabulary.",
  },
  {
    level: 9,
    cefr: "C1",
    label: "Advanced",
    promptDescription:
      "Advanced (CEFR C1). Expresses ideas fluently and precisely, understands implicit meaning and uses language flexibly for social, academic and professional purposes. Use complex syntax, rich idiomatic and figurative language and subtle register.",
  },
  {
    level: 10,
    cefr: "C2",
    label: "Mastery",
    promptDescription:
      "Mastery (CEFR C2). Understands virtually everything and expresses themselves spontaneously with fine shades of meaning. Use fully native material: wordplay, cultural references, literary and specialised registers.",
  },
];

export function isValidLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_LEVEL && value <= MAX_LEVEL;
}

/** Coerces anything (string, float, NaN, out-of-range) to a valid integer level; defaults to 1. */
export function clampLevel(value: unknown): number {
  const numeric = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(numeric)) {
    return MIN_LEVEL;
  }

  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(numeric)));
}

export function getLevelInfo(level: number): LevelInfo {
  return LEVELS[clampLevel(level) - 1];
}

export function getCefrBand(level: number): CefrBand {
  return getLevelInfo(level).cefr;
}

/** "Level 3 · A2 Elementary" */
export function formatLevelLabel(level: number): string {
  const info = getLevelInfo(level);
  return `Level ${info.level} · ${info.cefr} ${info.label}`;
}

export function describeLevelForPrompt(level: number): string {
  const info = getLevelInfo(level);
  return `Level ${info.level}/10 — ${info.promptDescription}`;
}

export function isMaxLevel(level: number): boolean {
  return clampLevel(level) >= MAX_LEVEL;
}

/** The five self-assessment choices shown during onboarding, each mapped onto the 1–10 scale. */
export const ONBOARDING_PROFICIENCY_OPTIONS = [
  { choice: "1", level: 1, label: "Just Starting", description: "Know little to nothing" },
  { choice: "2", level: 3, label: "Beginner", description: "Understand some basics" },
  { choice: "3", level: 5, label: "Intermediate", description: "Can hold basic conversations" },
  { choice: "4", level: 7, label: "Advanced", description: "Comfortable but not yet fluent" },
  { choice: "5", level: 9, label: "Fluent", description: "Can handle complex conversations" },
] as const;

export type OnboardingProficiencyChoice = (typeof ONBOARDING_PROFICIENCY_OPTIONS)[number]["choice"];

/** Maps an onboarding choice ("1".."5" or 1..5) to a 1–10 level. Unknown input maps to level 1. */
export function onboardingChoiceToLevel(choice: string | number | null | undefined): number {
  const key = String(choice ?? "").trim();
  return ONBOARDING_PROFICIENCY_OPTIONS.find((option) => option.choice === key)?.level ?? MIN_LEVEL;
}
