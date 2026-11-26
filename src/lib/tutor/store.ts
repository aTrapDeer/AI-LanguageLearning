import { asNumber, execute, getFirstRow, getRows, nowIso } from "@/lib/db/client";
import { normalizeVocabularyKey } from "@/lib/exercise-text";

/** Server-only queries the tutor needs that the shared db modules don't provide. */

/** Learner chat turns already counted today for this language (the daily_activity counter). */
export async function countChatTurnsToday(userId: string, language: string, localDate: string): Promise<number> {
  const row = await getFirstRow(
    "SELECT chat_messages FROM daily_activity WHERE user_id = ? AND language = ? AND local_date = ? LIMIT 1",
    [userId, language, localDate]
  );
  return asNumber(row?.chat_messages, 0);
}

/** Which of `words` are already in the learner's review deck (compared by normalised form). */
export async function findSavedWords(userId: string, language: string, words: string[]): Promise<string[]> {
  const keys = Array.from(new Set(words.map(normalizeVocabularyKey).filter(Boolean))).slice(0, 200);
  if (keys.length === 0) {
    return [];
  }

  const rows = await getRows(
    `SELECT normalized_word FROM learning WHERE user_id = ? AND language = ? AND normalized_word IN (${keys.map(() => "?").join(", ")})`,
    [userId, language, ...keys]
  );
  return rows.map((row) => String(row.normalized_word));
}

export interface VoiceSessionMetadata {
  voiceMode: string;
  unitId: string | null;
  localDate: string;
  startedAt: string;
  endedAt?: string | null;
  xpAwarded?: number;
  creditedSeconds?: number;
}

/** Voice XP already awarded today (local date) for this language, summed over ended sessions. */
export async function sumVoiceXpToday(userId: string, language: string, localDate: string): Promise<number> {
  const row = await getFirstRow(
    `SELECT COALESCE(SUM(json_extract(metadata, '$.xpAwarded')), 0) AS xp FROM chat_sessions
      WHERE user_id = ? AND language = ? AND mode = 'voice'
        AND json_extract(metadata, '$.localDate') = ? AND json_extract(metadata, '$.endedAt') IS NOT NULL`,
    [userId, language, localDate]
  );
  return asNumber(row?.xp, 0);
}

/**
 * Marks a voice session ended with its result, exactly once. Returns false when the session does not
 * belong to the user, is not a voice session, or was already ended.
 */
export async function claimVoiceSessionEnd(params: {
  userId: string;
  sessionId: string;
  endedAt: Date;
  xpAwarded: number;
  creditedSeconds: number;
}): Promise<boolean> {
  const endedAt = nowIso(params.endedAt);
  const result = await execute(
    `UPDATE chat_sessions
      SET metadata = json_set(COALESCE(metadata, '{}'), '$.endedAt', ?, '$.xpAwarded', ?, '$.creditedSeconds', ?),
          updated_at = ?
      WHERE id = ? AND user_id = ? AND mode = 'voice' AND json_extract(metadata, '$.endedAt') IS NULL`,
    [endedAt, params.xpAwarded, params.creditedSeconds, endedAt, params.sessionId, params.userId]
  );
  return result.rowsAffected > 0;
}
