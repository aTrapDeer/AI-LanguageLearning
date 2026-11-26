import { getUnitById, getNextUnit, getUnitsForLevel, type CurriculumUnit } from "@/lib/curriculum";
import { getProgress, listRecentMistakes, listRecentVocabulary, listWeakestVocabulary } from "@/lib/database";
import { getUnitProgress } from "@/lib/db/unit-progress";
import type { TutorMistake, TutorWord } from "./prompt";

/** Server-only: everything the tutor prompts need about one learner and language. */
export interface LearnerTutorContext {
  level: number;
  /** The learner's next unit at their level (falls back to the level's first unit). */
  currentUnit: CurriculumUnit | null;
  weakWords: TutorWord[];
  recentWords: TutorWord[];
  recentMistakes: TutorMistake[];
}

export async function loadLearnerTutorContext(userId: string, language: string): Promise<LearnerTutorContext> {
  const [progress, unitProgress, weak, recent, mistakes] = await Promise.all([
    getProgress(userId, language),
    getUnitProgress(userId, language),
    listWeakestVocabulary(userId, language, 8),
    listRecentVocabulary(userId, language, 8),
    listRecentMistakes({ userId, language, limit: 6 }),
  ]);

  const level = progress?.level ?? 1;
  const currentUnit = getNextUnit(level, unitProgress.completedUnitIds) ?? getUnitsForLevel(level).at(-1) ?? null;
  const weakKeys = new Set(weak.map((item) => item.word));

  return {
    level,
    currentUnit,
    weakWords: weak.map((item) => ({ word: item.word, translation: item.translation })),
    recentWords: recent
      .filter((item) => !weakKeys.has(item.word))
      .map((item) => ({ word: item.word, translation: item.translation })),
    recentMistakes: mistakes.map((mistake) => ({
      incorrect: mistake.incorrect,
      correction: mistake.correction,
      explanation: mistake.explanation,
    })),
  };
}

/** A requested unit id if it exists, else the learner's current unit. */
export function resolveUnit(requested: unknown, context: LearnerTutorContext): CurriculumUnit | null {
  if (typeof requested === "string" && requested) {
    const unit = getUnitById(requested);
    if (unit) {
      return unit;
    }
  }

  return context.currentUnit;
}
