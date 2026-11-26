import { describe, expect, it } from "vitest";
import {
  clampLevel,
  describeLevelForPrompt,
  formatLevelLabel,
  getCefrBand,
  getLevelInfo,
  isMaxLevel,
  isValidLevel,
  LEVELS,
  ONBOARDING_PROFICIENCY_OPTIONS,
  onboardingChoiceToLevel,
} from "../levels";

describe("levels", () => {
  it("defines levels 1-10 with non-decreasing CEFR bands", () => {
    expect(LEVELS.map((level) => level.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const bands = LEVELS.map((level) => order.indexOf(level.cefr));
    expect(bands).toEqual([...bands].sort((a, b) => a - b));
    expect(getCefrBand(1)).toBe("A1");
    expect(getCefrBand(10)).toBe("C2");
    expect(new Set(LEVELS.map((level) => level.label)).size).toBe(10);
  });

  it("clamps and validates", () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(11)).toBe(10);
    expect(clampLevel("4")).toBe(4);
    expect(clampLevel(3.6)).toBe(4);
    expect(clampLevel(Number.NaN)).toBe(1);
    expect(clampLevel(undefined)).toBe(1);
    expect(isValidLevel(5)).toBe(true);
    expect(isValidLevel(5.5)).toBe(false);
    expect(isValidLevel("5")).toBe(false);
    expect(getLevelInfo(99).level).toBe(10);
    expect(isMaxLevel(10)).toBe(true);
    expect(isMaxLevel(9)).toBe(false);
  });

  it("formats labels and prompt descriptions", () => {
    expect(formatLevelLabel(3)).toBe("Level 3 · A2 Elementary");
    expect(describeLevelForPrompt(1)).toContain("Level 1/10");
    expect(describeLevelForPrompt(1)).toContain("A1");
  });

  it("maps the five onboarding choices to 1,3,5,7,9", () => {
    expect(ONBOARDING_PROFICIENCY_OPTIONS.map((option) => option.level)).toEqual([1, 3, 5, 7, 9]);
    expect(["1", "2", "3", "4", "5"].map(onboardingChoiceToLevel)).toEqual([1, 3, 5, 7, 9]);
    expect(onboardingChoiceToLevel(4)).toBe(7);
    expect(onboardingChoiceToLevel("9")).toBe(1);
    expect(onboardingChoiceToLevel(null)).toBe(1);
  });
});
