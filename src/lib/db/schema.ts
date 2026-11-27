import type { Client } from "@libsql/client";
import { normalizeVocabularyKey } from "../exercise-text";

/**
 * Schema is additive only: production already has users/progress rows. New columns are added with
 * ALTER TABLE after checking PRAGMA table_info, so this runs safely on both fresh and old databases.
 */

const BASE_TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    native_language TEXT NOT NULL DEFAULT 'English',
    active_language TEXT NOT NULL DEFAULT 'en',
    learning_languages TEXT NOT NULL DEFAULT '[]',
    account_setup INTEGER NOT NULL DEFAULT 0,
    email_verified TEXT,
    image TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider, provider_account_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    session_token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    expires TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires TEXT NOT NULL,
    UNIQUE(identifier, token)
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, language),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS learning (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    difficulty INTEGER NOT NULL DEFAULT 0,
    last_recalled TEXT NOT NULL,
    next_review TEXT NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    audio_url TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
];

const NEW_TABLES = [
  `CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL,
    level INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    content TEXT NOT NULL,
    content_version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lesson_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    language TEXT NOT NULL,
    level INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    correct_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    accuracy REAL NOT NULL DEFAULT 0,
    stars INTEGER NOT NULL DEFAULT 0,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    state TEXT,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS daily_activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    local_date TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    lessons INTEGER NOT NULL DEFAULT 0,
    reviews INTEGER NOT NULL DEFAULT 0,
    chat_messages INTEGER NOT NULL DEFAULT 0,
    voice_sessions INTEGER NOT NULL DEFAULT 0,
    flashcards INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, language, local_date),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'tutor',
    title TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS mistakes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    kind TEXT NOT NULL,
    incorrect TEXT NOT NULL,
    correction TEXT NOT NULL,
    explanation TEXT,
    source TEXT NOT NULL,
    context TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ai_usage (
    user_id TEXT NOT NULL,
    usage_date TEXT NOT NULL,
    kind TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, usage_date, kind)
  )`,
  // One picture per English concept, shared by every language and learner. Not user data.
  `CREATE TABLE IF NOT EXISTS concept_images (
    id TEXT PRIMARY KEY,
    concept_key TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
    mime_type TEXT,
    data BLOB,
    byte_size INTEGER,
    width INTEGER,
    height INTEGER,
    model TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    claimed_at TEXT,
    retry_after TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

/** Columns added to tables that already exist in production. */
const ADDED_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  { table: "users", column: "daily_xp_goal", definition: "INTEGER" },
  { table: "learning", column: "normalized_word", definition: "TEXT" },
  { table: "learning", column: "interval_days", definition: "REAL NOT NULL DEFAULT 0" },
  { table: "learning", column: "ease", definition: "REAL NOT NULL DEFAULT 2.5" },
  { table: "learning", column: "repetitions", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "learning", column: "lapses", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "learning", column: "source", definition: "TEXT NOT NULL DEFAULT 'manual'" },
  { table: "learning", column: "unit_id", definition: "TEXT" },
  { table: "learning", column: "romanization", definition: "TEXT" },
  { table: "learning", column: "example_sentence", definition: "TEXT" },
  { table: "learning", column: "example_translation", definition: "TEXT" },
  { table: "learning", column: "last_reviewed_at", definition: "TEXT" },
  /** concept_images.concept_key of the word's picture, when it has one. */
  { table: "learning", column: "image_key", definition: "TEXT" },
];

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_learning_user_language ON learning(user_id, language)`,
  `CREATE INDEX IF NOT EXISTS idx_learning_due ON learning(user_id, language, next_review)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_user_language_word ON learning(user_id, language, normalized_word)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_user_language_created_at ON chats(user_id, language, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_lessons_language_unit ON lessons(language, unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_attempts_user_unit ON lesson_attempts(user_id, language, unit_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_attempts_user_lesson ON lesson_attempts(user_id, lesson_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity(user_id, local_date)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_language ON chat_sessions(user_id, language, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_mistakes_user_language ON mistakes(user_id, language, created_at DESC)`,
];

async function getColumnNames(client: Client, table: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return new Set(result.rows.map((row) => String((row as Record<string, unknown>).name)));
}

async function addMissingColumns(client: Client) {
  const tables = Array.from(new Set(ADDED_COLUMNS.map((entry) => entry.table)));

  for (const table of tables) {
    const existing = await getColumnNames(client, table);

    for (const { column, definition } of ADDED_COLUMNS.filter((entry) => entry.table === table)) {
      if (existing.has(column)) {
        continue;
      }

      try {
        await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      } catch (error) {
        // Another instance may have added it between our PRAGMA and ALTER.
        if (!(error instanceof Error && /duplicate column/i.test(error.message))) {
          throw error;
        }
      }
    }
  }
}

/**
 * Fills learning.normalized_word for rows written before the column existed. If two old rows
 * normalise to the same word, the newer one keeps NULL (the unique index allows multiple NULLs)
 * rather than deleting anything.
 */
async function backfillNormalizedWords(client: Client) {
  const result = await client.execute(
    "SELECT id, user_id, language, word FROM learning WHERE normalized_word IS NULL ORDER BY created_at ASC"
  );

  if (result.rows.length === 0) {
    return;
  }

  const existing = await client.execute(
    "SELECT user_id, language, normalized_word FROM learning WHERE normalized_word IS NOT NULL"
  );
  const taken = new Set(
    existing.rows.map((row) => {
      const record = row as Record<string, unknown>;
      return `${record.user_id}\u0000${record.language}\u0000${record.normalized_word}`;
    })
  );

  for (const row of result.rows) {
    const record = row as Record<string, unknown>;
    const normalized = normalizeVocabularyKey(String(record.word ?? ""));
    const key = `${record.user_id}\u0000${record.language}\u0000${normalized}`;
    if (!normalized || taken.has(key)) {
      continue;
    }

    taken.add(key);
    await client.execute({ sql: "UPDATE learning SET normalized_word = ? WHERE id = ?", args: [normalized, String(record.id)] });
  }
}

export async function migrateSchema(client: Client): Promise<void> {
  // Batched to keep cold starts against a remote database to a handful of round-trips.
  await client.batch([...BASE_TABLES, ...NEW_TABLES], "write");
  await addMissingColumns(client);
  await backfillNormalizedWords(client);
  await client.batch(INDEXES, "write");
}

export const DATABASE_TABLES = [
  "users",
  "accounts",
  "sessions",
  "verification_tokens",
  "progress",
  "learning",
  "chats",
  "lessons",
  "lesson_attempts",
  "daily_activity",
  "chat_sessions",
  "chat_messages",
  "mistakes",
  "ai_usage",
  "concept_images",
] as const;
