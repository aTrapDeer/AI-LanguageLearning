import { getUnitById } from "../curriculum";
import { computeAccuracy, starsForAccuracy, xpForLesson } from "../gamification";
import { clampLevel } from "../levels";
import { recordActivity, type ActivityResult } from "./activity";
import {
  asNumber,
  asRequiredString,
  asString,
  createId,
  execute,
  getFirstRow,
  getRows,
  nowIso,
  parseJson,
  toJson,
  type DbRow,
} from "./client";
import { getUnitProgress } from "./unit-progress";

export { getUnitProgress, advanceLevelIfEligible, type UnitProgress, type LevelUpResult } from "./unit-progress";

/**
 * Lessons are generated once per (language, unit) and pooled so other learners can reuse them;
 * `lesson_attempts` holds each learner's run through one pooled lesson.
 */

export interface StoredLesson<TContent = unknown> {
  id: string;
  language: string;
  level: number;
  unitId: string;
  content: TContent;
  contentVersion: number;
  createdBy: string | null;
  createdAt: string;
}

export type LessonAttemptStatus = "in_progress" | "completed";

export interface LessonAttempt<TState = unknown> {
  id: string;
  userId: string;
  lessonId: string;
  language: string;
  level: number;
  unitId: string;
  status: LessonAttemptStatus;
  correctCount: number;
  totalCount: number;
  /** 0..1 */
  accuracy: number;
  stars: number;
  xpAwarded: number;
  /** Opaque client state for resuming (current step, answers…). */
  state: TState | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

function mapLesson<TContent>(row: DbRow): StoredLesson<TContent> {
  return {
    id: asRequiredString(row.id, "lessons.id"),
    language: asRequiredString(row.language, "lessons.language"),
    level: clampLevel(asNumber(row.level, 1)),
    unitId: asRequiredString(row.unit_id, "lessons.unit_id"),
    content: parseJson<TContent>(row.content, null as TContent),
    contentVersion: asNumber(row.content_version, 1),
    createdBy: asString(row.created_by),
    createdAt: asRequiredString(row.created_at, "lessons.created_at"),
  };
}

function mapAttempt<TState>(row: DbRow): LessonAttempt<TState> {
  return {
    id: asRequiredString(row.id, "lesson_attempts.id"),
    userId: asRequiredString(row.user_id, "lesson_attempts.user_id"),
    lessonId: asRequiredString(row.lesson_id, "lesson_attempts.lesson_id"),
    language: asRequiredString(row.language, "lesson_attempts.language"),
    level: clampLevel(asNumber(row.level, 1)),
    unitId: asRequiredString(row.unit_id, "lesson_attempts.unit_id"),
    status: row.status === "completed" ? "completed" : "in_progress",
    correctCount: asNumber(row.correct_count, 0),
    totalCount: asNumber(row.total_count, 0),
    accuracy: asNumber(row.accuracy, 0),
    stars: asNumber(row.stars, 0),
    xpAwarded: asNumber(row.xp_awarded, 0),
    state: parseJson<TState | null>(row.state, null),
    startedAt: asRequiredString(row.started_at, "lesson_attempts.started_at"),
    updatedAt: asRequiredString(row.updated_at, "lesson_attempts.updated_at"),
    completedAt: asString(row.completed_at),
  };
}

export async function insertLesson<TContent>(input: {
  language: string;
  unitId: string;
  content: TContent;
  /** Defaults to the unit's curriculum level. */
  level?: number;
  contentVersion?: number;
  createdBy?: string | null;
}): Promise<StoredLesson<TContent>> {
  const unit = getUnitById(input.unitId);
  const id = createId();

  await execute(
    `INSERT INTO lessons (id, language, level, unit_id, content, content_version, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.language,
      clampLevel(input.level ?? unit?.level ?? 1),
      input.unitId,
      JSON.stringify(input.content),
      input.contentVersion ?? 1,
      input.createdBy ?? null,
      nowIso(),
    ]
  );

  const lesson = await getLessonById<TContent>(id);
  if (!lesson) {
    throw new Error("Failed to load inserted lesson");
  }

  return lesson;
}

export async function getLessonById<TContent = unknown>(lessonId: string): Promise<StoredLesson<TContent> | null> {
  const row = await getFirstRow("SELECT * FROM lessons WHERE id = ? LIMIT 1", [lessonId]);
  return row ? mapLesson<TContent>(row) : null;
}

/**
 * A pooled lesson for (language, unit) this learner has not completed yet, preferring ones they have
 * never opened, then ones in the newest content format. Returns null when the pool has nothing new for
 * them (generate a fresh lesson then).
 * Pass `minContentVersion` to skip lessons generated with an older content format.
 */
export async function findReusableLesson<TContent = unknown>(params: {
  userId: string;
  language: string;
  unitId: string;
  minContentVersion?: number;
}): Promise<StoredLesson<TContent> | null> {
  const row = await getFirstRow(
    `SELECT lessons.* FROM lessons
      WHERE lessons.language = ? AND lessons.unit_id = ? AND lessons.content_version >= ?
        AND NOT EXISTS (
          SELECT 1 FROM lesson_attempts
          WHERE lesson_attempts.lesson_id = lessons.id AND lesson_attempts.user_id = ? AND lesson_attempts.status = 'completed'
        )
      ORDER BY
        EXISTS (SELECT 1 FROM lesson_attempts WHERE lesson_attempts.lesson_id = lessons.id AND lesson_attempts.user_id = ?) ASC,
        lessons.content_version DESC,
        RANDOM()
      LIMIT 1`,
    [params.language, params.unitId, params.minContentVersion ?? 1, params.userId, params.userId]
  );

  return row ? mapLesson<TContent>(row) : null;
}

export async function getLessonAttempt<TState = unknown>(userId: string, attemptId: string): Promise<LessonAttempt<TState> | null> {
  const row = await getFirstRow("SELECT * FROM lesson_attempts WHERE id = ? AND user_id = ? LIMIT 1", [attemptId, userId]);
  return row ? mapAttempt<TState>(row) : null;
}

/** The learner's most recent unfinished attempt for a unit, to offer "resume". */
export async function getActiveLessonAttempt<TState = unknown>(params: {
  userId: string;
  language: string;
  unitId: string;
}): Promise<LessonAttempt<TState> | null> {
  const row = await getFirstRow(
    `SELECT * FROM lesson_attempts
      WHERE user_id = ? AND language = ? AND unit_id = ? AND status = 'in_progress'
      ORDER BY updated_at DESC LIMIT 1`,
    [params.userId, params.language, params.unitId]
  );

  return row ? mapAttempt<TState>(row) : null;
}

/** Starts an attempt on a pooled lesson, or returns the learner's existing in-progress attempt on it. */
export async function startLessonAttempt<TState = unknown>(params: {
  userId: string;
  lessonId: string;
  initialState?: TState;
}): Promise<LessonAttempt<TState>> {
  const existing = await getFirstRow(
    `SELECT * FROM lesson_attempts WHERE user_id = ? AND lesson_id = ? AND status = 'in_progress'
      ORDER BY updated_at DESC LIMIT 1`,
    [params.userId, params.lessonId]
  );
  if (existing) {
    return mapAttempt<TState>(existing);
  }

  const lesson = await getLessonById(params.lessonId);
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  const id = createId();
  const timestamp = nowIso();
  await execute(
    `INSERT INTO lesson_attempts (id, user_id, lesson_id, language, level, unit_id, status, state, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
    [id, params.userId, lesson.id, lesson.language, lesson.level, lesson.unitId, toJson(params.initialState), timestamp, timestamp]
  );

  const attempt = await getLessonAttempt<TState>(params.userId, id);
  if (!attempt) {
    throw new Error("Failed to load lesson attempt");
  }

  return attempt;
}

/** Saves resume state (and optional running score) for an in-progress attempt. Returns null if not found/finished. */
export async function saveLessonAttemptState<TState = unknown>(params: {
  userId: string;
  attemptId: string;
  state: TState;
  correctCount?: number;
  totalCount?: number;
}): Promise<LessonAttempt<TState> | null> {
  const result = await execute(
    `UPDATE lesson_attempts SET
        state = ?,
        correct_count = COALESCE(?, correct_count),
        total_count = COALESCE(?, total_count),
        updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
    [
      toJson(params.state),
      params.correctCount ?? null,
      params.totalCount ?? null,
      nowIso(),
      params.attemptId,
      params.userId,
    ]
  );

  return result.rowsAffected > 0 ? getLessonAttempt<TState>(params.userId, params.attemptId) : null;
}

export interface CompleteLessonResult {
  attempt: LessonAttempt;
  accuracy: number;
  stars: number;
  xpAwarded: number;
  /** First time this unit was passed (≥1 star). Replays earn reduced XP. */
  isFirstPass: boolean;
  /** Best stars for the unit after this attempt. */
  bestStars: number;
  activity: ActivityResult;
}

/**
 * Finishes an attempt: scores it, awards XP via `recordActivity` (which also applies the level-up
 * rule) and returns everything the end-of-lesson screen needs. Returns null if the attempt does not
 * exist, belongs to another user, or was already completed (so XP cannot be claimed twice).
 */
export async function completeLessonAttempt(params: {
  userId: string;
  attemptId: string;
  correctCount: number;
  totalCount: number;
  localDate?: string | null;
  finalState?: unknown;
  now?: Date;
}): Promise<CompleteLessonResult | null> {
  const attempt = await getLessonAttempt(params.userId, params.attemptId);
  if (!attempt || attempt.status === "completed") {
    return null;
  }

  const totalCount = Math.max(0, Math.round(params.totalCount));
  const correctCount = Math.min(totalCount, Math.max(0, Math.round(params.correctCount)));
  const accuracy = computeAccuracy(correctCount, totalCount);
  const stars = starsForAccuracy(accuracy);

  const before = await getUnitProgress(params.userId, attempt.language);
  const previousBest = before.bestStars[attempt.unitId] ?? 0;
  const isFirstPass = stars >= 1 && previousBest < 1;
  // A failed (0-star) attempt still earns the reduced replay reward for the effort.
  const xpAwarded = xpForLesson({ stars, isFirstPass });
  const now = params.now ?? new Date();
  const timestamp = nowIso(now);

  const update = await execute(
    `UPDATE lesson_attempts SET
        status = 'completed', correct_count = ?, total_count = ?, accuracy = ?, stars = ?, xp_awarded = ?,
        state = COALESCE(?, state), updated_at = ?, completed_at = ?
      WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
    [
      correctCount,
      totalCount,
      accuracy,
      stars,
      xpAwarded,
      toJson(params.finalState),
      timestamp,
      timestamp,
      params.attemptId,
      params.userId,
    ]
  );

  if (update.rowsAffected === 0) {
    // Lost a race with a concurrent completion of the same attempt.
    return null;
  }

  const activity = await recordActivity({
    userId: params.userId,
    language: attempt.language,
    kind: "lesson",
    xp: xpAwarded,
    localDate: params.localDate,
    evaluateLevelUp: true,
    now,
  });

  const completed = await getLessonAttempt(params.userId, params.attemptId);

  return {
    attempt: completed ?? attempt,
    accuracy,
    stars,
    xpAwarded,
    isFirstPass,
    bestStars: Math.max(previousBest, stars),
    activity,
  };
}

/** Completed attempts for a learner and language, newest first. */
export async function listCompletedAttempts(userId: string, language: string, limit = 50): Promise<LessonAttempt[]> {
  const rows = await getRows(
    `SELECT * FROM lesson_attempts WHERE user_id = ? AND language = ? AND status = 'completed'
      ORDER BY completed_at DESC LIMIT ?`,
    [userId, language, Math.max(1, Math.min(500, limit))]
  );

  return rows.map((row) => mapAttempt(row));
}
