import { asRequiredString, asString, createId, executeBatch, getRows, nowIso, type DbRow } from "./client";

/** Corrections the learner received, so later lessons, reviews and chats can target them. */

export const MISTAKE_KINDS = ["grammar", "vocabulary", "spelling", "word_order", "pronunciation", "other"] as const;
export type MistakeKind = (typeof MISTAKE_KINDS)[number];

export const MISTAKE_SOURCES = ["journey", "review", "chat", "voice", "flashcards"] as const;
export type MistakeSource = (typeof MISTAKE_SOURCES)[number];

export interface MistakeInput {
  kind: MistakeKind;
  /** What the learner produced. */
  incorrect: string;
  /** The correct form. */
  correction: string;
  explanation?: string | null;
  /** E.g. the prompt or sentence the mistake happened in. */
  context?: string | null;
}

export interface MistakeRecord extends Required<Pick<MistakeInput, "kind" | "incorrect" | "correction">> {
  id: string;
  userId: string;
  language: string;
  explanation: string | null;
  context: string | null;
  source: MistakeSource;
  createdAt: string;
}

function toKind(value: unknown): MistakeKind {
  return (MISTAKE_KINDS as readonly string[]).includes(String(value)) ? (value as MistakeKind) : "other";
}

function toSource(value: unknown): MistakeSource {
  return (MISTAKE_SOURCES as readonly string[]).includes(String(value)) ? (value as MistakeSource) : "journey";
}

function mapMistake(row: DbRow): MistakeRecord {
  return {
    id: asRequiredString(row.id, "mistakes.id"),
    userId: asRequiredString(row.user_id, "mistakes.user_id"),
    language: asRequiredString(row.language, "mistakes.language"),
    kind: toKind(row.kind),
    incorrect: asString(row.incorrect) ?? "",
    correction: asString(row.correction) ?? "",
    explanation: asString(row.explanation),
    context: asString(row.context),
    source: toSource(row.source),
    createdAt: asRequiredString(row.created_at, "mistakes.created_at"),
  };
}

/** Records one or more mistakes in a single transaction. Entries with empty text are skipped. */
export async function recordMistakes(input: {
  userId: string;
  language: string;
  source: MistakeSource;
  mistakes: MistakeInput[];
}): Promise<number> {
  const timestamp = nowIso();
  const valid = input.mistakes.filter((mistake) => mistake.incorrect?.trim() && mistake.correction?.trim());
  if (valid.length === 0) {
    return 0;
  }

  await executeBatch(
    valid.map((mistake) => ({
      sql: `INSERT INTO mistakes (id, user_id, language, kind, incorrect, correction, explanation, source, context, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        createId(),
        input.userId,
        input.language,
        toKind(mistake.kind),
        mistake.incorrect.trim().slice(0, 500),
        mistake.correction.trim().slice(0, 500),
        mistake.explanation?.trim().slice(0, 1000) || null,
        input.source,
        mistake.context?.trim().slice(0, 1000) || null,
        timestamp,
      ],
    }))
  );

  return valid.length;
}

export async function listRecentMistakes(params: {
  userId: string;
  language: string;
  limit?: number;
  kind?: MistakeKind;
}): Promise<MistakeRecord[]> {
  const limit = Math.max(1, Math.min(200, params.limit ?? 20));
  const rows = params.kind
    ? await getRows(
        "SELECT * FROM mistakes WHERE user_id = ? AND language = ? AND kind = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
        [params.userId, params.language, params.kind, limit]
      )
    : await getRows(
        "SELECT * FROM mistakes WHERE user_id = ? AND language = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
        [params.userId, params.language, limit]
      );

  return rows.map(mapMistake);
}
