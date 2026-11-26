import { asNumber, execute, getFirstRow, getRows, nowIso, parseJson, toJson } from "@/lib/db/client";
import { getLessonById, type StoredLesson } from "@/lib/db/lessons";

/** Lesson queries the shared data layer does not have. Server-only. */

/** Any pooled lesson for the unit (including ones the learner already finished), for replay fallbacks. */
export async function findAnyLessonForUnit<TContent = unknown>(params: {
  language: string;
  unitId: string;
  minContentVersion: number;
}): Promise<StoredLesson<TContent> | null> {
  const row = await getFirstRow(
    `SELECT id FROM lessons WHERE language = ? AND unit_id = ? AND content_version >= ? ORDER BY RANDOM() LIMIT 1`,
    [params.language, params.unitId, params.minContentVersion]
  );
  return row ? getLessonById<TContent>(String(row.id)) : null;
}

/** Unfinished attempts per unit for a language, with how far along they are (0..1). */
export async function listInProgressUnits(userId: string, language: string): Promise<Record<string, number>> {
  const rows = await getRows(
    `SELECT unit_id, state FROM lesson_attempts
      WHERE user_id = ? AND language = ? AND status = 'in_progress'
      ORDER BY updated_at ASC`,
    [userId, language]
  );

  const result: Record<string, number> = {};
  for (const row of rows) {
    const state = parseJson<{ progress?: { done?: unknown; queue?: unknown } | null } | null>(row.state, null);
    const done = asNumber(state?.progress?.done, 0);
    const remaining = Array.isArray(state?.progress?.queue) ? state.progress.queue.length : 0;
    result[String(row.unit_id)] = done + remaining > 0 ? done / (done + remaining) : 0;
  }
  return result;
}

/** Stores the end-of-lesson summary on a completed attempt so a repeated completion can show it again. */
export async function saveFinalOutcome(userId: string, attemptId: string, state: unknown): Promise<void> {
  await execute("UPDATE lesson_attempts SET state = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'completed'", [
    toJson(state),
    nowIso(),
    attemptId,
    userId,
  ]);
}
