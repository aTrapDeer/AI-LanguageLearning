/**
 * Server-only persistence for review sessions, the "My words" list and the weekly activity strip.
 * Review sessions make grading server-authoritative: only cards served in a session can be graded,
 * each card scores once (its first grade), and a session pays out XP at most once.
 */

import {
  getDailyXpGoal,
  getStreak,
  mapVocabularyItem,
  recordActivity,
  type VocabularyItem,
} from "../database";
import {
  asNumber,
  asString,
  createId,
  executeBatch,
  getFirstRow,
  getRows,
  execute,
  nowIso,
  parseJson,
} from "../db/client";
import { normalizeVocabularyKey } from "../exercise-text";
import { addDays, resolveLocalDate } from "../local-date";
import type { ReviewGrade } from "../srs";
import { MAX_GRADES_PER_CARD, SESSION_TTL_MS } from "./plan";
import { scoreSession } from "./scoring";
import type { CompleteResponse, DailyHistoryEntry } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Old sessions are pruned when a learner starts a new one. */
const SESSION_RETENTION_DAYS = 30;

let tablesPromise: Promise<void> | null = null;

/** Review tables are owned by this module and created on first use (idempotent). */
export async function ensureReviewTables(): Promise<void> {
  if (!tablesPromise) {
    tablesPromise = executeBatch([
      `CREATE TABLE IF NOT EXISTS review_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        result TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS review_session_items (
        session_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        first_grade TEXT,
        grade_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (session_id, item_id),
        FOREIGN KEY(session_id) REFERENCES review_sessions(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_review_sessions_user ON review_sessions(user_id, created_at)`,
    ]).then(
      () => undefined,
      (error) => {
        tablesPromise = null;
        throw error;
      }
    );
  }

  await tablesPromise;
}

export async function createReviewSession(params: {
  userId: string;
  language: string;
  itemIds: string[];
  now?: Date;
}): Promise<string> {
  await ensureReviewTables();
  const now = params.now ?? new Date();
  const timestamp = nowIso(now);
  const cutoff = nowIso(new Date(now.getTime() - SESSION_RETENTION_DAYS * DAY_MS));
  const sessionId = createId();

  await executeBatch([
    {
      sql: `DELETE FROM review_session_items WHERE session_id IN (
          SELECT id FROM review_sessions WHERE user_id = ? AND created_at < ?)`,
      args: [params.userId, cutoff],
    },
    { sql: "DELETE FROM review_sessions WHERE user_id = ? AND created_at < ?", args: [params.userId, cutoff] },
    {
      sql: "INSERT INTO review_sessions (id, user_id, language, created_at) VALUES (?, ?, ?, ?)",
      args: [sessionId, params.userId, params.language, timestamp],
    },
    ...params.itemIds.map((itemId, position) => ({
      sql: `INSERT INTO review_session_items (session_id, item_id, position, updated_at) VALUES (?, ?, ?, ?)`,
      args: [sessionId, itemId, position, timestamp],
    })),
  ]);

  return sessionId;
}

export type ClaimGradeResult =
  | { ok: true; requeue: boolean }
  | { ok: false; reason: "not_allowed" };

/**
 * Atomically claims one grade for a card in a session. Succeeds only when the session belongs to the
 * learner, is open and fresh, the card was served in it and is still pending, and the card is either
 * due now or already being relearned in this session.
 */
export async function claimGrade(params: {
  userId: string;
  sessionId: string;
  itemId: string;
  grade: ReviewGrade;
  now?: Date;
}): Promise<ClaimGradeResult> {
  await ensureReviewTables();
  const now = params.now ?? new Date();
  const timestamp = nowIso(now);
  const freshAfter = nowIso(new Date(now.getTime() - SESSION_TTL_MS));

  const result = await execute(
    `UPDATE review_session_items SET
        grade_count = grade_count + 1,
        first_grade = COALESCE(first_grade, ?),
        status = CASE WHEN ? = 'again' AND grade_count + 1 < ? THEN 'pending' ELSE 'done' END,
        updated_at = ?
      WHERE session_id = ? AND item_id = ? AND status = 'pending'
        AND EXISTS (
          SELECT 1 FROM review_sessions s
          WHERE s.id = ? AND s.user_id = ? AND s.completed_at IS NULL AND s.created_at >= ?)
        AND (grade_count > 0 OR EXISTS (
          SELECT 1 FROM learning l WHERE l.id = ? AND l.user_id = ? AND l.next_review <= ?))
      RETURNING status`,
    [
      params.grade,
      params.grade,
      MAX_GRADES_PER_CARD,
      timestamp,
      params.sessionId,
      params.itemId,
      params.sessionId,
      params.userId,
      freshAfter,
      params.itemId,
      params.userId,
      timestamp,
    ]
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return { ok: false, reason: "not_allowed" };
  }

  return { ok: true, requeue: String(row.status) === "pending" };
}

/** Marks a card finished without a grade (e.g. it was deleted mid-session). */
export async function closeSessionItem(sessionId: string, itemId: string): Promise<void> {
  await ensureReviewTables();
  await execute("UPDATE review_session_items SET status = 'done', updated_at = ? WHERE session_id = ? AND item_id = ?", [
    nowIso(),
    sessionId,
    itemId,
  ]);
}

export async function getNextDueAt(userId: string, language: string, now: Date = new Date()): Promise<string | null> {
  const row = await getFirstRow(
    "SELECT MIN(next_review) AS next_due FROM learning WHERE user_id = ? AND language = ? AND next_review > ?",
    [userId, language, nowIso(now)]
  );
  return asString(row?.next_due);
}

export type StoredSessionResult = Omit<CompleteResponse, "dueCount" | "nextDueAt">;

export type CompleteSessionResult =
  | { ok: true; result: StoredSessionResult; language: string }
  | { ok: false; reason: "not_found" | "in_progress" };

/**
 * Closes a session once and awards XP for the cards graded in it (server rules only). Calling it
 * again returns the stored result without paying out twice.
 */
export async function completeReviewSession(params: {
  userId: string;
  sessionId: string;
  localDate?: string | null;
  now?: Date;
}): Promise<CompleteSessionResult> {
  await ensureReviewTables();
  const now = params.now ?? new Date();
  const freshAfter = nowIso(new Date(now.getTime() - 2 * SESSION_TTL_MS));

  const claimed = await execute(
    `UPDATE review_sessions SET completed_at = ?
      WHERE id = ? AND user_id = ? AND completed_at IS NULL AND created_at >= ?
      RETURNING language`,
    [nowIso(now), params.sessionId, params.userId, freshAfter]
  );

  const claimedRow = claimed.rows[0] as Record<string, unknown> | undefined;
  if (!claimedRow) {
    const existing = await getFirstRow("SELECT language, result FROM review_sessions WHERE id = ? AND user_id = ? LIMIT 1", [
      params.sessionId,
      params.userId,
    ]);
    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const stored = parseJson<StoredSessionResult | null>(existing.result, null);
    return stored ? { ok: true, result: stored, language: String(existing.language) } : { ok: false, reason: "in_progress" };
  }

  const language = String(claimedRow.language);
  const gradeRows = await getRows(
    "SELECT first_grade FROM review_session_items WHERE session_id = ? AND first_grade IS NOT NULL",
    [params.sessionId]
  );
  const score = scoreSession(gradeRows.map((row) => String(row.first_grade) as ReviewGrade));
  const localDate = resolveLocalDate(params.localDate, now);

  let result: StoredSessionResult;
  if (score.reviewed === 0) {
    const [streak, dailyGoal] = await Promise.all([getStreak(params.userId, localDate), getDailyXpGoal(params.userId)]);
    result = {
      reviewed: 0,
      correct: 0,
      accuracy: 0,
      xpGained: 0,
      totalXp: null,
      streak: { current: streak.current, longest: streak.longest, todayDone: streak.todayDone },
      streakExtended: false,
      dailyXp: null,
      dailyGoal,
      goalJustReached: false,
    };
  } else {
    const before = await getStreak(params.userId, localDate);
    const activity = await recordActivity({
      userId: params.userId,
      language,
      kind: "review",
      xp: score.xp,
      count: score.reviewed,
      localDate,
      now,
    });

    result = {
      reviewed: score.reviewed,
      correct: score.correct,
      accuracy: score.accuracy,
      xpGained: activity.xpGained,
      totalXp: activity.totalXp,
      streak: {
        current: activity.streak.current,
        longest: activity.streak.longest,
        todayDone: activity.streak.todayDone,
      },
      streakExtended: !before.todayDone && activity.streak.todayDone,
      dailyXp: activity.dailyXp,
      dailyGoal: activity.dailyGoal,
      goalJustReached: activity.goalJustReached,
    };
  }

  await execute("UPDATE review_sessions SET result = ? WHERE id = ?", [JSON.stringify(result), params.sessionId]);
  return { ok: true, result, language };
}

/** Words generated for review in the last 24 hours (caps generation spend per learner). */
export async function countGeneratedWordsSince(userId: string, language: string, since: Date): Promise<number> {
  const row = await getFirstRow(
    "SELECT COUNT(*) AS count FROM learning WHERE user_id = ? AND language = ? AND source = 'flashcards' AND created_at >= ?",
    [userId, language, nowIso(since)]
  );
  return asNumber(row?.count, 0);
}

export async function countVocabulary(userId: string, language: string): Promise<number> {
  const row = await getFirstRow("SELECT COUNT(*) AS count FROM learning WHERE user_id = ? AND language = ?", [userId, language]);
  return asNumber(row?.count, 0);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** The learner's words, newest first, optionally filtered by a search on word or meaning. */
export async function searchVocabulary(params: {
  userId: string;
  language: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: VocabularyItem[]; hasMore: boolean }> {
  const limit = Math.max(1, Math.min(100, params.limit ?? 30));
  const offset = Math.max(0, Math.floor(params.offset ?? 0));
  const query = params.query?.trim() ?? "";
  const args: Array<string | number> = [params.userId, params.language];
  let filter = "";

  if (query) {
    const pattern = `%${escapeLike(query.toLocaleLowerCase())}%`;
    const normalizedKey = normalizeVocabularyKey(query);
    const clauses = ["lower(word) LIKE ? ESCAPE '\\'", "lower(translation) LIKE ? ESCAPE '\\'", "lower(COALESCE(romanization, '')) LIKE ? ESCAPE '\\'"];
    args.push(pattern, pattern, pattern);
    // lower() only folds ASCII; the normalised column also matches case-folded non-Latin words.
    if (normalizedKey) {
      clauses.push("normalized_word LIKE ? ESCAPE '\\'");
      args.push(`%${escapeLike(normalizedKey)}%`);
    }
    filter = `AND (${clauses.join(" OR ")})`;
  }

  const rows = await getRows(
    `SELECT * FROM learning WHERE user_id = ? AND language = ? ${filter}
      ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?`,
    [...args, limit + 1, offset]
  );

  return { items: rows.slice(0, limit).map(mapVocabularyItem), hasMore: rows.length > limit };
}

/** Removes one of the learner's own words. Returns false when it does not exist or is not theirs. */
export async function deleteVocabularyItem(userId: string, itemId: string): Promise<boolean> {
  const result = await execute("DELETE FROM learning WHERE id = ? AND user_id = ?", [itemId, userId]);
  return result.rowsAffected > 0;
}

/** XP per local day across all languages for the `days` days ending `today` (oldest first, gaps filled). */
export async function listDailyHistory(params: {
  userId: string;
  today: string;
  days?: number;
  goal: number;
}): Promise<DailyHistoryEntry[]> {
  const days = Math.max(1, Math.min(31, params.days ?? 7));
  const from = addDays(params.today, -(days - 1));
  const rows = await getRows(
    `SELECT local_date, COALESCE(SUM(xp), 0) AS xp FROM daily_activity
      WHERE user_id = ? AND local_date >= ? AND local_date <= ?
      GROUP BY local_date`,
    [params.userId, from, params.today]
  );
  const byDate = new Map(rows.map((row) => [String(row.local_date), asNumber(row.xp, 0)]));

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(from, index);
    const xp = byDate.get(date) ?? 0;
    return { date, xp, goalMet: xp >= params.goal };
  });
}
