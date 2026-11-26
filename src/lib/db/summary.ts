import { getUnitsForLevel, type CurriculumUnit } from "../curriculum";
import { dailyGoalProgress, getLevelProgress, type StreakInfo } from "../gamification";
import { getSupportedLanguageName } from "../language-config";
import { clampLevel, getLevelInfo, isMaxLevel, type CefrBand } from "../levels";
import { resolveLocalDate } from "../local-date";
import { getDailyXp, getDailyXpGoal, getStreak } from "./activity";
import { getProgress } from "./progress";
import { getUnitProgress } from "./unit-progress";
import { countDueVocabulary, countVocabularyByMaturity, type VocabularyCounts } from "./vocabulary";

export interface LearnerSummaryUnit extends CurriculumUnit {
  /** Best stars earned on this unit (0 if never completed). */
  stars: number;
  completed: boolean;
  /** First unit, or the previous unit has been passed. */
  unlocked: boolean;
}

/** Everything the dashboard/header needs for one learner and language. JSON-serialisable. */
export interface LearnerSummary {
  language: string;
  languageName: string;
  /** False when the learner has not set this language up yet (no progress row); values are defaults. */
  hasProgress: boolean;
  level: number;
  cefr: CefrBand;
  levelLabel: string;
  isMaxLevel: boolean;
  totalXp: number;
  streak: StreakInfo;
  today: {
    localDate: string;
    xp: number;
    goal: number;
    /** 0..1 */
    ratio: number;
    goalReached: boolean;
  };
  review: {
    dueCount: number;
  };
  vocabulary: VocabularyCounts;
  levelProgress: {
    completedUnitIds: string[];
    completed: number;
    total: number;
    /** 0..1 */
    ratio: number;
    isComplete: boolean;
  };
  /** The current level's units in order, with the learner's stars. */
  units: LearnerSummaryUnit[];
  /** Next unit to study in the current level; null when the level is finished. */
  nextUnit: CurriculumUnit | null;
}

export async function getLearnerSummary(params: {
  userId: string;
  language: string;
  /** Client local date; validated server-side. */
  localDate?: string | null;
  now?: Date;
}): Promise<LearnerSummary> {
  const now = params.now ?? new Date();
  const localDate = resolveLocalDate(params.localDate, now);
  const { userId, language } = params;

  const [progress, unitProgress, streak, dailyXp, dailyGoal, dueCount, vocabulary] = await Promise.all([
    getProgress(userId, language),
    getUnitProgress(userId, language),
    getStreak(userId, localDate),
    getDailyXp(userId, localDate),
    getDailyXpGoal(userId),
    countDueVocabulary(userId, language, now),
    countVocabularyByMaturity(userId, language),
  ]);

  const level = clampLevel(progress?.level ?? 1);
  const info = getLevelInfo(level);
  const levelProgress = getLevelProgress(level, unitProgress.completedUnitIds);
  const goal = dailyGoalProgress(dailyXp, dailyGoal);
  const passed = new Set(unitProgress.completedUnitIds);

  const units = getUnitsForLevel(level).map((unit, index, all) => ({
    ...unit,
    stars: unitProgress.bestStars[unit.id] ?? 0,
    completed: passed.has(unit.id),
    unlocked: index === 0 || passed.has(all[index - 1].id),
  }));

  return {
    language,
    languageName: getSupportedLanguageName(language),
    hasProgress: Boolean(progress),
    level,
    cefr: info.cefr,
    levelLabel: info.label,
    isMaxLevel: isMaxLevel(level),
    totalXp: progress?.xp ?? 0,
    streak,
    today: { localDate, xp: goal.xp, goal: goal.goal, ratio: goal.ratio, goalReached: goal.reached },
    review: { dueCount },
    vocabulary,
    levelProgress: {
      completedUnitIds: levelProgress.completedUnitIds,
      completed: levelProgress.completed,
      total: levelProgress.total,
      ratio: levelProgress.ratio,
      isComplete: levelProgress.isComplete,
    },
    units,
    nextUnit: levelProgress.nextUnit,
  };
}
