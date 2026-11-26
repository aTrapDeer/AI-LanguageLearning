/** Session scoring and celebration rules. Pure and client-safe. */

import { computeAccuracy, xpForReviewSession } from "../gamification";
import type { ReviewGrade } from "../srs";

export interface SessionScore {
  reviewed: number;
  correct: number;
  accuracy: number;
  xp: number;
}

/**
 * Scores a session from the first grade each served card received. Only the first grade counts, so
 * re-grading a card after "again" never adds XP.
 */
export function scoreSession(firstGrades: ReadonlyArray<ReviewGrade | null | undefined>): SessionScore {
  const graded = firstGrades.filter((grade): grade is ReviewGrade => Boolean(grade));
  const reviewed = graded.length;
  const correct = graded.filter((grade) => grade !== "again").length;
  return { reviewed, correct, accuracy: computeAccuracy(correct, reviewed), xp: xpForReviewSession({ reviewed, correct }) };
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365, 500, 1000] as const;

/** The milestone reached exactly at `streak` days, or null. */
export function streakMilestone(streak: number): number | null {
  return (STREAK_MILESTONES as readonly number[]).includes(streak) ? streak : null;
}

/** Next milestone above `streak` (for "3 days to your 7-day badge"), or null past the last one. */
export function nextStreakMilestone(streak: number): number | null {
  return STREAK_MILESTONES.find((milestone) => milestone > streak) ?? null;
}
