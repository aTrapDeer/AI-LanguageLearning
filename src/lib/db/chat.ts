import {
  asRequiredString,
  asString,
  createId,
  executeBatch,
  getFirstRow,
  getRows,
  nowIso,
  parseJson,
  toJson,
  type DbRow,
} from "./client";

/** Conversation memory for the tutor. The legacy flat `chats` table is left untouched. */

export type ChatRole = "user" | "assistant" | "system";

export interface ChatSession<TMetadata = unknown> {
  id: string;
  userId: string;
  language: string;
  /** Free-form mode label, e.g. "tutor", "voice", "scenario". */
  mode: string;
  title: string | null;
  metadata: TMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord<TPayload = unknown> {
  id: string;
  sessionId: string;
  userId: string;
  role: ChatRole;
  content: string;
  /** Structured extras (corrections, translation, romanization…). */
  payload: TPayload | null;
  createdAt: string;
}

function mapSession<TMetadata>(row: DbRow): ChatSession<TMetadata> {
  return {
    id: asRequiredString(row.id, "chat_sessions.id"),
    userId: asRequiredString(row.user_id, "chat_sessions.user_id"),
    language: asRequiredString(row.language, "chat_sessions.language"),
    mode: asString(row.mode) ?? "tutor",
    title: asString(row.title),
    metadata: parseJson<TMetadata | null>(row.metadata, null),
    createdAt: asRequiredString(row.created_at, "chat_sessions.created_at"),
    updatedAt: asRequiredString(row.updated_at, "chat_sessions.updated_at"),
  };
}

function mapMessage<TPayload>(row: DbRow): ChatMessageRecord<TPayload> {
  const role = String(row.role);
  return {
    id: asRequiredString(row.id, "chat_messages.id"),
    sessionId: asRequiredString(row.session_id, "chat_messages.session_id"),
    userId: asRequiredString(row.user_id, "chat_messages.user_id"),
    role: role === "assistant" || role === "system" ? role : "user",
    content: asString(row.content) ?? "",
    payload: parseJson<TPayload | null>(row.payload, null),
    createdAt: asRequiredString(row.created_at, "chat_messages.created_at"),
  };
}

export async function createChatSession<TMetadata = unknown>(input: {
  userId: string;
  language: string;
  mode?: string;
  title?: string | null;
  metadata?: TMetadata;
}): Promise<ChatSession<TMetadata>> {
  const id = createId();
  const timestamp = nowIso();
  const [, inserted] = await executeBatch([
    {
      sql: `INSERT INTO chat_sessions (id, user_id, language, mode, title, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, input.userId, input.language, input.mode ?? "tutor", input.title ?? null, toJson(input.metadata), timestamp, timestamp],
    },
    { sql: "SELECT * FROM chat_sessions WHERE id = ?", args: [id] },
  ]);

  return mapSession<TMetadata>(inserted.rows[0] as unknown as DbRow);
}

/** Null unless the session exists and belongs to `userId`. */
export async function getChatSession<TMetadata = unknown>(userId: string, sessionId: string): Promise<ChatSession<TMetadata> | null> {
  const row = await getFirstRow("SELECT * FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1", [sessionId, userId]);
  return row ? mapSession<TMetadata>(row) : null;
}

export async function getLatestChatSession<TMetadata = unknown>(params: {
  userId: string;
  language: string;
  mode?: string;
}): Promise<ChatSession<TMetadata> | null> {
  const row = params.mode
    ? await getFirstRow(
        "SELECT * FROM chat_sessions WHERE user_id = ? AND language = ? AND mode = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1",
        [params.userId, params.language, params.mode]
      )
    : await getFirstRow(
        "SELECT * FROM chat_sessions WHERE user_id = ? AND language = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1",
        [params.userId, params.language]
      );

  return row ? mapSession<TMetadata>(row) : null;
}

export async function listChatSessions(userId: string, language: string, limit = 20): Promise<ChatSession[]> {
  const rows = await getRows(
    "SELECT * FROM chat_sessions WHERE user_id = ? AND language = ? ORDER BY updated_at DESC, rowid DESC LIMIT ?",
    [userId, language, Math.max(1, Math.min(100, limit))]
  );

  return rows.map((row) => mapSession(row));
}

/**
 * Appends a message and bumps the session's `updated_at`. Returns null (and writes nothing) if the
 * session does not belong to `userId`.
 */
export async function appendChatMessage<TPayload = unknown>(input: {
  userId: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  payload?: TPayload;
}): Promise<ChatMessageRecord<TPayload> | null> {
  const id = createId();
  const timestamp = nowIso();

  const [insert, , selected] = await executeBatch([
    {
      sql: `INSERT INTO chat_messages (id, session_id, user_id, role, content, payload, created_at)
        SELECT ?, id, user_id, ?, ?, ?, ? FROM chat_sessions WHERE id = ? AND user_id = ?`,
      args: [id, input.role, input.content, toJson(input.payload), timestamp, input.sessionId, input.userId],
    },
    {
      sql: "UPDATE chat_sessions SET updated_at = ? WHERE id = ? AND user_id = ?",
      args: [timestamp, input.sessionId, input.userId],
    },
    { sql: "SELECT * FROM chat_messages WHERE id = ?", args: [id] },
  ]);

  if (insert.rowsAffected === 0 || selected.rows.length === 0) {
    return null;
  }

  return mapMessage<TPayload>(selected.rows[0] as unknown as DbRow);
}

/** The last `limit` messages of a session in chronological order (oldest first), for prompt context. */
export async function listChatMessages<TPayload = unknown>(params: {
  userId: string;
  sessionId: string;
  limit?: number;
}): Promise<ChatMessageRecord<TPayload>[]> {
  const rows = await getRows(
    `SELECT * FROM (
        SELECT chat_messages.*, chat_messages.rowid AS seq FROM chat_messages
        WHERE session_id = ? AND user_id = ?
        ORDER BY created_at DESC, seq DESC
        LIMIT ?
      ) ORDER BY created_at ASC, seq ASC`,
    [params.sessionId, params.userId, Math.max(1, Math.min(200, params.limit ?? 20))]
  );

  return rows.map((row) => mapMessage<TPayload>(row));
}
