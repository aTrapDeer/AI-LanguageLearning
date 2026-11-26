/**
 * XP, stars, streaks and level progress. Pure; server code persists the results.
 *
 * XP is a cumulative score that only ever goes up. It does NOT drive levels: a learner moves up a
 * level by completing every unit of their current level with at least one star.
 */

import { getNextUnit, getUnitsForLevel, type CurriculumUnit } from "./curriculum";
import { clampLevel, isMaxLevel } from "./levels";
import { addDays, diffDays, isValidLocalDate } from "./local-date";

export const ACTIVITY_KINDS = ["lesson", "review", "chat", "voice", "flashcards"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === "string" && (ACTIVITY_KINDS as readonly string[]).includes(value);
}

export const XP_REWARDS = {
  lessonBase: 10,
  lessonPerStar: 5,
  /** Replaying an already-passed unit earns this fraction of the normal reward. */
  lessonReplayMultiplier: 0.5,
  reviewCorrect: 2,
  reviewIncorrect: 1,
  /** Bonus for finishing a review session of at least `reviewSessionMinItems` items. */
  reviewSessionBonus: 5,
  reviewSessionMinItems: 5,
  chatTurn: 2,
  voicePerMinute: 3,
  voiceSessionMax: 30,
  flashcardCorrect: 1,
} as const;

export const DEFAULT_DAILY_XP_GOAL = 30;
export const DAILY_XP_GOAL_OPTIONS = [10, 20, 30, 50] as const;
export const MAX_STARS = 3;

/** 0 stars (<50%) means "not passed yet"; the unit does not count towards levelling up. */
export function starsForAccuracy(accuracy: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(accuracy)) {
    return 0;
  }

  if (accuracy >= 0.95) return 3;
  if (accuracy >= 0.8) return 2;
  if (accuracy >= 0.5) return 1;
  return 0;
}

/** `correct / total`, clamped to 0..1; 0 when there was nothing to score. */
export function computeAccuracy(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, correct / total));
}

export function xpForLesson({ stars, isFirstPass }: { stars: number; isFirstPass: boolean }): number {
  const safeStars = Math.min(MAX_STARS, Math.max(0, Math.floor(stars)));
  const base = XP_REWARDS.lessonBase + XP_REWARDS.lessonPerStar * safeStars;
  return Math.round(isFirstPass ? base : base * XP_REWARDS.lessonReplayMultiplier);
}

export function xpForReviewSession({ reviewed, correct }: { reviewed: number; correct: number }): number {
  const total = Math.max(0, Math.floor(reviewed));
  const right = Math.min(total, Math.max(0, Math.floor(correct)));
  const bonus = total >= XP_REWARDS.reviewSessionMinItems ? XP_REWARDS.reviewSessionBonus : 0;
  return right * XP_REWARDS.reviewCorrect + (total - right) * XP_REWARDS.reviewIncorrect + bonus;
}

export function xpForChatTurns(turns: number): number {
  return Math.max(0, Math.floor(turns)) * XP_REWARDS.chatTurn;
}

export function xpForVoiceSession(minutes: number): number {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return Math.min(XP_REWARDS.voiceSessionMax, Math.round(safeMinutes * XP_REWARDS.voicePerMinute));
}

export function xpForFlashcards(correct: number): number {
  return Math.max(0, Math.floor(correct)) * XP_REWARDS.flashcardCorrect;
}

export interface StreakInfo {
  /** Consecutive active days ending today, or ending yesterday if today is not done yet. */
  current: number;
  longest: number;
  todayDone: boolean;
  /** There is a live streak that will be lost unless the learner is active today. */
  atRisk: boolean;
  lastActiveDate: string | null;
}

/** `activeDates` are `YYYY-MM-DD` local dates with any activity; order and duplicates don't matter. */
export function computeStreak(activeDates: Iterable<string>, today: string): StreakInfo {
  const unique = Array.from(new Set(Array.from(activeDates).filter(isValidLocalDate)))
    .filter((date) => diffDays(date, today) <= 0)
    .sort();

  if (unique.length === 0) {
    return { current: 0, longest: 0, todayDone: false, atRisk: false, lastActiveDate: null };
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    run = diffDays(unique[index], unique[index - 1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const dateSet = new Set(unique);
  const todayDone = dateSet.has(today);
  const anchor = todayDone ? today : addDays(today, -1);

  let current = 0;
  for (let cursor = anchor; dateSet.has(cursor); cursor = addDays(cursor, -1)) {
    current += 1;
  }

  return {
    current,
    longest: Math.max(longest, current),
    todayDone,
    atRisk: !todayDone && current > 0,
    lastActiveDate: unique[unique.length - 1],
  };
}

export interface DailyGoalProgress {
  xp: number;
  goal: number;
  /** 0..1 */
  ratio: number;
  reached: boolean;
}

export function dailyGoalProgress(dailyXp: number, goal: number = DEFAULT_DAILY_XP_GOAL): DailyGoalProgress {
  const safeGoal = Number.isFinite(goal) && goal > 0 ? Math.round(goal) : DEFAULT_DAILY_XP_GOAL;
  const xp = Math.max(0, Math.round(Number.isFinite(dailyXp) ? dailyXp : 0));
  return { xp, goal: safeGoal, ratio: Math.min(1, xp / safeGoal), reached: xp >= safeGoal };
}

/** True when this XP gain is the one that crossed the daily goal. */
export function didReachGoal(previousDailyXp: number, newDailyXp: number, goal: number): boolean {
  return previousDailyXp < goal && newDailyXp >= goal;
}

export interface LevelProgress {
  level: number;
  completedUnitIds: string[];
  completed: number;
  total: number;
  /** 0..1 */
  ratio: number;
  isComplete: boolean;
  /** The learner can move to the next level (level complete and not already at the top). */
  canAdvance: boolean;
  nextUnit: CurriculumUnit | null;
}

/** `passedUnitIds` may include units from other levels; only the current level's are counted. */
export function getLevelProgress(level: number, passedUnitIds: Iterable<string>): LevelProgress {
  const normalized = clampLevel(level);
  const passed = new Set(passedUnitIds);
  const units = getUnitsForLevel(normalized);
  const completedUnitIds = units.filter((unit) => passed.has(unit.id)).map((unit) => unit.id);
  const isComplete = completedUnitIds.length === units.length;

  return {
    level: normalized,
    completedUnitIds,
    completed: completedUnitIds.length,
    total: units.length,
    ratio: units.length === 0 ? 0 : completedUnitIds.length / units.length,
    isComplete,
    canAdvance: isComplete && !isMaxLevel(normalized),
    nextUnit: getNextUnit(normalized, passed),
  };
}
