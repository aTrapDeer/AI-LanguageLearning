import { clampLevel } from "../levels";
import { asNumber, asRequiredString, execute, getFirstRow, nowIso, type DbRow } from "./client";

export interface DatabaseProgress {
  id: string;
  userId: string;
  language: string;
  level: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
}

export function mapProgress(row: DbRow): DatabaseProgress {
  return {
    id: asRequiredString(row.id, "progress.id"),
    userId: asRequiredString(row.user_id, "progress.user_id"),
    language: asRequiredString(row.language, "progress.language"),
    level: clampLevel(asNumber(row.level, 1)),
    xp: asNumber(row.xp, 0),
    createdAt: asRequiredString(row.created_at, "progress.created_at"),
    updatedAt: asRequiredString(row.updated_at, "progress.updated_at"),
  };
}

export async function getProgress(userId: string, language: string) {
  const row = await getFirstRow(
    "SELECT * FROM progress WHERE user_id = ? AND language = ? LIMIT 1",
    [userId, language]
  );

  return row ? mapProgress(row) : null;
}


/**
 * Manually sets a learner's level for a language they already study. XP is untouched.
 * Returns null when the learner has no progress row for that language.
 */
export async function setLearnerLevel(userId: string, language: string, level: number): Promise<DatabaseProgress | null> {
  const result = await execute(
    "UPDATE progress SET level = ?, updated_at = ? WHERE user_id = ? AND language = ?",
    [clampLevel(level), nowIso(), userId, language]
  );

  return result.rowsAffected > 0 ? getProgress(userId, language) : null;
}
