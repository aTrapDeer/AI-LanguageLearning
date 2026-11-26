import { describe, expect, it } from "vitest";
import { getUnitsForLevel } from "../curriculum";
import {
  computeAccuracy,
  computeStreak,
  dailyGoalProgress,
  DEFAULT_DAILY_XP_GOAL,
  didReachGoal,
  getLevelProgress,
  isActivityKind,
  starsForAccuracy,
  xpForChatTurns,
  xpForFlashcards,
  xpForLesson,
  xpForReviewSession,
  xpForVoiceSession,
} from "../gamification";

describe("stars and XP", () => {
  it("awards stars by accuracy", () => {
    expect(starsForAccuracy(1)).toBe(3);
    expect(starsForAccuracy(0.95)).toBe(3);
    expect(starsForAccuracy(0.94)).toBe(2);
    expect(starsForAccuracy(0.8)).toBe(2);
    expect(starsForAccuracy(0.5)).toBe(1);
    expect(starsForAccuracy(0.49)).toBe(0);
    expect(starsForAccuracy(Number.NaN)).toBe(0);
  });

  it("computes accuracy safely", () => {
    expect(computeAccuracy(8, 10)).toBe(0.8);
    expect(computeAccuracy(5, 0)).toBe(0);
    expect(computeAccuracy(12, 10)).toBe(1);
  });

  it("gives more XP for first passes and more stars", () => {
    expect(xpForLesson({ stars: 3, isFirstPass: true })).toBe(25);
    expect(xpForLesson({ stars: 1, isFirstPass: true })).toBe(15);
    expect(xpForLesson({ stars: 3, isFirstPass: false })).toBe(13);
    expect(xpForLesson({ stars: 0, isFirstPass: false })).toBe(5);
    expect(xpForLesson({ stars: 9, isFirstPass: true })).toBe(25);
  });

  it("computes XP for other activities", () => {
    expect(xpForReviewSession({ reviewed: 10, correct: 7 })).toBe(7 * 2 + 3 + 5);
    expect(xpForReviewSession({ reviewed: 3, correct: 3 })).toBe(6);
    expect(xpForReviewSession({ reviewed: 2, correct: 5 })).toBe(4);
    expect(xpForChatTurns(4)).toBe(8);
    expect(xpForVoiceSession(3)).toBe(9);
    expect(xpForVoiceSession(100)).toBe(30);
    expect(xpForFlashcards(-3)).toBe(0);
    expect(isActivityKind("lesson")).toBe(true);
    expect(isActivityKind("travel")).toBe(false);
  });
});

describe("computeStreak", () => {
  const today = "2026-05-10";

  it("is empty with no activity", () => {
    expect(computeStreak([], today)).toEqual({ current: 0, longest: 0, todayDone: false, atRisk: false, lastActiveDate: null });
  });

  it("counts a run ending today", () => {
    const streak = computeStreak(["2026-05-08", "2026-05-09", "2026-05-10"], today);
    expect(streak).toMatchObject({ current: 3, longest: 3, todayDone: true, atRisk: false });
  });

  it("keeps a streak alive but at risk when only yesterday is done", () => {
    const streak = computeStreak(["2026-05-07", "2026-05-08", "2026-05-09"], today);
    expect(streak).toMatchObject({ current: 3, todayDone: false, atRisk: true, lastActiveDate: "2026-05-09" });
  });

  it("breaks after a missed day and remembers the longest run", () => {
    const streak = computeStreak(
      ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-05-08", "2026-05-08"],
      today
    );
    expect(streak).toMatchObject({ current: 0, longest: 4, todayDone: false, atRisk: false });
  });

  it("ignores invalid and future dates, and handles unsorted input across months", () => {
    const streak = computeStreak(["2026-05-01", "bogus", "2026-04-30", "2026-05-11", "2026-04-29"], "2026-05-01");
    expect(streak).toMatchObject({ current: 3, longest: 3, todayDone: true });
  });
});

describe("daily goal", () => {
  it("reports progress and the crossing moment", () => {
    expect(dailyGoalProgress(15, 30)).toEqual({ xp: 15, goal: 30, ratio: 0.5, reached: false });
    expect(dailyGoalProgress(45, 30).ratio).toBe(1);
    expect(dailyGoalProgress(10, 0).goal).toBe(DEFAULT_DAILY_XP_GOAL);
    expect(didReachGoal(20, 30, 30)).toBe(true);
    expect(didReachGoal(30, 40, 30)).toBe(false);
    expect(didReachGoal(10, 20, 30)).toBe(false);
  });
});

describe("getLevelProgress", () => {
  it("counts only the current level's units", () => {
    const level1 = getUnitsForLevel(1).map((unit) => unit.id);
    const level2 = getUnitsForLevel(2).map((unit) => unit.id);

    const partial = getLevelProgress(1, [level1[0], level1[1], level2[0]]);
    expect(partial).toMatchObject({ level: 1, completed: 2, total: 6, isComplete: false, canAdvance: false });
    expect(partial.nextUnit?.id).toBe(level1[2]);
    expect(partial.ratio).toBeCloseTo(2 / 6);

    const done = getLevelProgress(1, level1);
    expect(done).toMatchObject({ isComplete: true, canAdvance: true, nextUnit: null });

    const top = getLevelProgress(10, getUnitsForLevel(10).map((unit) => unit.id));
    expect(top).toMatchObject({ isComplete: true, canAdvance: false });
  });
});
