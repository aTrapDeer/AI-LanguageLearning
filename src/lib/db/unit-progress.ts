import { getLevelProgress } from "../gamification";
import { MAX_LEVEL } from "../levels";
import { asNumber, execute, getRows, nowIso } from "./client";
import { getProgress } from "./progress";

export interface UnitProgress {
  /** Units with at least one completed attempt earning ≥1 star ("passed"). */
  completedUnitIds: string[];
  /** Best stars per unit id over all completed attempts (0–3). Includes 0-star completions. */
  bestStars: Record<string, number>;
}

export async function getUnitProgress(userId: string, language: string): Promise<UnitProgress> {
  const rows = await getRows(
    `SELECT unit_id, MAX(stars) AS best_stars
      FROM lesson_attempts
      WHERE user_id = ? AND language = ? AND status = 'completed'
      GROUP BY unit_id`,
    [userId, language]
  );

  const bestStars: Record<string, number> = {};
  for (const row of rows) {
    bestStars[String(row.unit_id)] = asNumber(row.best_stars, 0);
  }

  return {
    completedUnitIds: Object.keys(bestStars).filter((unitId) => bestStars[unitId] >= 1),
    bestStars,
  };
}

export interface LevelUpResult {
  leveledUp: boolean;
  previousLevel: number;
  level: number;
}

/**
 * Moves the learner up while every unit of their current level is passed (≥1 star).
 * Uses a compare-and-set on the level so concurrent completions cannot skip a level twice.
 */
export async function advanceLevelIfEligible(userId: string, language: string): Promise<LevelUpResult> {
  const progress = await getProgress(userId, language);
  if (!progress) {
    return { leveledUp: false, previousLevel: 1, level: 1 };
  }

  const { completedUnitIds } = await getUnitProgress(userId, language);
  const previousLevel = progress.level;
  let level = previousLevel;

  while (level < MAX_LEVEL && getLevelProgress(level, completedUnitIds).canAdvance) {
    const result = await execute(
      "UPDATE progress SET level = ?, updated_at = ? WHERE user_id = ? AND language = ? AND level = ?",
      [level + 1, nowIso(), userId, language, level]
    );

    if (result.rowsAffected === 0) {
      break;
    }

    level += 1;
  }

  return { leveledUp: level > previousLevel, previousLevel, level };
}
