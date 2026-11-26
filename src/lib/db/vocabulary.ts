import type { InStatement } from "@libsql/client";
import { normalizeVocabularyKey } from "../exercise-text";
import {
  getMaturity,
  MATURE_INTERVAL_DAYS,
  scheduleReview,
  YOUNG_INTERVAL_DAYS,
  type Maturity,
  type ReviewGrade,
} from "../srs";
import {
  asNumber,
  asRequiredString,
  asString,
  createId,
  execute,
  executeBatch,
  getFirstRow,
  getRows,
  nowIso,
  parseStringArray,
  type DbRow,
} from "./client";

/** Vocabulary items live in the `learning` table (one row per user, language and normalised word). */

export const VOCABULARY_SOURCES = ["journey", "chat", "flashcards", "manual"] as const;
export type VocabularySource = (typeof VOCABULARY_SOURCES)[number];

export interface VocabularyItem {
  id: string;
  userId: string;
  language: string;
  word: string;
  normalizedWord: string | null;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  source: VocabularySource;
  unitId: string | null;
  notes: string | null;
  tags: string[];
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
  successCount: number;
  failureCount: number;
  /** ISO timestamp. */
  nextReview: string;
  lastReviewedAt: string | null;
  maturity: Maturity;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyInput {
  word: string;
  translation: string;
  romanization?: string | null;
  exampleSentence?: string | null;
  exampleTranslation?: string | null;
  notes?: string | null;
  tags?: string[];
  unitId?: string | null;
}

export interface UpsertVocabularyInput {
  userId: string;
  language: string;
  source: VocabularySource;
  items: VocabularyInput[];
  now?: Date;
  /** When new words first become due. Defaults to `now` (immediately reviewable). */
  firstReviewAt?: Date;
}

export interface UpsertVocabularyResult {
  /** Every item from the input (new and pre-existing), in input order, de-duplicated. */
  items: VocabularyItem[];
  insertedCount: number;
  existingCount: number;
}

export interface VocabularyCounts {
  total: number;
  new: number;
  learning: number;
  young: number;
  mature: number;
}

function toSource(value: unknown): VocabularySource {
  return (VOCABULARY_SOURCES as readonly string[]).includes(String(value)) ? (value as VocabularySource) : "manual";
}

function cleanOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function mapVocabularyItem(row: DbRow): VocabularyItem {
  const successCount = asNumber(row.success_count, 0);
  const failureCount = asNumber(row.failure_count, 0);
  const intervalDays = asNumber(row.interval_days, 0);

  return {
    id: asRequiredString(row.id, "learning.id"),
    userId: asRequiredString(row.user_id, "learning.user_id"),
    language: asRequiredString(row.language, "learning.language"),
    word: asRequiredString(row.word, "learning.word"),
    normalizedWord: asString(row.normalized_word),
    translation: asString(row.translation) ?? "",
    romanization: asString(row.romanization),
    exampleSentence: asString(row.example_sentence),
    exampleTranslation: asString(row.example_translation),
    source: toSource(row.source),
    unitId: asString(row.unit_id),
    notes: asString(row.notes),
    tags: parseStringArray(row.tags),
    intervalDays,
    ease: asNumber(row.ease, 2.5),
    repetitions: asNumber(row.repetitions, 0),
    lapses: asNumber(row.lapses, 0),
    successCount,
    failureCount,
    nextReview: asRequiredString(row.next_review, "learning.next_review"),
    lastReviewedAt: asString(row.last_reviewed_at),
    maturity: getMaturity({ intervalDays }, successCount + failureCount),
    createdAt: asRequiredString(row.created_at, "learning.created_at"),
    updatedAt: asRequiredString(row.updated_at, "learning.updated_at"),
  };
}

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

/**
 * Adds words to a learner's vocabulary. Words already present (same normalised form) keep their
 * review progress and translation; only empty optional fields (romanization, example, unit) are filled.
 */
export async function upsertVocabulary(input: UpsertVocabularyInput): Promise<UpsertVocabularyResult> {
  const now = input.now ?? new Date();
  const timestamp = nowIso(now);
  const firstReview = nowIso(input.firstReviewAt ?? now);

  const seen = new Set<string>();
  const prepared: Array<{ key: string; item: VocabularyInput }> = [];
  for (const item of input.items) {
    const word = item.word?.trim();
    const translation = item.translation?.trim();
    if (!word || !translation) {
      continue;
    }

    const key = normalizeVocabularyKey(word);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    prepared.push({ key, item: { ...item, word, translation } });
  }

  if (prepared.length === 0) {
    return { items: [], insertedCount: 0, existingCount: 0 };
  }

  const keys = prepared.map((entry) => entry.key);
  const existingRows = await getRows(
    `SELECT normalized_word FROM learning WHERE user_id = ? AND language = ? AND normalized_word IN (${placeholders(keys.length)})`,
    [input.userId, input.language, ...keys]
  );
  const existingKeys = new Set(existingRows.map((row) => String(row.normalized_word)));

  const statements: InStatement[] = prepared.map(({ key, item }) => ({
    sql: `INSERT INTO learning (
        id, user_id, language, word, normalized_word, translation, difficulty, last_recalled, next_review,
        success_count, failure_count, notes, tags, interval_days, ease, repetitions, lapses, source, unit_id,
        romanization, example_sentence, example_translation, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 0, ?, ?, 0, 2.5, 0, 0, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, language, normalized_word) DO UPDATE SET
        romanization = COALESCE(learning.romanization, excluded.romanization),
        example_sentence = COALESCE(learning.example_sentence, excluded.example_sentence),
        example_translation = COALESCE(learning.example_translation, excluded.example_translation),
        unit_id = COALESCE(learning.unit_id, excluded.unit_id),
        notes = COALESCE(learning.notes, excluded.notes)`,
    args: [
      createId(),
      input.userId,
      input.language,
      item.word,
      key,
      item.translation,
      timestamp,
      firstReview,
      cleanOptional(item.notes),
      JSON.stringify(item.tags ?? []),
      input.source,
      cleanOptional(item.unitId),
      cleanOptional(item.romanization),
      cleanOptional(item.exampleSentence),
      cleanOptional(item.exampleTranslation),
      timestamp,
      timestamp,
    ],
  }));

  await executeBatch(statements);

  const rows = await getRows(
    `SELECT * FROM learning WHERE user_id = ? AND language = ? AND normalized_word IN (${placeholders(keys.length)})`,
    [input.userId, input.language, ...keys]
  );
  const byKey = new Map(rows.map((row) => [String(row.normalized_word), mapVocabularyItem(row)]));
  const items = keys.map((key) => byKey.get(key)).filter((item): item is VocabularyItem => Boolean(item));

  return {
    items,
    insertedCount: keys.filter((key) => !existingKeys.has(key)).length,
    existingCount: keys.filter((key) => existingKeys.has(key)).length,
  };
}

export async function getVocabularyItem(userId: string, itemId: string): Promise<VocabularyItem | null> {
  const row = await getFirstRow("SELECT * FROM learning WHERE id = ? AND user_id = ? LIMIT 1", [itemId, userId]);
  return row ? mapVocabularyItem(row) : null;
}

/** Items whose next review is at or before `now`, most overdue first. Includes never-reviewed words. */
export async function listDueVocabulary(params: {
  userId: string;
  language: string;
  limit?: number;
  now?: Date;
}): Promise<VocabularyItem[]> {
  const rows = await getRows(
    `SELECT * FROM learning
      WHERE user_id = ? AND language = ? AND next_review <= ?
      ORDER BY next_review ASC, created_at ASC
      LIMIT ?`,
    [params.userId, params.language, nowIso(params.now), Math.max(1, Math.min(200, params.limit ?? 20))]
  );

  return rows.map(mapVocabularyItem);
}

export async function countDueVocabulary(userId: string, language: string, now: Date = new Date()): Promise<number> {
  const row = await getFirstRow(
    "SELECT COUNT(*) AS count FROM learning WHERE user_id = ? AND language = ? AND next_review <= ?",
    [userId, language, nowIso(now)]
  );

  return asNumber(row?.count, 0);
}

/**
 * Applies a review grade with the SM-2 scheduler and returns the updated item,
 * or null if the item does not exist or belongs to someone else.
 */
export async function applyReviewGrade(params: {
  userId: string;
  itemId: string;
  grade: ReviewGrade;
  now?: Date;
}): Promise<VocabularyItem | null> {
  const now = params.now ?? new Date();
  const item = await getVocabularyItem(params.userId, params.itemId);
  if (!item) {
    return null;
  }

  const next = scheduleReview(item, params.grade, now);
  const correct = params.grade !== "again";
  const timestamp = nowIso(now);

  await execute(
    `UPDATE learning SET
        interval_days = ?, ease = ?, repetitions = ?, lapses = ?, next_review = ?,
        success_count = success_count + ?, failure_count = failure_count + ?,
        last_recalled = ?, last_reviewed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [
      next.intervalDays,
      next.ease,
      next.repetitions,
      next.lapses,
      nowIso(next.nextReview),
      correct ? 1 : 0,
      correct ? 0 : 1,
      timestamp,
      timestamp,
      timestamp,
      params.itemId,
      params.userId,
    ]
  );

  return getVocabularyItem(params.userId, params.itemId);
}

export async function listRecentVocabulary(userId: string, language: string, limit = 20): Promise<VocabularyItem[]> {
  const rows = await getRows(
    "SELECT * FROM learning WHERE user_id = ? AND language = ? ORDER BY created_at DESC LIMIT ?",
    [userId, language, Math.max(1, Math.min(200, limit))]
  );

  return rows.map(mapVocabularyItem);
}

/** Reviewed words the learner struggles with most (most lapses, lowest ease, most failures). */
export async function listWeakestVocabulary(userId: string, language: string, limit = 10): Promise<VocabularyItem[]> {
  const rows = await getRows(
    `SELECT * FROM learning
      WHERE user_id = ? AND language = ? AND (success_count + failure_count) > 0
      ORDER BY lapses DESC, ease ASC, failure_count DESC, next_review ASC
      LIMIT ?`,
    [userId, language, Math.max(1, Math.min(200, limit))]
  );

  return rows.map(mapVocabularyItem);
}

/** Plain list of the learner's words (most recently touched first), for prompts to reuse or avoid. */
export async function listKnownWords(userId: string, language: string, limit = 300): Promise<string[]> {
  const rows = await getRows(
    "SELECT word FROM learning WHERE user_id = ? AND language = ? ORDER BY updated_at DESC LIMIT ?",
    [userId, language, Math.max(1, Math.min(2000, limit))]
  );

  return rows.map((row) => String(row.word));
}

export async function countVocabularyByMaturity(userId: string, language: string): Promise<VocabularyCounts> {
  const row = await getFirstRow(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN (success_count + failure_count) = 0 THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN (success_count + failure_count) > 0 AND interval_days < ? THEN 1 ELSE 0 END) AS learning_count,
        SUM(CASE WHEN (success_count + failure_count) > 0 AND interval_days >= ? AND interval_days < ? THEN 1 ELSE 0 END) AS young_count,
        SUM(CASE WHEN (success_count + failure_count) > 0 AND interval_days >= ? THEN 1 ELSE 0 END) AS mature_count
      FROM learning WHERE user_id = ? AND language = ?`,
    [YOUNG_INTERVAL_DAYS, YOUNG_INTERVAL_DAYS, MATURE_INTERVAL_DAYS, MATURE_INTERVAL_DAYS, userId, language]
  );

  return {
    total: asNumber(row?.total, 0),
    new: asNumber(row?.new_count, 0),
    learning: asNumber(row?.learning_count, 0),
    young: asNumber(row?.young_count, 0),
    mature: asNumber(row?.mature_count, 0),
  };
}
