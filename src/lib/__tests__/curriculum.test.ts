import { describe, expect, it } from "vitest";
import {
  CURRICULUM,
  CURRICULUM_LEVELS,
  describeUnitForPrompt,
  getNextUnit,
  getUnitById,
  getUnitsForLevel,
  isCurriculumUnitId,
  isLevelComplete,
  isUnitUnlocked,
} from "../curriculum";

describe("curriculum", () => {
  it("has 6 ordered units for every level with unique, prefixed ids", () => {
    expect(CURRICULUM_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const level of CURRICULUM_LEVELS) {
      const units = getUnitsForLevel(level);
      expect(units).toHaveLength(6);
      expect(units.map((unit) => unit.order)).toEqual([1, 2, 3, 4, 5, 6]);
      for (const unit of units) {
        expect(unit.id.startsWith(`l${level}-`)).toBe(true);
        expect(unit.title && unit.emoji && unit.goal && unit.vocabularyDomain && unit.grammarFocus).toBeTruthy();
      }
    }

    const ids = CURRICULUM.map((unit) => unit.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });

  it("starts with greetings and looks units up by id", () => {
    expect(getUnitsForLevel(1)[0].id).toBe("l1-greetings");
    expect(getUnitById("l1-numbers")?.level).toBe(1);
    expect(getUnitById("nope")).toBeNull();
    expect(isCurriculumUnitId("l5-work")).toBe(true);
    expect(isCurriculumUnitId("l5-nope")).toBe(false);
    expect(getUnitsForLevel(42)).toEqual(getUnitsForLevel(10));
  });

  it("finds the next unit and level completion", () => {
    const level1 = getUnitsForLevel(1).map((unit) => unit.id);
    expect(getNextUnit(1, [])?.id).toBe(level1[0]);
    expect(getNextUnit(1, [level1[0], level1[1]])?.id).toBe(level1[2]);
    // Gaps are filled first.
    expect(getNextUnit(1, [level1[0], level1[2]])?.id).toBe(level1[1]);
    expect(getNextUnit(1, new Set(level1))).toBeNull();
    expect(isLevelComplete(1, level1)).toBe(true);
    expect(isLevelComplete(1, level1.slice(1))).toBe(false);
    // Units from other levels don't count.
    expect(isLevelComplete(2, level1)).toBe(false);
  });

  it("unlocks units sequentially", () => {
    const [first, second, third] = getUnitsForLevel(2).map((unit) => unit.id);
    expect(isUnitUnlocked(first, [])).toBe(true);
    expect(isUnitUnlocked(second, [])).toBe(false);
    expect(isUnitUnlocked(second, [first])).toBe(true);
    expect(isUnitUnlocked(third, [first])).toBe(false);
    expect(isUnitUnlocked("missing", [])).toBe(false);
  });

  it("describes a unit for prompts", () => {
    const text = describeUnitForPrompt(getUnitById("l1-cafe")!);
    expect(text).toContain("At the Café");
    expect(text).toContain("Grammar focus");
  });
});
